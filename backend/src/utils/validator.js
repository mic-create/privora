import { config } from '../config/server.config.js';

export function validateSignalingMessage(rawMessage) {
    if (typeof rawMessage !== 'string') {
        return { valid: false, error: 'Message must be a string' };
    }

    if (rawMessage.length > config.maxPayloadSize) {
        return { valid: false, error: 'Message payload exceeds maximum allowed size' };
    }

    let parsed;
    try {
        parsed = JSON.parse(rawMessage);
    } catch (err) {
        return { valid: false, error: 'Malformed JSON payload' };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'Message must be a JSON object' };
    }

    const { type, roomId } = parsed;

    if (!type || typeof type !== 'string') {
        return { valid: false, error: 'Missing or invalid message type' };
    }

    const validTypes = [
        'CREATE_ROOM',
        'JOIN_ROOM',
        'RTC_OFFER',
        'RTC_ANSWER',
        'ICE_CANDIDATE',
        'LEAVE_ROOM',
        'PING',
        'PONG'
    ];

    if (!validTypes.includes(type)) {
        return { valid: false, error: `Unsupported message type: ${type}` };
    }

    if (roomId !== undefined) {
        if (typeof roomId !== 'string' || roomId.length < 4 || roomId.length > 16) {
            return { valid: false, error: 'Invalid room identifier format' };
        }
    }

    return { valid: true, data: parsed };
}