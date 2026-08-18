import express from 'express';
import cors from 'cors';
import path from 'path';
import { env, validateEnv } from './config/env';
import { connectMongo } from './config/database';
import { errorHandler } from './middlewares/errorHandler';

import authRoutes from './routes/auth';
import apiKeyRoutes from './routes/apiKeys';
import metricsRoutes from './routes/metrics';
import dataRoutes from './routes/data';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';

validateEnv();

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Route Mappings
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);

// Fallback to index.html for non-API client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized Error Handling Middleware (must be registered after routes)
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  await connectMongo();
  app.listen(env.PORT, () => {
    console.log(`[Kavach Setu] Server running on http://localhost:${env.PORT}`);
  });
};

startServer();
