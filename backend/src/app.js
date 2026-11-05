import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/server.config.js';
import apiRoutes from './routes/api.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(helmet());
app.use(cors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10kb' }));

app.use('/api', apiRoutes);

app.use(errorHandler);

export default app;