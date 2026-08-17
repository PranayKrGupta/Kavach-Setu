import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';
import { Tier } from '@prisma/client';

const router = Router();

// Secure all admin routes
router.use(authenticateToken, isAdmin);

// GET /api/admin/users: Fetch all users (excluding passwords) + API keys count
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        tier: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: { apiKeys: true }
        }
      }
    });

    // Flatten the _count to apiKeysCount for easier consumption on frontend
    const formattedUsers = users.map(u => ({
      ...u,
      apiKeysCount: u._count.apiKeys,
      _count: undefined
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Admin Fetch Users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id/ban: Toggle isBanned
router.patch('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  const { isBanned } = req.body;

  if (typeof isBanned !== 'boolean') {
    return res.status(400).json({ error: 'isBanned must be a boolean' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned },
      select: { id: true, email: true, isBanned: true }
    });
    res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'} successfully`, user });
  } catch (error) {
    console.error('Admin Ban User error:', error);
    res.status(500).json({ error: 'Internal server error (User may not exist)' });
  }
});

// PATCH /api/admin/users/:id/tier: Update tier
router.patch('/users/:id/tier', async (req, res) => {
  const { id } = req.params;
  const { tier } = req.body;

  if (!Object.values(Tier).includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { tier },
      select: { id: true, email: true, tier: true }
    });
    res.json({ message: 'User tier updated successfully', user });
  } catch (error) {
    console.error('Admin Update Tier error:', error);
    res.status(500).json({ error: 'Internal server error (User may not exist)' });
  }
});

// GET /api/admin/config/tiers: Fetch configurations
router.get('/config/tiers', async (req, res) => {
  try {
    const configs = await prisma.tierConfig.findMany({
      orderBy: { requestLimit: 'asc' }
    });
    res.json({ configs });
  } catch (error) {
    console.error('Admin Fetch Tiers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/config/tiers/:id: Update tier config
router.patch('/config/tiers/:id', async (req, res) => {
  const { id } = req.params;
  const { requestLimit, windowMs } = req.body;

  try {
    const config = await prisma.tierConfig.update({
      where: { id },
      data: {
        ...(requestLimit !== undefined && { requestLimit: Number(requestLimit) }),
        ...(windowMs !== undefined && { windowMs: Number(windowMs) })
      }
    });
    res.json({ message: 'Tier config updated successfully', config });
  } catch (error) {
    console.error('Admin Update Tier Config error:', error);
    res.status(500).json({ error: 'Internal server error (Config may not exist)' });
  }
});

export default router;
