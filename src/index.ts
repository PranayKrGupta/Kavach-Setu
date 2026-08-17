import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectMongo } from './db';

import authRoutes from './routes/auth';
import apiKeyRoutes from './routes/apiKeys';
import metricsRoutes from './routes/metrics';
import dataRoutes from './routes/data';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/data', dataRoutes); // The protected route
app.use('/api/admin', adminRoutes); // Admin routes

// Fallback to index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const startServer = async () => {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
