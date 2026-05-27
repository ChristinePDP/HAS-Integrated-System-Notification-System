import express from 'express';
import rateLimiter from '../middleware/rateLimiter.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { processNotification, getNotificationLogs } from '../controllers/notificationController.js';

const router = express.Router();

export const limiter = rateLimiter();

router.post('/notify', authMiddleware, processNotification);

router.get('/notification-logs', limiter, authMiddleware, getNotificationLogs);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Notification service is running',
    timestamp: new Date()
  });
});


export default router;

