import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

router.post('/register', async (req, res) => {
  const { email, password, tier } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          tier: tier === 'PRO' ? 'PRO' : 'FREE'
        }
      });

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, email: user.email, tier: user.tier, role: user.role } });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'User already exists' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, tier: user.tier, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tiers', async (req, res) => {
  try {
    const configs = await prisma.tierConfig.findMany({
      orderBy: { requestLimit: 'asc' }
    });
    res.json({ configs });
  } catch (err) {
    console.error('Fetch public tiers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
