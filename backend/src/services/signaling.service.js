import crypto from 'crypto';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { validateSignalingMessage } from '../utils/validator.js';
import { checkRateLimit } from '../middleware/rateLimit.middleware.js';

const rooms = new Map(); // roomId -> Set of WebSocket clients
const clientRooms = new Map(); // WebSocket client -> roomId
const clientIps = new Map(); // WebSocket client -> IP string
const roomCleanupTimers = new Map(); // roomId -> setTimeout handle for grace period

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
            handleJoinRoom(ws, message.roomId);
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
    
    // If a cleanup timer existed for this randomly generated room ID, clear it
    if (roomCleanupTimers.has(roomId)) {
        clearTimeout(roomCleanupTimers.get(roomId));
        roomCleanupTimers.delete(roomId);
    }

    rooms.set(roomId, new Set([ws]));
    clientRooms.set(ws, roomId);

    logger.info('Room created successfully', { roomId });
    ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomId }));
}

function handleJoinRoom(ws, roomId) {
    const upperRoomId = roomId ? roomId.toUpperCase() : '';
    if (!upperRoomId || !rooms.has(upperRoomId)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Room does not exist or has expired' }));
        return;
    }

    const room = rooms.get(upperRoomId);
    if (room.size >= 2) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full (maximum 2 peers allowed)' }));
        return;
    }

    // Cancel the room destruction grace timer since someone is joining!
    if (roomCleanupTimers.has(upperRoomId)) {
        clearTimeout(roomCleanupTimers.get(upperRoomId));
        roomCleanupTimers.delete(upperRoomId);
        logger.info('Cancelled room expiration grace timer', { roomId: upperRoomId });
    }

    handleDisconnect(ws);

    room.add(ws);
    clientRooms.set(ws, upperRoomId);

    logger.info('Peer joined room', { roomId: upperRoomId, roomSize: room.size });
    ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomId: upperRoomId }));

    // Notify existing peer in room using correct WebSocket.OPEN constant
    for (const peer of room) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'PEER_JOINED' }));
            logger.info('Dispatched PEER_JOINED to host', { roomId: upperRoomId });
        }
    }
}

function relayToPeer(ws, message) {
    const roomId = clientRooms.get(ws);
    if (!roomId || !rooms.has(roomId)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Not assigned to an active room' }));
        return;
    }

    const room = rooms.get(roomId);
    for (const peer of room) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify(message));
        }
    }
}

function handleDisconnect(ws) {
    const roomId = clientRooms.get(ws);
    if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(ws);

        logger.info('Peer left room', { roomId, remainingPeers: room.size });

        for (const peer of room) {
            if (peer.readyState === WebSocket.OPEN) {
                peer.send(JSON.stringify({ type: 'PEER_LEFT' }));
            }
        }

        // Instead of immediate deletion, start a 2-minute (120,000ms) grace period timer
        if (room.size === 0) {
            logger.info('Room is empty. Starting 2-minute expiration grace period', { roomId });
            
            if (roomCleanupTimers.has(roomId)) {
                clearTimeout(roomCleanupTimers.get(roomId));
            }

            const timer = setTimeout(() => {
                if (rooms.has(roomId)) {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom.size === 0) {
                        rooms.delete(roomId);
                        logger.info('Room deleted due to expiration grace period timeout', { roomId });
                    }
                }
                roomCleanupTimers.delete(roomId);
            }, 120000); // 2 minutes

            roomCleanupTimers.set(roomId, timer);
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