import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RequestLog } from '../models/RequestLog';
import { AppError } from '../utils/appError';
import { ApiResponse } from '../utils/apiResponse';

/**
 * GET /api/metrics: Fetch 5-hour usage metrics
 */
export async function getMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { apiKeyId } = req.query;

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true }
  });
  const keyIds = apiKeys.map(k => k.id);

  if (keyIds.length === 0) {
    ApiResponse.success(res, { data: [] });
    return;
  }

  let targetKeyIds = keyIds;
  if (apiKeyId && typeof apiKeyId === 'string' && apiKeyId !== 'ALL') {
    if (!keyIds.includes(apiKeyId)) {
      throw new AppError('Unauthorized key access', 403);
    }
    targetKeyIds = [apiKeyId];
  }

  const fiveHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const logs = await RequestLog.find({
    apiKeyId: { $in: targetKeyIds },
    timestamp: { $gte: fiveHoursAgo }
  })
    .select('status timestamp apiKeyId')
    .sort({ timestamp: 1 })
    .lean();

  ApiResponse.success(res, { data: logs });
}
