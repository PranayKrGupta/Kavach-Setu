import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { RequestLog } from '../models/RequestLog';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface TierConfigCache {
  requestLimit: number;
  windowMs: number;
  expiresAt: number;
}

const tierCache = new Map<string, TierConfigCache>();

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const rawKey = req.headers['x-api-key'] as string;
  if (!rawKey) {
    return res.status(401).json({ error: 'x-api-key header is required' });
  }

  try {
    const parts = rawKey.split('.');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }
    const [keyId, secret] = parts;

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { user: true }
    });

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (apiKeyRecord.user.isBanned) {
      return res.status(403).json({ error: 'Forbidden: User is banned' });
    }

    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const isValid = hash === apiKeyRecord.keyHash;

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const tier = apiKeyRecord.user.tier;
    let limit = 60; // Default fallback
    let windowMs = 60000;

    const now = Date.now();
    let cachedTier = tierCache.get(tier);

    if (!cachedTier || cachedTier.expiresAt < now) {
      const dbConfig = await prisma.tierConfig.findUnique({ where: { tierName: tier } });
      if (dbConfig) {
        cachedTier = {
          requestLimit: dbConfig.requestLimit,
          windowMs: dbConfig.windowMs,
          expiresAt: now + 5 * 60 * 1000 // 5 minutes
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
      return res.status(429).json({ error: 'Too Many Requests (Rate Limit Exceeded)' });
    }

    // Update lastUsed asynchronously to save time
    prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsed: new Date() }
    }).catch(err => console.error('Error updating lastUsed:', err));

    res.on('finish', () => {
      if (res.statusCode !== 429) {
         RequestLog.create({
          apiKeyId: keyId,
          endpoint: req.originalUrl,
          status: res.statusCode,
          timestamp: new Date()
        }).catch(err => console.error('Failed to log request:', err));
      }
    });

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
