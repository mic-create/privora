import { SignalingClient } from './signaling.client.js';
import { showToast } from '../utils/notifier.js';

export class WebRTCManager {
    constructor(config = {}) {
        this.signalingClient = new SignalingClient(config.signalingUrl);
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isHost = false;
        this.iceCandidateQueue = [];
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
        await this.signalingClient.connect();
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
        this.signalingClient.on('room_created', (roomId) => {
            this.roomId = roomId;
            this.isHost = true;
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

        this.signalingClient.on('disconnect', () => {
            this._emit('connection_state_change', 'disconnected');
        });
    }

    async createRoom() {
        this.isHost = true;
        this.signalingClient.createRoom();
    }

    async joinRoom(roomId) {
        this.isHost = false;
        this.roomId = roomId;
        this.signalingClient.joinRoom(roomId);
        // Once joined, create peer connection and wait for offer (or if joining, peer joined event handles negotiation from host)
        this._createPeerConnection();
    }

    _createPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(this.config);
        this.iceCandidateQueue = [];

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.signalingClient.sendIceCandidate(event.candidate, this.roomId);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('[WebRTC] Connection state change:', state);
            this._emit('connection_state_change', state);

            if (state === 'connected') {
                showToast('P2P connection established successfully', 'success');
            } else if (state === 'failed' || state === 'disconnected') {
                showToast('Peer connection interrupted or failed', 'error');
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE connection state:', this.peerConnection.iceConnectionState);
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

        return this.peerConnection;
    }

    _setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('[DataChannel] Open and ready for encrypted streams');
            this._emit('datachannel_open');
            showToast('DataChannel operational', 'success');
        };

        this.dataChannel.onclose = () => {
            console.log('[DataChannel] Closed');
            this._emit('datachannel_close');
        };

        this.dataChannel.onerror = (error) => {
            console.error('[DataChannel] Error:', error);
            this._emit('datachannel_error', error);
        };

        this.dataChannel.onmessage = (event) => {
            this._emit('datachannel_message', event.data);
        };
    }

    async _createOffer() {
        this._createPeerConnection();
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.signalingClient.sendOffer(this.peerConnection.localDescription, this.roomId);
            this._emit('negotiation_started');
        } catch (err) {
            console.error('[WebRTC] Error creating offer:', err);
            showToast('Failed to create WebRTC offer', 'error');
        }
    }

    async _handleOffer(offer) {
        if (!this.peerConnection) {
            this._createPeerConnection();
        }

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            await this._processQueuedIceCandidates();

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.signalingClient.sendAnswer(this.peerConnection.localDescription, this.roomId);
        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
            showToast('Failed to process incoming connection offer', 'error');
        }
    }

    async _handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            await this._processQueuedIceCandidates();
        } catch (err) {
            console.error('[WebRTC] Error handling answer:', err);
            showToast('Failed to process connection answer', 'error');
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

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(data);
            return true;
        }
        console.warn('[DataChannel] Cannot send data, channel is not open');
        return false;
    }

    closeConnection() {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.roomId) {
            this.signalingClient.leaveRoom(this.roomId);
            this.roomId = null;
        }
        this._emit('connection_closed');
    }

    disconnect() {
        this.closeConnection();
        this.signalingClient.disconnect();
    }
}