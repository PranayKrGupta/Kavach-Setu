import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RequestLog } from '../models/RequestLog';
import { AppError } from '../utils/appError';
import { ApiResponse } from '../utils/apiResponse';

/**
 * POST /api/keys: Generate new API Key
 */
export async function generateApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, isBanned: true, _count: { select: { apiKeys: true } } }
  });

  if (!user) throw new AppError('User not found', 404);
  if (user.isBanned) {
    throw new AppError('Your account is banned. You cannot generate API keys.', 403);
  }

  const tierConfig = await prisma.tierConfig.findUnique({
    where: { tierName: user.tier }
  });

  const maxKeys = tierConfig?.maxApiKeys ?? 2;
  if (user._count.apiKeys >= maxKeys) {
    throw new AppError(
      `You have reached the maximum number of API keys (${maxKeys}) for the ${user.tier} tier.`,
      403
    );
  }

  const id = crypto.randomUUID();
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const fullKey = `${id}.${rawSecret}`;

  await prisma.apiKey.create({
    data: {
      id,
      key: fullKey,
      keyHash,
      userId
    }
  });

  ApiResponse.success(
    res,
    { key: fullKey },
    201,
    'API Key generated successfully.'
  );
}

/**
 * GET /api/keys: List user's API Keys
 */
export async function listApiKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, key: true, createdAt: true, lastUsed: true },
    orderBy: { createdAt: 'desc' }
  });

  ApiResponse.success(res, { keys });
}

/**
 * GET /api/keys/:id/logs: Fetch detailed request logs for an API key
 */
export async function getApiKeyLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId }
  });

  if (!apiKey) {
    throw new AppError('API Key not found or unauthorized', 404);
  }

  const totalRequests = await RequestLog.countDocuments({ apiKeyId: id });
  const successCount = await RequestLog.countDocuments({
    apiKeyId: id,
    status: { $gte: 200, $lt: 300 }
  });
  const rateLimitedCount = await RequestLog.countDocuments({
    apiKeyId: id,
    status: 429
  });

  const logs = await RequestLog.find({ apiKeyId: id })
    .sort({ timestamp: -1 })
    .limit(100)
    .select('endpoint status timestamp')
    .lean();

  ApiResponse.success(res, {
    apiKey: {
      id: apiKey.id,
      key: apiKey.key || apiKey.id,
      createdAt: apiKey.createdAt,
      lastUsed: apiKey.lastUsed
    },
    stats: {
      totalRequests,
      successCount,
      rateLimitedCount
    },
    logs
  });
}

/**
 * DELETE /api/keys/:id: Revoke/delete an API Key
 */
export async function deleteApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;

  const result = await prisma.apiKey.deleteMany({
    where: { id, userId }
  });

  if (result.count === 0) {
    throw new AppError('API Key not found or unauthorized', 404);
  }

  ApiResponse.success(res, null, 200, 'API Key deleted successfully');
}
