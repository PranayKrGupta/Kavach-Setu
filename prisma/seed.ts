import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import { RequestLog } from '../src/models/RequestLog';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Reset & Seed Starting ---');

  // 1. Connect and clear MongoDB logs
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kavach-setu';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const deletedLogs = await RequestLog.deleteMany({});
    console.log(`Cleared ${deletedLogs.deletedCount} old request logs from MongoDB.`);
  } catch (err) {
    console.error('Error clearing MongoDB:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  // 2. Clear old PostgreSQL data
  console.log('Clearing PostgreSQL data...');
  const deletedKeys = await prisma.apiKey.deleteMany({});
  console.log(`Deleted ${deletedKeys.count} old API keys.`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`Deleted ${deletedUsers.count} old users.`);

  const deletedTiers = await prisma.tierConfig.deleteMany({});
  console.log(`Deleted ${deletedTiers.count} old tier configs.`);

  // 3. Seed fresh Dynamic Tier Configurations as per current policies
  console.log('Seeding fresh tier configurations...');
  await prisma.tierConfig.createMany({
    data: [
      {
        tierName: 'FREE',
        requestLimit: 60,
        windowMs: 60000, // 1 minute
        maxApiKeys: 2
      },
      {
        tierName: 'PRO',
        requestLimit: 1000,
        windowMs: 60000, // 1 minute
        maxApiKeys: 5
      }
    ]
  });
  console.log('Created default tier configurations (FREE & PRO).');

  // 4. Seed Default Admin User
  console.log('Creating default Admin user...');
  const adminEmail = 'admin@kavachsetu.local';
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      tier: 'PRO'
    }
  });
  console.log(`Default admin created: ${admin.email} (Password: admin123, Role: ${admin.role}, Tier: ${admin.tier})`);

  console.log('--- Database Reset & Seed Completed Successfully ---');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
