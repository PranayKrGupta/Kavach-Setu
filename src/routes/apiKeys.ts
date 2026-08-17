import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, isBanned: true, _count: { select: { apiKeys: true } } }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isBanned) return res.status(403).json({ error: 'Your account is banned. You cannot generate API keys.' });

    const tierConfig = await prisma.tierConfig.findUnique({
      where: { tierName: user.tier }
    });

    const maxKeys = tierConfig?.maxApiKeys ?? 2;

    if (user._count.apiKeys >= maxKeys) {
      return res.status(403).json({ error: `You have reached the maximum number of API keys (${maxKeys}) for the ${user.tier} tier.` });
    }

    const rawSecret = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        userId
      }
    });

    // The user will only see this once
    const fullKey = `${apiKey.id}.${rawSecret}`;
    res.json({ key: fullKey, message: 'Store this key safely. It will not be shown again.' });
  } catch (error) {
    console.error('API Key generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, createdAt: true, lastUsed: true }
    });
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const result = await prisma.apiKey.deleteMany({
      where: {
        id,
        userId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'API Key not found or unauthorized' });
    }

    res.json({ message: 'API Key deleted successfully' });
  } catch (error) {
    console.error('API Key deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
