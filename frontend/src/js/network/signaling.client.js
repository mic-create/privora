import { showToast } from '../utils/notifier.js';

export class SignalingClient {
    constructor(serverUrl) {
        const productionWsUrl = 'wss://privora-signaling-backend.onrender.com';
        this.serverUrl = serverUrl || (window.location.hostname === 'localhost' ? 'ws://localhost:5000' : productionWsUrl);
        this.ws = null;
        this.listeners = new Map();
        this.isConnected = false;
        this.pingInterval = null;
        this.currentRoomId = sessionStorage.getItem('privora_active_room') || null;
        this.hostKey = sessionStorage.getItem('privora_host_key') || null;
        this.isHost = sessionStorage.getItem('privora_is_host') === 'true';
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            console.log('[Signaling] Connecting to WebSocket server:', this.serverUrl);

            try {
                this.ws = new WebSocket(this.serverUrl);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    console.log('[Signaling] Connected successfully');
                    this._startHeartbeat();

                    // Automatically restore session identity if returning from background app switch
                    if (this.currentRoomId) {
                        this.rejoinSession();
                    }

                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this._handleMessage(message);
                    } catch (err) {
                        console.error('[Signaling] Failed to parse message:', err);
                    }
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    console.warn('[Signaling] WebSocket closed');
                    this._stopHeartbeat();
                    this._emit('disconnect');
                };

                this.ws.onerror = (error) => {
                    console.error('[Signaling] WebSocket error:', error);
                    reject(error);
                };
            } catch (err) {
                reject(err);
            }
        });
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

    _handleMessage(message) {
        const { type, ...payload } = message;
        console.log('[Signaling] Received message:', type, payload);

        switch (type) {
            case 'ROOM_CREATED':
                this.currentRoomId = payload.roomId;
                this.hostKey = payload.hostKey;
                this.isHost = true;
                
                sessionStorage.setItem('privora_active_room', payload.roomId);
                sessionStorage.setItem('privora_host_key', payload.hostKey);
                sessionStorage.setItem('privora_is_host', 'true');

                this._emit('room_created', payload.roomId);
                break;

            case 'ROOM_JOINED':
                this.currentRoomId = payload.roomId;
                if (payload.isHost !== undefined) {
                    this.isHost = payload.isHost;
                    sessionStorage.setItem('privora_is_host', payload.isHost ? 'true' : 'false');
                }
                sessionStorage.setItem('privora_active_room', payload.roomId);
                this._emit('room_joined', payload.roomId);
                break;

            case 'PEER_JOINED':
                this._emit('peer_joined', payload);
                break;

            case 'PEER_LEFT':
                this._emit('peer_left', payload);
                break;

            case 'RTC_OFFER':
                this._emit('rtc_offer', payload.offer);
                break;

            case 'RTC_ANSWER':
                this._emit('rtc_answer', payload.answer);
                break;

            case 'ICE_CANDIDATE':
                this._emit('ice_candidate', payload.candidate);
                break;

            case 'ERROR':
                showToast(payload.message || 'Signaling error', 'error');
                this._emit('error', payload);
                break;

            case 'PONG':
                break;

            default:
                console.warn('[Signaling] Unhandled message:', type);
        }
    }

    send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[Signaling] Cannot send message: WebSocket closed');
            return false;
        }

        const data = JSON.stringify({ type, ...payload });
        this.ws.send(data);
        return true;
    }

    createRoom() {
        this.isHost = true;
        const generatedHostKey = crypto.randomUUID();
        this.hostKey = generatedHostKey;
        sessionStorage.setItem('privora_host_key', generatedHostKey);
        return this.send('CREATE_ROOM', { hostKey: generatedHostKey });
    }

    joinRoom(roomId) {
        this.currentRoomId = roomId;
        return this.send('JOIN_ROOM', { roomId, hostKey: this.hostKey });
    }

    rejoinSession() {
        if (this.currentRoomId && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`[Signaling] Restoring session for Room #${this.currentRoomId}`);
            this.send('JOIN_ROOM', { roomId: this.currentRoomId, hostKey: this.hostKey });
        }
    }

    sendOffer(offer, roomId) {
        return this.send('RTC_OFFER', { offer, roomId: roomId || this.currentRoomId });
    }

    sendAnswer(answer, roomId) {
        return this.send('RTC_ANSWER', { answer, roomId: roomId || this.currentRoomId });
    }

    sendIceCandidate(candidate, roomId) {
        return this.send('ICE_CANDIDATE', { candidate, roomId: roomId || this.currentRoomId });
    }

    leaveRoom(roomId) {
        this.send('LEAVE_ROOM', { roomId: roomId || this.currentRoomId });
        this.clearSessionData();
    }

    clearSessionData() {
        this.currentRoomId = null;
        this.hostKey = null;
        this.isHost = false;
        sessionStorage.removeItem('privora_active_room');
        sessionStorage.removeItem('privora_host_key');
        sessionStorage.removeItem('privora_is_host');
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._stopHeartbeat();
        this.clearSessionData();
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('PING');
            }
        }, 30000);
    }

    _stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}