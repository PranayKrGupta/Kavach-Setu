import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { RequestLog } from '../models/RequestLog';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TIER_LIMITS = {
  FREE: 60, // 60 requests per minute
  PRO: 1000 // 1000 requests per minute
};

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

    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const isValid = hash === apiKeyRecord.keyHash;

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const tier = apiKeyRecord.user.tier as 'FREE' | 'PRO';
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const requestCount = await RequestLog.countDocuments({
      apiKeyId: keyId,
      timestamp: { $gte: oneMinuteAgo }
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
