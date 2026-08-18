import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { RequestLog } from '../models/RequestLog';
import { TierConfigCache } from '../types';
import { AppError } from '../utils/appError';

const tierCache = new Map<string, TierConfigCache>();

export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return next(new AppError('x-api-key header is required', 401));
  }

  try {
    const parts = rawKey.split('.');
    if (parts.length !== 2) {
      return next(new AppError('Invalid API key format', 401));
    }
    const [keyId, secret] = parts;

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { user: true }
    });

    if (!apiKeyRecord) {
      return next(new AppError('Invalid API key', 401));
    }

    if (apiKeyRecord.user.isBanned) {
      return next(new AppError('Forbidden: User is banned', 403));
    }

    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const isValid = hash === apiKeyRecord.keyHash;

    if (!isValid) {
      return next(new AppError('Invalid API key', 401));
    }

    const tier = apiKeyRecord.user.tier;
    let limit = 60;
    let windowMs = 60000;

    const now = Date.now();
    let cachedTier = tierCache.get(tier);

    if (!cachedTier || cachedTier.expiresAt < now) {
      const dbConfig = await prisma.tierConfig.findUnique({ where: { tierName: tier } });
      if (dbConfig) {
        cachedTier = {
          requestLimit: dbConfig.requestLimit,
          windowMs: dbConfig.windowMs,
          expiresAt: now + 5 * 60 * 1000 // 5 minutes cache TTL
        };
        tierCache.set(tier, cachedTier);
      }
    }

    if (cachedTier) {
      limit = cachedTier.requestLimit;
      windowMs = cachedTier.windowMs;
    }

    const windowStart = new Date(now - windowMs);

    const requestCount = await RequestLog.countDocuments({
      apiKeyId: keyId,
      timestamp: { $gte: windowStart }
    });

    if (requestCount >= limit) {
      await RequestLog.create({
        apiKeyId: keyId,
        endpoint: req.originalUrl,
        status: 429,
        timestamp: new Date()
      });
      return next(new AppError('Too Many Requests (Rate Limit Exceeded)', 429));
    }

    // Update lastUsed asynchronously
    prisma.apiKey
      .update({
        where: { id: keyId },
        data: { lastUsed: new Date() }
      })
      .catch(() => {
        // Non-blocking background update
      });

    res.on('finish', () => {
      if (res.statusCode !== 429) {
        RequestLog.create({
          apiKeyId: keyId,
          endpoint: req.originalUrl,
          status: res.statusCode,
          timestamp: new Date()
        }).catch(() => {
          // Non-blocking background log
        });
      }
    });

    next();
  } catch (error) {
    next(error);
  }
};
