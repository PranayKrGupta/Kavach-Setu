import { PrismaClient } from '@prisma/client';
import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';

export const prisma = new PrismaClient();

export const connectMongo = async (): Promise<void> => {
  try {
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch {
      // Ignore DNS server override errors on containerized cloud runtimes (e.g. Render)
    }

    await mongoose.connect(env.MONGO_URI);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
