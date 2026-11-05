import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'privora-signaling-backend',
        timestamp: new Date().toISOString()
    });
});

export default router;