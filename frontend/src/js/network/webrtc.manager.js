import { SignalingClient } from './signaling.client.js';
import { showToast } from '../utils/notifier.js';

class WebRTCManager {
    constructor(config = {}) {
        this.signalingClient = new SignalingClient(config.signalingUrl);
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isHost = false;
        this.iceCandidateQueue = [];
        this.connectionTimeout = null;
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

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const arr = this.listeners.get(event);
        const index = arr.indexOf(callback);
        if (index !== -1) arr.splice(index, 1);
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
            console.log('[WebRTC] Room created:', roomId);
            this._emit('room_created', roomId);
        });

        this.signalingClient.on('room_joined', (roomId) => {
            this.roomId = roomId;
            this.isHost = false;
            console.log('[WebRTC] Room joined:', roomId);
            this._emit('room_joined', roomId);
        });

        this.signalingClient.on('peer_joined', async () => {
            console.log('[WebRTC] Peer joined event received');
            this._emit('peer_joined');
            if (this.isHost) {
                await this._createOffer();
            }
        });

        this.signalingClient.on('peer_left', () => {
            console.log('[WebRTC] Peer left event received');
            this._emit('peer_left');
            showToast('Peer disconnected from room', 'info');
            this.closeConnection();
        });

        this.signalingClient.on('rtc_offer', async (offer) => {
            console.log('[WebRTC] Received WebRTC offer');
            await this._handleOffer(offer);
        });

        this.signalingClient.on('rtc_answer', async (answer) => {
            console.log('[WebRTC] Received WebRTC answer');
            await this._handleAnswer(answer);
        });

        this.signalingClient.on('ice_candidate', async (candidate) => {
            await this._handleIceCandidate(candidate);
        });

        this.signalingClient.on('disconnect', () => {
            console.warn('[WebRTC] Signaling socket disconnected. Preserving active P2P connection.');
            // Note: We do NOT tear down RTCPeerConnection here if P2P is already active,
            // because WebRTC data channels operate independently of the signaling server once connected.
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
            console.log('[WebRTC] Peer connection already active. Skipping recreation.');
            return this.peerConnection;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
        }

        console.log('[WebRTC] Creating RTCPeerConnection, isHost:', this.isHost);
        this.peerConnection = new RTCPeerConnection(this.config);
        this.iceCandidateQueue = [];

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.roomId) {
                this.signalingClient.sendIceCandidate(event.candidate, this.roomId);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('[WebRTC] Connection state diagnostic:', state);
            this._emit('connection_state_change', state);

            if (state === 'connected') {
                this._clearConnectionTimeout();
                showToast('P2P connection established successfully', 'success');
            } else if (state === 'failed') {
                showToast('Peer connection failed', 'error');
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

        this._startConnectionTimeout();
        return this.peerConnection;
    }

    _setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('[DataChannel] OPEN and fully operational');
            this._clearConnectionTimeout();
            this._emit('datachannel_open');
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
            console.log('[DataChannel] Received message:', event.data);
            this._emit('datachannel_message', event.data);
        };
    }

    _startConnectionTimeout() {
        this._clearConnectionTimeout();
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                console.warn('[WebRTC] Connection attempt timed out');
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
        if (!this.peerConnection) {
            this._createPeerConnection();
        }
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.signalingClient.sendOffer(this.peerConnection.localDescription, this.roomId);
            this._emit('negotiation_started');
        } catch (err) {
            console.error('[WebRTC] Error creating offer:', err);
        }
    }

    async _handleOffer(offer) {
        if (!this.peerConnection) {
            this._createPeerConnection();
        }
        try {
            if (this.peerConnection.signalingState !== 'stable') {
                console.warn('[WebRTC] Ignoring offer due to non-stable state:', this.peerConnection.signalingState);
                return;
            }
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
            if (this.peerConnection.signalingState === 'stable') {
                console.warn('[WebRTC] Answer received while already stable.');
                return;
            }
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

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(data);
            return true;
        }
        console.warn('[DataChannel] Cannot send data, channel is not open');
        return false;
    }

    closeConnection() {
        this._clearConnectionTimeout();
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

// Export a persistent global singleton instance across the application lifecycle
export const rtcManager = new WebRTCManager();