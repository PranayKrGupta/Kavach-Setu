import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RequestLog } from '../models/RequestLog';
import { AppError, ApiResponse, validateSafeTargetUrl } from '../utils';

/**
 * POST /api/endpoints: Create a new Proxy Endpoint
 */
export async function createEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { targetUrl, customRateLimit } = req.body;

  const urlValidation = validateSafeTargetUrl(targetUrl);
  if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
    throw new AppError(urlValidation.error || 'A valid public target URL (http:// or https://) is required', 400);
  }

  const rateLimitNum = parseInt(customRateLimit, 10);
  if (isNaN(rateLimitNum) || rateLimitNum < 1) {
    throw new AppError('Rate limit must be a positive integer (minimum 1 request/min)', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tier: true,
      isBanned: true,
      _count: { select: { proxyEndpoints: true } }
    }
  });

  if (!user) throw new AppError('User not found', 404);
  if (user.isBanned) {
    throw new AppError('Your account is suspended. You cannot create proxy endpoints.', 403);
  }

  const tierConfig = await prisma.tierConfig.findUnique({
    where: { tierName: user.tier }
  });

  const maxEndpoints = tierConfig?.maxEndpoints ?? 3;
  const maxTierLimit = tierConfig?.maxTierLimit ?? 60;

  if (user._count.proxyEndpoints >= maxEndpoints) {
    throw new AppError(
      `You have reached the maximum number of proxy endpoints (${maxEndpoints}) for the ${user.tier} tier.`,
      403
    );
  }

  if (rateLimitNum > maxTierLimit) {
    throw new AppError(
      `The maximum allowed rate limit for your ${user.tier} plan is ${maxTierLimit} requests/min.`,
      400
    );
  }

  // Generate unique 8-character hex slug
  let proxySlug = crypto.randomBytes(4).toString('hex');
  let slugExists = await prisma.proxyEndpoint.findUnique({ where: { proxySlug } });
  while (slugExists) {
    proxySlug = crypto.randomBytes(4).toString('hex');
    slugExists = await prisma.proxyEndpoint.findUnique({ where: { proxySlug } });
  }

  const endpoint = await prisma.proxyEndpoint.create({
    data: {
      userId,
      targetUrl: urlValidation.normalizedUrl,
      proxySlug,
      customRateLimit: rateLimitNum,
      windowMs: 60000,
      active: true
    }
  });

  ApiResponse.success(
    res,
    { endpoint },
    201,
    'Proxy endpoint created successfully.'
  );
}

/**
 * GET /api/endpoints: List user's Proxy Endpoints
 */
export async function listEndpoints(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const endpoints = await prisma.proxyEndpoint.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  ApiResponse.success(res, { endpoints });
}

/**
 * GET /api/endpoints/:id/logs: Fetch detailed request logs & statistics for an endpoint
 */
export async function getEndpointLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;

  const endpoint = await prisma.proxyEndpoint.findFirst({
    where: { id, userId }
  });

  if (!endpoint) {
    throw new AppError('Proxy endpoint not found or unauthorized', 404);
  }

  const totalRequests = await RequestLog.countDocuments({ proxySlug: endpoint.proxySlug });
  const successCount = await RequestLog.countDocuments({
    proxySlug: endpoint.proxySlug,
    status: { $gte: 200, $lt: 300 }
  });
  const rateLimitedCount = await RequestLog.countDocuments({
    proxySlug: endpoint.proxySlug,
    status: 429
  });

  const logs = await RequestLog.find({ proxySlug: endpoint.proxySlug })
    .sort({ timestamp: -1 })
    .limit(100)
    .select('endpoint method status timestamp')
    .lean();

  ApiResponse.success(res, {
    endpoint,
    stats: {
      totalRequests,
      successCount,
      rateLimitedCount
    },
    logs
  });
}

/**
 * PATCH /api/endpoints/:id/toggle: Toggle endpoint active status
 */
export async function toggleEndpointActive(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;

  const endpoint = await prisma.proxyEndpoint.findFirst({
    where: { id, userId }
  });

  if (!endpoint) {
    throw new AppError('Proxy endpoint not found or unauthorized', 404);
  }

  const updated = await prisma.proxyEndpoint.update({
    where: { id },
    data: { active: !endpoint.active }
  });

  ApiResponse.success(
    res,
    { endpoint: updated },
    200,
    `Endpoint ${updated.active ? 'activated' : 'paused'} successfully.`
  );
}

/**
 * DELETE /api/endpoints/:id: Delete a Proxy Endpoint
 */
export async function deleteEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;

  const endpoint = await prisma.proxyEndpoint.findFirst({
    where: { id, userId }
  });

  if (!endpoint) {
    throw new AppError('Proxy endpoint not found or unauthorized', 404);
  }

  await prisma.proxyEndpoint.delete({
    where: { id }
  });

  // Background cleanup of MongoDB request logs
  RequestLog.deleteMany({ proxySlug: endpoint.proxySlug }).catch(() => {});

  ApiResponse.success(res, null, 200, 'Proxy endpoint deleted successfully');
}
