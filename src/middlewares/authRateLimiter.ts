import { Request, Response, NextFunction } from 'express';

interface RequestBucket {
  count: number;
  resetTime: number;
}

const ipBuckets = new Map<string, RequestBucket>();

// Periodic cleanup of stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (now > bucket.resetTime) {
      ipBuckets.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates an in-memory sliding rate limiter middleware for sensitive auth routes
 * @param maxRequests Maximum allowed requests per window
 * @param windowMs Time window in milliseconds
 * @param actionName Label for rate limit message
 */
export function createAuthRateLimiter(
  maxRequests: number = 10,
  windowMs: number = 60000,
  actionName: string = 'requests'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    let bucket = ipBuckets.get(ip);
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + windowMs };
      ipBuckets.set(ip, bucket);
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSec = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        status: 'fail',
        error: 'Too Many Requests',
        message: `Too many ${actionName} from your IP. Please try again in ${retryAfterSec} seconds.`
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}

export const authLoginLimiter = createAuthRateLimiter(15, 60000, 'login attempts');
export const authOtpLimiter = createAuthRateLimiter(5, 60000, 'verification requests');
