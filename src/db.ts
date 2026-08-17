import { PrismaClient } from '@prisma/client';
import dns from 'dns';
import mongoose from 'mongoose';

export const prisma = new PrismaClient();

export const connectMongo = async () => {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/api-gateway';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
