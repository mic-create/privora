import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
    logger.error('Express unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
}