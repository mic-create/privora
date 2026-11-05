import { config } from '../config/server.config.js';
import { logger } from '../utils/logger.js';

const requestCounts = new Map();

// Clean up rate limit counters periodically
setInterval(() => {
    requestCounts.clear();
}, config.rateLimitWindowMs);

export function checkRateLimit(ip) {
    const currentCount = requestCounts.get(ip) || 0;
    if (currentCount >= config.rateLimitMaxRequests) {
        logger.warn('Rate limit exceeded', { ip });
        return false;
    }
    requestCounts.set(ip, currentCount + 1);
    return true;
}