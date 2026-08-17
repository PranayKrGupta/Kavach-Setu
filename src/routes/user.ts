import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Secure all user account routes
router.use(authenticateToken);

// GET /api/user/me: Fetch current user's profile
router.get('/me', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true, role: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Fetch user me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/user/email: Update user email
router.patch('/email', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newEmail } = req.body;

  if (!currentPassword || !newEmail) {
    return res.status(400).json({ error: 'currentPassword and newEmail are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Incorrect current password' });

    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) return res.status(400).json({ error: 'Email is already in use' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
      select: { id: true, email: true, tier: true, role: true }
    });

    res.json({ message: 'Email updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/user/password: Update user password
router.patch('/password', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Incorrect current password' });

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function checkLastAdmin(targetUserId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true }
  });

  if (targetUser && targetUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });
    if (adminCount <= 1) {
      throw new Error('Cannot demote, ban, or delete the last remaining admin.');
    }
  }
}

// DELETE /api/user/account: Delete account and all API keys
router.delete('/account', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'currentPassword is required to delete account' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Incorrect current password' });

    // Protect last admin
    await checkLastAdmin(userId);

    // Use Prisma transaction to delete API keys first, then the user.
    await prisma.$transaction([
      prisma.apiKey.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);

    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('last remaining admin')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
