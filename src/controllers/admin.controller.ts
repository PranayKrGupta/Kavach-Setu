import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { Tier, Role } from '@prisma/client';
import { AppError, ApiResponse, checkLastAdmin } from '../utils';

/**
 * GET /api/admin/users
 */
export async function getAllUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      tier: true,
      role: true,
      isBanned: true,
      createdAt: true,
      _count: {
        select: { proxyEndpoints: true }
      }
    }
  });

  const formattedUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    tier: u.tier,
    role: u.role,
    isBanned: u.isBanned,
    createdAt: u.createdAt,
    endpointsCount: u._count.proxyEndpoints
  }));

  ApiResponse.success(res, { users: formattedUsers });
}

/**
 * PATCH /api/admin/users/:id/ban
 */
export async function toggleUserBan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { isBanned } = req.body;

  if (typeof isBanned !== 'boolean') {
    throw new AppError('isBanned must be a boolean', 400);
  }

  if (isBanned) {
    await checkLastAdmin(id);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { 
      isBanned,
      ...(isBanned ? { role: 'USER' } : {}) 
    },
    select: { id: true, email: true, isBanned: true, role: true }
  });

  ApiResponse.success(
    res,
    { user },
    200,
    `User ${user.isBanned ? 'banned (and demoted if Admin)' : 'unbanned'} successfully`
  );
}

/**
 * PATCH /api/admin/users/:id/role
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'ADMIN' && role !== 'USER') {
    throw new AppError('Invalid role', 400);
  }

  if (role === 'USER') {
    await checkLastAdmin(id);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: { id: true, email: true, role: true }
  });

  ApiResponse.success(res, { user }, 200, 'User role updated successfully');
}

/**
 * PATCH /api/admin/users/:id/tier
 */
export async function updateUserTier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { tier } = req.body;

  if (!Object.values(Tier).includes(tier as Tier)) {
    throw new AppError('Invalid tier', 400);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { tier: tier as Tier },
    select: { id: true, email: true, tier: true }
  });

  ApiResponse.success(res, { user }, 200, 'User tier updated successfully');
}

/**
 * GET /api/admin/config/tiers
 */
export async function getTierConfigs(_req: Request, res: Response): Promise<void> {
  const configs = await prisma.tierConfig.findMany({
    orderBy: { maxTierLimit: 'asc' }
  });

  ApiResponse.success(res, { configs });
}

/**
 * PATCH /api/admin/config/tiers/:id
 */
export async function updateTierConfig(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { maxTierLimit, maxEndpoints } = req.body;

  const config = await prisma.tierConfig.update({
    where: { id },
    data: {
      ...(maxTierLimit !== undefined && { maxTierLimit: Number(maxTierLimit) }),
      ...(maxEndpoints !== undefined && { maxEndpoints: Number(maxEndpoints) })
    }
  });

  ApiResponse.success(res, { config }, 200, 'Tier config updated successfully');
}
