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

export default app;
