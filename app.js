import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import notificationRoutes, { limiter as logsLimiter } from './routers/notificationRoutes.js';

app.set('trust proxy', true);

export default app;
