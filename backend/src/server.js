import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import { config } from './config/server.config.js';
import { logger } from './utils/logger.js';
import { handleSignalingConnection, setupHeartbeat } from './services/signaling.service.js';

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    handleSignalingConnection(ws, req);
});

setupHeartbeat(wss);

const PORT = config.port;
server.listen(PORT, () => {
    logger.info(`PRIVORA signaling backend running on port ${PORT} in ${config.nodeEvn} mode`);
});

// Graceful Shutdown
const shutdown = () => {
    logger.info('Shutting down signaling server gracefully...');
    wss.clients.forEach((client) => {
        client.terminate();
    });
    server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);