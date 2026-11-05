import { showToast } from '../utils/notifier.js';

export class SignalingClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl || (window.location.hostname === 'localhost' ? 'ws://localhost:5000' : `wss://${window.location.host}`);
        this.ws = null;
        this.listeners = new Map();
        this.isConnected = false;
        this.pingInterval = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            try {
                this.ws = new WebSocket(this.serverUrl);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    console.log('[Signaling] Connected to WebSocket server');
                    this._startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this._handleMessage(message);
                    } catch (err) {
                        console.error('[Signaling] Failed to parse incoming message:', err);
                    }
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    console.warn('[Signaling] Disconnected from WebSocket server');
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

    _handleMessage(message) {
        const { type, ...payload } = message;
        console.log('[Signaling] Received message type:', type);

        switch (type) {
            case 'ROOM_CREATED':
                this._emit('room_created', payload.roomId);
                break;
            case 'ROOM_JOINED':
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
                showToast(payload.message || 'Signaling error occurred', 'error');
                this._emit('error', payload);
                break;
            case 'PONG':
                break;
            default:
                console.warn('[Signaling] Unhandled message type:', type);
        }
    }

    send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[Signaling] Cannot send message, WebSocket is not open');
            showToast('Signaling connection lost. Reconnecting...', 'error');
            return false;
        }

        const data = JSON.stringify({ type, ...payload });
        this.ws.send(data);
        return true;
    }

    createRoom() {
        return this.send('CREATE_ROOM');
    }

    joinRoom(roomId) {
        return this.send('JOIN_ROOM', { roomId });
    }

    sendOffer(offer, roomId) {
        return this.send('RTC_OFFER', { offer, roomId });
    }

    sendAnswer(answer, roomId) {
        return this.send('RTC_ANSWER', { answer, roomId });
    }

    sendIceCandidate(candidate, roomId) {
        return this.send('ICE_CANDIDATE', { candidate, roomId });
    }

    leaveRoom(roomId) {
        this.send('LEAVE_ROOM', { roomId });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._stopHeartbeat();
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