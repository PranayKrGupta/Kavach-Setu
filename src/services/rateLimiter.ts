export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * High-Performance In-Memory Sliding Window Rate Limiter
 * Provides sub-millisecond atomic reservation and eliminates TOCTOU race conditions.
 */
export class SlidingWindowRateLimiter {
  private windows: Map<string, number[]> = new Map();

  constructor() {
    // Periodic garbage collection to keep memory near zero
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Atomically checks rate limit and consumes a token if within allowance.
   *
   * @param key Unique identifier (e.g., proxySlug or client IP)
   * @param limit Maximum allowed requests per window
   * @param windowMs Time window in milliseconds (default 60000ms = 1 min)
   */
  public checkAndConsume(
    key: string,
    limit: number,
    windowMs: number = 60000
  ): RateLimitCheckResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Filter out expired timestamps outside the current sliding window
    const activeTimestamps = timestamps.filter(ts => ts > windowStart);
    this.windows.set(key, activeTimestamps);

    const currentCount = activeTimestamps.length;
    const earliestTimestamp = activeTimestamps[0] ?? now;
    const resetMs = Math.max(0, earliestTimestamp + windowMs - now);

    if (currentCount >= limit) {
      return {
        allowed: false,
        currentCount,
        limit,
        remaining: 0,
        resetMs
      };
    }

    // Atomically reserve token for this request
    activeTimestamps.push(now);

    return {
      allowed: true,
      currentCount: activeTimestamps.length,
      limit,
      remaining: Math.max(0, limit - activeTimestamps.length),
      resetMs
    };
  }

  /**
   * Reset rate limit state for a specific key
   */
  public reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Purge expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter(ts => ts > now - 120000);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

// Global Singleton Rate Limiter Instance
export const rateLimiter = new SlidingWindowRateLimiter();
