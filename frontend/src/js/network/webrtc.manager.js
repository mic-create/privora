import { SignalingClient } from './signaling.client.js';
import { showToast } from '../utils/notifier.js';
import { generateSessionKeys, importSessionKey, encryptChunk, decryptChunk } from '../crypto/encryption.js';

class WebRTCManager {
    constructor(config = {}) {
        this.signalingClient = new SignalingClient(config.signalingUrl);
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isHost = false;
        this.iceCandidateQueue = [];
        this.connectionTimeout = null;
        
        // Cryptographic state
        this.sessionKey = null;
        this.activeTransfers = new Map(); // transferId -> transfer metadata & state
        this.incomingTransfers = new Map(); // transferId -> metadata waiting approval

        this.config = {
            iceServers: config.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
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

    _setupSignalingListeners() {
        this.signalingClient.on('room_created', async (roomId) => {
            this.roomId = roomId;
            this.isHost = true;
            const keys = await generateSessionKeys();
            this.sessionKey = keys.key;
            this.sessionKeyBase64 = keys.rawBase64;
            this._emit('room_created', roomId);
        });

        this.signalingClient.on('room_joined', (roomId) => {
            this.roomId = roomId;
            this.isHost = false;
            this._emit('room_joined', roomId);
        });

        this.signalingClient.on('peer_joined', async () => {
            this._emit('peer_joined');
            if (this.isHost) {
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
        this._createPeerConnection();
    }

    _createPeerConnection() {
        if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
            return this.peerConnection;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }

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
            if (state === 'connected') {
                this._clearConnectionTimeout();
                showToast('P2P connection established successfully', 'success');
            } else if (state === 'failed') {
                showToast('Peer connection failed', 'error');
            }
        };

        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('privora-data-channel', { ordered: true });
            this._setupDataChannel();
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
            // If joiner, send crypto key exchange over data channel or sync
            if (!this.isHost && this.sessionKeyBase64) {
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
                    this.sessionKey = await importSessionKey(msg.key);
                    console.log('[Crypto] Session encryption key imported successfully');
                } else if (msg.type === 'FILE_META') {
                    this.incomingTransfers.set(msg.transferId, {
                        transferId: msg.transferId,
                        name: msg.name,
                        size: msg.size,
                        fileType: msg.fileType,
                        totalChunks: msg.chunks,
                        receivedChunks: 0,
                        chunksArray: []
                    });
                    this._emit('incoming_transfer', msg);
                } else if (msg.type === 'FILE_ACCEPT') {
                    const transfer = this.activeTransfers.get(msg.transferId);
                    if (transfer) {
                        transfer.status = 'sending';
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
                }
            } catch (err) {
                console.error('Failed to parse text message over DC:', err);
            }
        } else {
            // Binary chunk received (ArrayBuffer). Format: [4 bytes transferId length] [JSON metadata string] [IV 12 bytes] [Encrypted Payload]
            const view = new DataView(data);
            const metaLen = view.getUint32(0);
            const decoder = new TextDecoder();
            const metaStr = decoder.decode(data.slice(4, 4 + metaLen));
            const meta = JSON.parse(metaStr);

            const iv = data.slice(4 + metaLen, 4 + metaLen + 12);
            const ciphertext = data.slice(4 + metaLen + 12);

            const transfer = this.incomingTransfers.get(meta.transferId);
            if (transfer && this.sessionKey) {
                try {
                    const decrypted = await decryptChunk(this.sessionKey, iv, ciphertext);
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
                        transfer.blob = completeBlob;
                        transfer.status = 'completed';
                        this._emit('transfer_completed', transfer);
                        showToast(`Successfully received ${transfer.name}`, 'success');
                    }
                } catch (err) {
                    console.error('Decryption failed for incoming chunk:', err);
                    showToast('Cryptographic integrity check failed for file chunk', 'error');
                }
            }
        }
    }

    async sendFiles(files) {
        if (!this.sessionKey) {
            // If joiner didn't have key generated locally, generate one and send to host
            const keys = await generateSessionKeys();
            this.sessionKey = keys.key;
            this.sessionKeyBase64 = keys.rawBase64;
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(JSON.stringify({ type: 'KEY_EXCHANGE', key: this.sessionKeyBase64 }));
            }
        }

        const CHUNK_SIZE = 16 * 1024; // 16KB safe SCTP chunk size

        for (const file of files) {
            const transferId = Math.random().toString(36.25).substring(2, 11);
            const arrayBuf = await file.arrayBuffer();
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
                sentChunks: 0,
                status: 'pending_acceptance'
            };

            this.activeTransfers.set(transferId, transferRecord);
            this._emit('transfer_initiated', transferRecord);

            // Send metadata to receiver
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(JSON.stringify({
                    type: 'FILE_META',
                    transferId,
                    name: file.name,
                    size: file.size,
                    fileType: file.type,
                    chunks: totalChunks
                }));
            }
        }
    }

    async _streamFileChunks(transfer) {
        const { arrayBuf, CHUNK_SIZE, totalChunks, transferId, file } = transfer;

        for (let seq = 0; seq < totalChunks; seq++) {
            if (transfer.status === 'cancelled') break;

            const start = seq * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, arrayBuf.byteLength);
            const chunkSlice = arrayBuf.slice(start, end);

            // Encrypt chunk locally using AES-GCM
            const { iv, ciphertext } = await encryptChunk(this.sessionKey, chunkSlice);

            const metaHeader = JSON.stringify({ transferId, seq });
            const metaEncoder = new TextEncoder();
            const metaBytes = metaEncoder.encode(metaHeader);

            // Construct binary packet: [4 bytes metaLen] [metaBytes] [12 bytes IV] [ciphertext]
            const packet = new ArrayBuffer(4 + metaBytes.byteLength + 12 + ciphertext.byteLength);
            const view = new DataView(packet);
            view.setUint32(0, metaBytes.byteLength);

            const uint8 = new Uint8Array(packet);
            uint8.set(metaBytes, 4);
            uint8.set(new Uint8Array(iv), 4 + metaBytes.byteLength);
            uint8.set(new Uint8Array(ciphertext), 4 + metaBytes.byteLength + 12);

            // Backpressure handling: wait if bufferedAmount is high
            while (this.dataChannel.bufferedAmount > 64 * 1024) {
                await new Promise(r => setTimeout(r, 50));
            }

            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(packet);
                transfer.sentChunks++;
                const progress = Math.round((transfer.sentChunks / totalChunks) * 100);
                this._emit('transfer_progress', {
                    transferId,
                    name: file.name,
                    progress,
                    status: 'sending'
                });
            } else {
                transfer.status = 'failed';
                this._emit('transfer_progress', transfer);
                break;
            }
        }

        if (transfer.sentChunks === totalChunks && transfer.status !== 'cancelled') {
            transfer.status = 'completed';
            this._emit('transfer_completed', transfer);
            showToast(`Successfully sent ${file.name}`, 'success');
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
        if (transfer) {
            transfer.status = 'cancelled';
        }
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'FILE_CANCEL', transferId }));
        }
        this.activeTransfers.delete(transferId);
    }

    _startConnectionTimeout() {
        this._clearConnectionTimeout();
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                showToast('Connection attempt timed out. Verify network firewalls.', 'error');
                this._emit('connection_state_change', 'failed');
            }
        }, 25000);
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
            console.error('[WebRTC] Error creating offer:', err);
        }
    }

    async _handleOffer(offer) {
        if (!this.peerConnection) this._createPeerConnection();
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            await this._processQueuedIceCandidates();
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.signalingClient.sendAnswer(this.peerConnection.localDescription, this.roomId);
        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
        }
    }

    async _handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            await this._processQueuedIceCandidates();
        } catch (err) {
            console.error('[WebRTC] Error handling answer:', err);
        }
    }

    async _handleIceCandidate(candidateData) {
        const candidate = new RTCIceCandidate(candidateData);
        if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                console.error('[WebRTC] Error adding ICE candidate:', err);
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
                console.error('[WebRTC] Error adding queued ICE candidate:', err);
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