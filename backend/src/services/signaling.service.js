import crypto from 'crypto';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { validateSignalingMessage } from '../utils/validator.js';
import { checkRateLimit } from '../middleware/rateLimit.middleware.js';

const rooms = new Map(); // roomId -> { peers: Set, hostSocket: ws, cleanupTimer: null }
const clientRooms = new Map(); // WebSocket client -> roomId
const clientIps = new Map(); // WebSocket client -> IP string

export function handleSignalingConnection(ws, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    clientIps.set(ws, ip);
    ws.isAlive = true;

    logger.info('WebSocket peer connected', { ip });

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (rawMessage) => {
        if (!checkRateLimit(ip)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit exceeded. Please slow down.' }));
            return;
        }

        const validation = validateSignalingMessage(rawMessage.toString());
        if (!validation.valid) {
            logger.warn('Invalid signaling message received', { error: validation.error, ip });
            ws.send(JSON.stringify({ type: 'ERROR', message: validation.error }));
            return;
        }

        const message = validation.data;
        routeMessage(ws, message);
    });

    ws.on('close', () => {
        logger.info('WebSocket peer disconnected', { ip });
        handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        logger.error('WebSocket connection error', { error: err.message, ip });
        handleDisconnect(ws);
    });
}

function routeMessage(ws, message) {
    switch (message.type) {
        case 'CREATE_ROOM':
            handleCreateRoom(ws);
            break;
        case 'JOIN_ROOM':
            handleJoinRoom(ws, message.roomId, message.isHostReconnection);
            break;
        case 'RTC_OFFER':
        case 'RTC_ANSWER':
        case 'ICE_CANDIDATE':
            relayToPeer(ws, message);
            break;
        case 'LEAVE_ROOM':
            handleDisconnect(ws);
            break;
        case 'PING':
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
        default:
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unknown message type' }));
    }
}

function handleCreateRoom(ws) {
    handleDisconnect(ws);

    const roomId = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    rooms.set(roomId, {
        peers: new Set([ws]),
        hostSocket: ws,
        cleanupTimer: null
    });
    clientRooms.set(ws, roomId);
    ws.isHost = true;

    logger.info('Room created successfully by host', { roomId });
    ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomId }));
}

function handleJoinRoom(ws, roomId, isHostReconnection = false) {
    const upperRoomId = roomId ? roomId.toUpperCase() : '';
    if (!upperRoomId || !rooms.has(upperRoomId)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Room does not exist or has expired' }));
        return;
    }

    const roomData = rooms.get(upperRoomId);

    // Cancel any pending grace period destruction timer since activity occurred
    if (roomData.cleanupTimer) {
        clearTimeout(roomData.cleanupTimer);
        roomData.cleanupTimer = null;
        logger.info('Cancelled room expiration grace timer due to activity', { roomId: upperRoomId });
    }

    // Check if this is the original host reconnecting
    if (isHostReconnection || roomData.hostSocket === null || roomData.peers.size === 0) {
        roomData.hostSocket = ws;
        ws.isHost = true;
    } else if (roomData.peers.size >= 2 && !roomData.peers.has(ws)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full (maximum 2 peers allowed)' }));
        return;
    }

    roomData.peers.add(ws);
    clientRooms.set(ws, upperRoomId);

    logger.info('Peer joined or re-linked room', { roomId: upperRoomId, roomSize: roomData.peers.size, isHost: !!ws.isHost });
    ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomId: upperRoomId, isHost: !!ws.isHost }));

    // Notify other peers in the room
    for (const peer of roomData.peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'PEER_JOINED' }));
            logger.info('Dispatched PEER_JOINED notification', { roomId: upperRoomId });
        }
    }
}

function relayToPeer(ws, message) {
    const roomId = clientRooms.get(ws);
    if (!roomId || !rooms.has(roomId)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Not assigned to an active room' }));
        return;
    }

    const roomData = rooms.get(roomId);
    for (const peer of roomData.peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify(message));
        }
    }
}

function handleDisconnect(ws) {
    const roomId = clientRooms.get(ws);
    if (roomId && rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        roomData.peers.delete(ws);

        logger.info('Peer disconnected from room context', { roomId, remainingPeers: roomData.peers.size });

        for (const peer of roomData.peers) {
            if (peer.readyState === WebSocket.OPEN) {
                peer.send(JSON.stringify({ type: 'PEER_LEFT' }));
            }
        }

        // If all peers left, start a 2-minute grace timer instead of immediate destruction
        if (roomData.peers.size === 0) {
            logger.info('Room is empty. Starting 2-minute expiration grace period', { roomId });
            
            if (roomData.cleanupTimer) {
                clearTimeout(roomData.cleanupTimer);
            }

            roomData.cleanupTimer = setTimeout(() => {
                if (rooms.has(roomId)) {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom.peers.size === 0) {
                        rooms.delete(roomId);
                        logger.info('Room deleted due to expiration grace period timeout', { roomId });
                    }
                }
            }, 120000); // 2 minutes
        }
    }

    clientRooms.delete(ws);
    clientIps.delete(ws);
}

export function setupHeartbeat(wss) {
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                logger.warn('Terminating inactive WebSocket client');
                handleDisconnect(ws);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });
}