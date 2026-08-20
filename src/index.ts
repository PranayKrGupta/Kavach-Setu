import express from 'express';
import cors from 'cors';
import path from 'path';
import { env, validateEnv } from './config/env';
import { connectMongo } from './config/database';
import { errorHandler } from './middlewares/errorHandler';

import authRoutes from './routes/auth';
import endpointRoutes from './routes/endpoints';
import proxyRoutes from './routes/proxy';
import metricsRoutes from './routes/metrics';
import dataRoutes from './routes/data';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';

validateEnv();

const app = express();

app.disable('x-powered-by');

// Basic Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Core Proxy Engine Gateway Route
app.use('/proxy', proxyRoutes);

// API Route Mappings
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/endpoints', endpointRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint for cloud monitoring & uptime probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// Fallback to index.html for non-API / non-proxy client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/proxy') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized Error Handling Middleware (must be registered after routes)
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  await connectMongo();
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[Kavach Setu v2.0.0] Server running on http://0.0.0.0:${env.PORT}`);
  });
};

startServer();
