import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import notificationRoutes, { limiter as logsLimiter } from './routers/notificationRoutes.js';

app.set('trust proxy', true);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

await connectDB();

app.use('/api', notificationRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'Notification Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: [
      'GET /health - Service health check',
      'POST /api/notify - Process a notification',
      'GET /api/notification-logs - Retrieve notification logs',
      'GET /api/health - API health check'
    ]
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

app.use((err, req, res, next) => {

  console.error('Error:', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  // Prepare error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  };

 
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.stack;
  }

  res.status(err.status || 500).json(errorResponse);
});

export default app;
