import { prisma } from '../config/database';
import { AppError } from './appError';

/**
 * Ensures that the last remaining system admin cannot be demoted, banned, or deleted.
 */
export async function checkLastAdmin(targetUserId: string): Promise<void> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true }
  });

  if (targetUser && targetUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });
    if (adminCount <= 1) {
      throw new AppError('Cannot demote, ban, or delete the last remaining admin.', 403);
    }
  }
}
