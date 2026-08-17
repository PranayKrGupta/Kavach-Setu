import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Seed Dynamic Tier Configurations
  await prisma.tierConfig.upsert({
    where: { tierName: 'FREE' },
    update: { maxApiKeys: 2 },
    create: {
      tierName: 'FREE',
      requestLimit: 60,
      windowMs: 60000, // 1 minute
      maxApiKeys: 2
    }
  });

  await prisma.tierConfig.upsert({
    where: { tierName: 'PRO' },
    update: { maxApiKeys: 5 },
    create: {
      tierName: 'PRO',
      requestLimit: 1000,
      windowMs: 60000, // 1 minute
      maxApiKeys: 5
    }
  });

  // 2. Seed Default Admin User
  const adminEmail = 'admin@apigateway.local';
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      tier: 'PRO'
    }
  });

  console.log('Database seeded successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
