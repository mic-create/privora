import { SignalingClient } from './signaling.client.js';
import { showToast } from '../utils/notifier.js';
import { generateSessionKeys, importSessionKey, deriveSubkey, encryptPayload, decryptPayload, encryptChunk, decryptChunk, calculateFileHash } from '../crypto/encryption.js';

class WebRTCManager {
    constructor(config = {}) {
        this.signalingClient = new SignalingClient(config.signalingUrl);
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isHost = false;
        this.iceCandidateQueue = [];
        this.connectionTimeout = null;
        
        // Cryptographic and Subkeys with Synchronization State
        this.sessionKey = null;
        this.sessionKeyBase64 = null;
        this.chatKey = null;
        this.fileKey = null;
        this.isKeySynchronized = false;

        // Transfer & Chat State
        this.activeTransfers = new Map();
        this.incomingTransfers = new Map();
        this.chatMessages = [];
        this.lastSeenSequence = 0;

        this.config = {
            iceServers: config.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:free.expressturn.com:3478',
                    username: '000000002109302648',
                    credential: 'U8xYJk9FVhRqSdgnSeB6Zn95oRQ='
                }
            ]
        };
        this.listeners = new Map();
        this._setupSignalingListeners();
    }

    async initialize(stunServers, turnConfig) {
        if (stunServers && stunServers.length > 0) {
            this.config.iceServers = stunServers.map(url => ({ urls: url }));
        }
        if (turnConfig && turnConfig.enabled && turnConfig.url) {
            this.config.iceServers.push({
                urls: turnConfig.url,
                username: turnConfig.username,
                credential: turnConfig.credential
            });
        }
        if (!this.signalingClient.isConnected) {
            await this.signalingClient.connect();
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        if (!this.listeners.has(event)) return;
        for (const cb of this.listeners.get(event)) {
            cb(data);
        }
    }

    async _initSubkeys(masterKey, isSynced = true) {
        this.sessionKey = masterKey;
        this.chatKey = await deriveSubkey(masterKey, 'privora-salt-v1', 'privora-chat-encryption');
        this.fileKey = await deriveSubkey(masterKey, 'privora-salt-v1', 'privora-file-encryption');
        this.isKeySynchronized = isSynced;
        console.log('[Crypto Diagnostic] HKDF subkeys derived successfully. Synchronized:', isSynced);
    }

    _setupSignalingListeners() {
        this.signalingClient.on('room_created', async (roomId) => {
            this.roomId = roomId;
            this.isHost = true;
            const keys = await generateSessionKeys();
            await this._initSubkeys(keys.key, true);
            this.sessionKeyBase64 = keys.rawBase64;
            this._emit('room_created', roomId);
        });

        this.signalingClient.on('room_joined', async (roomId) => {
            this.roomId = roomId;
            this.isHost = false;
            this.isKeySynchronized = false;
            this._emit('room_joined', roomId);
            this._createPeerConnection();
        });

        this.signalingClient.on('peer_joined', async () => {
            this._emit('peer_joined');
            if (this.isHost) {
                if (!this.peerConnection) this._createPeerConnection();
                await this._createOffer();
            }
        });

        this.signalingClient.on('peer_left', () => {
            this._emit('peer_left');
            showToast('Peer disconnected from room', 'info');
            this.closeConnection();
        });

        this.signalingClient.on('rtc_offer', async (offer) => {
            await this._handleOffer(offer);
        });

        this.signalingClient.on('rtc_answer', async (answer) => {
            await this._handleAnswer(answer);
        });

        this.signalingClient.on('ice_candidate', async (candidate) => {
            await this._handleIceCandidate(candidate);
        });
    }

    async createRoom() {
        await this.initialize();
        this.isHost = true;
        this.signalingClient.createRoom();
    }

    async joinRoom(roomId) {
        await this.initialize();
        this.isHost = false;
        this.roomId = roomId;
        this.signalingClient.joinRoom(roomId);
    }

    _createPeerConnection() {
        if (this.peerConnection && (this.peerConnection.connectionState === 'connected' || this.peerConnection.connectionState === 'connecting')) {
            return this.peerConnection;
        }
        if (this.peerConnection) this.peerConnection.close();

        this.peerConnection = new RTCPeerConnection(this.config);
        this.iceCandidateQueue = [];

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.roomId) {
                this.signalingClient.sendIceCandidate(event.candidate, this.roomId);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            this._emit('connection_state_change', state);
            if (state === 'connected') this._clearConnectionTimeout();
        };

        if (this.isHost) {
            try {
                this.dataChannel = this.peerConnection.createDataChannel('privora-data-channel', { ordered: true });
                this._setupDataChannel();
            } catch (err) {
                console.error('Failed to create data channel:', err);
            }
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this._setupDataChannel();
            };
        }

        this._startConnectionTimeout();
        return this.peerConnection;
    }

    _setupDataChannel() {
        if (!this.dataChannel) return;
        this.dataChannel.binaryType = 'arraybuffer';

        this.dataChannel.onopen = () => {
            this._clearConnectionTimeout();
            this._emit('datachannel_open');
            showToast('Secure P2P DataChannel established', 'success');

            if (this.isHost && this.sessionKeyBase64) {
                this.dataChannel.send(JSON.stringify({ type: 'KEY_EXCHANGE', key: this.sessionKeyBase64 }));
            }
        };

        this.dataChannel.onclose = () => {
            this._emit('datachannel_close');
        };

        this.dataChannel.onerror = (error) => {
            console.error('[DataChannel] Error:', error);
        };

        this.dataChannel.onmessage = async (event) => {
            await this._handleDataChannelMessage(event.data);
        };
    }

    async _handleDataChannelMessage(data) {
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'KEY_EXCHANGE') {
                    const masterKey = await importSessionKey(msg.key);
                    await this._initSubkeys(masterKey, true);
                    showToast('Encryption keys synchronized securely', 'success');
                } else if (msg.type === 'ENCRYPTED_CHAT') {
                    if (!this.isKeySynchronized || !this.chatKey) {
                        console.warn('[Crypto Warning] Received chat message before key synchronization completed.');
                        showToast('Waiting for key synchronization...', 'info');
                        return;
                    }
                    try {
                        const decrypted = await decryptPayload(this.chatKey, msg.iv, msg.ciphertext);
                        
                        if (decrypted.type === 'CHAT_MESSAGE') {
                            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                                this.dataChannel.send(JSON.stringify({
                                    type: 'ENCRYPTED_CHAT',
                                    ...(await encryptPayload(this.chatKey, {
                                        type: 'CHAT_ACK',
                                        messageId: decrypted.messageId
                                    }))
                                }));
                            }

                            this.chatMessages.push({ ...decrypted, direction: 'incoming', status: 'Delivered' });
                            this._emit('chat_message_received', decrypted);
                        } else if (decrypted.type === 'CHAT_ACK') {
                            const found = this.chatMessages.find(m => m.messageId === decrypted.messageId);
                            if (found) {
                                found.status = 'Delivered';
                                this._emit('chat_status_updated', found);
                            }
                        } else {
                            console.warn('Unknown decrypted packet subtype:', decrypted.type);
                        }
                    } catch (decErr) {
                        console.error('[Crypto Error] Decryption/Authentication failure:', decErr.message);
                        showToast('Encrypted message failed tag authentication verification', 'error');
                    }
                } else if (msg.type === 'TYPING_INDICATOR') {
                    this._emit('peer_typing', msg.isTyping);
                } else if (msg.type === 'FILE_META') {
                    const transferObj = {
                        transferId: msg.transferId,
                        name: msg.name,
                        size: msg.size,
                        fileType: msg.fileType,
                        totalChunks: msg.chunks,
                        expectedHash: msg.sha256,
                        receivedChunks: 0,
                        chunksArray: []
                    };
                    this.incomingTransfers.set(msg.transferId, transferObj);
                    this._emit('incoming_transfer', msg);
                } else if (msg.type === 'FILE_ACCEPT') {
                    const transfer = this.activeTransfers.get(msg.transferId);
                    if (transfer) {
                        transfer.status = 'transferring';
                        this._emit('transfer_progress', transfer);
                        await this._streamFileChunks(transfer);
                    }
                } else if (msg.type === 'FILE_DECLINE') {
                    const transfer = this.activeTransfers.get(msg.transferId);
                    if (transfer) {
                        transfer.status = 'declined';
                        this._emit('transfer_progress', transfer);
                        showToast(`Peer declined file: ${transfer.name}`, 'error');
                    }
                } else if (msg.type === 'FILE_CANCEL') {
                    this.incomingTransfers.delete(msg.transferId);
                    this._emit('transfer_cancelled', msg.transferId);
                    showToast('Transfer cancelled by peer', 'info');
                } else if (msg.type === 'TRANSFER_SUCCESS_ACK') {
                    const transfer = this.activeTransfers.get(msg.transferId);
                    if (transfer) {
                        transfer.status = 'completed';
                        this._emit('transfer_completed', transfer);
                        showToast(`Successfully sent and verified ${transfer.name}`, 'success');
                    }
                }
            } catch (err) {
                console.error('Failed to parse text message over DC:', err);
            }
        } else {
            try {
                const view = new DataView(data);
                const metaLen = view.getUint32(0);
                const decoder = new TextDecoder();
                const metaStr = decoder.decode(data.slice(4, 4 + metaLen));
                const meta = JSON.parse(metaStr);

                const iv = data.slice(4 + metaLen, 4 + metaLen + 12);
                const ciphertext = data.slice(4 + metaLen + 12);

                const transfer = this.incomingTransfers.get(meta.transferId);
                if (transfer && this.fileKey) {
                    const decrypted = await decryptChunk(this.fileKey, iv, ciphertext);
                    transfer.chunksArray[meta.seq] = decrypted;
                    transfer.receivedChunks++;

                    const progress = Math.round((transfer.receivedChunks / transfer.totalChunks) * 100);
                    this._emit('transfer_progress', {
                        transferId: transfer.transferId,
                        name: transfer.name,
                        progress,
                        status: 'receiving'
                    });

                    if (transfer.receivedChunks === transfer.totalChunks) {
                        const completeBlob = new Blob(transfer.chunksArray, { type: transfer.fileType });
                        const reconstructedBuffer = await completeBlob.arrayBuffer();
                        const computedHash = await calculateFileHash(reconstructedBuffer);

                        if (computedHash === transfer.expectedHash) {
                            transfer.blob = completeBlob;
                            transfer.status = 'completed';
                            this._emit('transfer_completed', transfer);
                            showToast(`Verified & received ${transfer.name}`, 'success');

                            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                                this.dataChannel.send(JSON.stringify({ type: 'TRANSFER_SUCCESS_ACK', transferId: transfer.transferId }));
                            }
                        } else {
                            transfer.status = 'failed';
                            this._emit('transfer_progress', transfer);
                            showToast(`Hash verification failed for ${transfer.name}`, 'error');
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to decrypt file chunk:', err);
                showToast('File chunk decryption failed', 'error');
            }
        }
    }

    async sendChatMessage(text) {
        if (!this.isKeySynchronized || !this.chatKey) {
            showToast('Encryption keys are still synchronizing. Please wait a moment.', 'error');
            throw new Error('Key synchronization incomplete');
        }

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            throw new Error('DataChannel not open for messaging');
        }

        const messageId = Math.random().toString(36).substring(2, 11);
        const sequence = ++this.lastSeenSequence;
        const timestamp = Date.now();

        const chatPayload = {
            type: 'CHAT_MESSAGE',
            messageId,
            sequence,
            timestamp,
            text
        };

        const encrypted = await encryptPayload(this.chatKey, chatPayload);
        const record = {
            ...chatPayload,
            status: 'Sending',
            direction: 'outgoing'
        };

        this.chatMessages.push(record);
        this._emit('chat_message_sent', record);

        this.dataChannel.send(JSON.stringify({
            type: 'ENCRYPTED_CHAT',
            ...encrypted
        }));

        setTimeout(() => {
            const currentMsg = this.chatMessages.find(m => m.messageId === messageId);
            if (currentMsg && currentMsg.status === 'Sending') {
                currentMsg.status = 'Delivered';
                this._emit('chat_status_updated', currentMsg);
            }
        }, 5000);

        return record;
    }

    async sendTypingIndicator(isTyping) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
        this.dataChannel.send(JSON.stringify({
            type: 'TYPING_INDICATOR',
            isTyping
        }));
    }

    async sendFiles(files) {
        if (!this.isKeySynchronized || !this.fileKey) {
            showToast('Encryption keys are still synchronizing.', 'error');
            return;
        }

        const CHUNK_SIZE = 16 * 1024;

        for (const file of files) {
            const transferId = Math.random().toString(36).substring(2, 11);
            const arrayBuf = await file.arrayBuffer();
            const sha256 = await calculateFileHash(arrayBuf);
            const totalChunks = Math.ceil(arrayBuf.byteLength / CHUNK_SIZE);

            const transferRecord = {
                transferId,
                file,
                name: file.name,
                size: file.size,
                fileType: file.type,
                arrayBuf,
                CHUNK_SIZE,
                totalChunks,
                sha256,
                sentChunks: 0,
                status: 'waiting_for_acceptance',
                progress: 0
            };

            this.activeTransfers.set(transferId, transferRecord);
            this._emit('transfer_initiated', transferRecord);

            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(JSON.stringify({
                    type: 'FILE_META',
                    transferId,
                    name: file.name,
                    size: file.size,
                    fileType: file.type,
                    chunks: totalChunks,
                    sha256
                }));
            }
        }
    }

    async _streamFileChunks(transfer) {
        const { arrayBuf, CHUNK_SIZE, totalChunks, transferId, file } = transfer;

        for (let seq = 0; seq < totalChunks; seq++) {
            if (transfer.status === 'cancelled' || transfer.status === 'failed') break;

            const start = seq * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, arrayBuf.byteLength);
            const chunkSlice = arrayBuf.slice(start, end);

            const { iv, ciphertext } = await encryptChunk(this.fileKey, chunkSlice);

            const metaHeader = JSON.stringify({ transferId, seq });
            const metaEncoder = new TextEncoder();
            const metaBytes = metaEncoder.encode(metaHeader);

            const packet = new ArrayBuffer(4 + metaBytes.byteLength + 12 + ciphertext.byteLength);
            const view = new DataView(packet);
            view.setUint32(0, metaBytes.byteLength);

            const uint8 = new Uint8Array(packet);
            uint8.set(metaBytes, 4);
            uint8.set(new Uint8Array(iv), 4 + metaBytes.byteLength);
            uint8.set(new Uint8Array(ciphertext), 4 + metaBytes.byteLength + 12);

            if (this.dataChannel.bufferedAmount > 256 * 1024) {
                await new Promise((resolve) => {
                    const threshold = 64 * 1024;
                    this.dataChannel.bufferedAmountLowThreshold = threshold;
                    const handler = () => {
                        this.dataChannel.removeEventListener('bufferedamountlow', handler);
                        resolve();
                    };
                    this.dataChannel.addEventListener('bufferedamountlow', handler);
                    setTimeout(resolve, 100);
                });
            }

            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(packet);
                transfer.sentChunks++;
                const progress = Math.round((transfer.sentChunks / totalChunks) * 100);
                transfer.progress = progress;
                this._emit('transfer_progress', {
                    transferId,
                    name: file.name,
                    progress,
                    status: 'transferring'
                });
            } else {
                transfer.status = 'failed';
                this._emit('transfer_progress', transfer);
                break;
            }
        }
    }

    acceptTransfer(transferId) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'FILE_ACCEPT', transferId }));
        }
    }

    declineTransfer(transferId) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'FILE_DECLINE', transferId }));
        }
        this.incomingTransfers.delete(transferId);
    }

    cancelTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) transfer.status = 'cancelled';
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'FILE_CANCEL', transferId }));
        }
        this.activeTransfers.delete(transferId);
    }

    clearConversation() {
        this.chatMessages = [];
        this.lastSeenSequence = 0;
    }

    _startConnectionTimeout() {
        this._clearConnectionTimeout();
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                showToast('Connection attempt timed out', 'error');
                this._emit('connection_state_change', 'failed');
            }
        }, 30000);
    }

    _clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    async _createOffer() {
        if (!this.peerConnection) this._createPeerConnection();
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.signalingClient.sendOffer(this.peerConnection.localDescription, this.roomId);
        } catch (err) {
            console.error('Error creating offer:', err);
        }
    }

    async _handleOffer(offer) {
        if (!this.peerConnection) this._createPeerConnection();
        try {
            if (this.peerConnection.signalingState !== 'stable') return;
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            await this._processQueuedIceCandidates();
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.signalingClient.sendAnswer(this.peerConnection.localDescription, this.roomId);
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    }

    async _handleAnswer(answer) {
        try {
            if (this.peerConnection.signalingState === 'stable') return;
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            await this._processQueuedIceCandidates();
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    }

    async _handleIceCandidate(candidateData) {
        const candidate = new RTCIceCandidate(candidateData);
        if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                console.error('Error adding ICE candidate:', err);
            }
        } else {
            this.iceCandidateQueue.push(candidate);
        }
    }

    async _processQueuedIceCandidates() {
        while (this.iceCandidateQueue.length > 0) {
            const candidate = this.iceCandidateQueue.shift();
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                console.error('Error adding queued ICE candidate:', err);
            }
        }
    }

    closeConnection() {
        this._clearConnectionTimeout();
        if (this.dataChannel) { this.dataChannel.close(); this.dataChannel = null; }
        if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
        if (this.roomId) { this.signalingClient.leaveRoom(this.roomId); this.roomId = null; }
        this._emit('connection_closed');
    }

    disconnect() {
        this.closeConnection();
        this.signalingClient.disconnect();
    }
}

export const rtcManager = new WebRTCManager();