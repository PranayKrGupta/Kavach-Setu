import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RequestLog } from '../models/RequestLog';
import { AppError } from '../utils/appError';
import { ApiResponse } from '../utils/apiResponse';

/**
 * GET /api/metrics: Fetch 5-hour usage metrics for user's proxy endpoints
 */
export async function getMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { endpointId, proxySlug } = req.query;

  const endpoints = await prisma.proxyEndpoint.findMany({
    where: { userId },
    select: { id: true, proxySlug: true }
  });
  const allSlugs = endpoints.map(e => e.proxySlug);

  if (allSlugs.length === 0) {
    ApiResponse.success(res, { data: [] });
    return;
  }

  let targetSlugs = allSlugs;
  const filterKey = (endpointId || proxySlug) as string | undefined;
  if (filterKey && typeof filterKey === 'string' && filterKey !== 'ALL') {
    const matched = endpoints.find(e => e.id === filterKey || e.proxySlug === filterKey);
    if (!matched) {
      throw new AppError('Unauthorized endpoint access', 403);
    }
    targetSlugs = [matched.proxySlug];
  }

  const fiveHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const logs = await RequestLog.find({
    proxySlug: { $in: targetSlugs },
    timestamp: { $gte: fiveHoursAgo }
  })
    .select('status timestamp proxySlug')
    .sort({ timestamp: 1 })
    .lean();

  ApiResponse.success(res, { data: logs });
}
