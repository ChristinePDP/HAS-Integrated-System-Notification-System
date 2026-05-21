import express from 'express';
import { rateLimiter } from '../middleware/rateLimiter.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

export const limiter = rateLimiter();

router.post('/notify', authMiddleware, processNotification);

export default router;

