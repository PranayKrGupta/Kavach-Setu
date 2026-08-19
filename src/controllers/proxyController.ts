import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { RequestLog } from '../models/RequestLog';
import { rateLimiter } from '../services/rateLimiter';
import { validateSafeTargetUrl } from '../utils/ssrfValidator';

const EXCLUDED_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'transfer-encoding',
  'cf-ray',
  'cf-connecting-ip',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-dest',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform'
]);

/**
 * Dynamic Reverse Proxy Gateway Handler
 * Handles ALL HTTP methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
 */
export async function handleProxyRequest(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string' || slug.trim().length > 64) {
    res.status(400).json({ error: 'Valid proxy slug is required' });
    return;
  }

  const cleanSlug = slug.trim();

  try {
    // 1. PostgreSQL Lookup
    const endpoint = await prisma.proxyEndpoint.findUnique({
      where: { proxySlug: cleanSlug },
      include: { user: true }
    });

    if (!endpoint || !endpoint.active) {
      res.status(404).json({
        error: 'Proxy endpoint not found or inactive',
        proxySlug: cleanSlug
      });
      return;
    }

    if (endpoint.user.isBanned) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'The account associated with this proxy endpoint is suspended.'
      });
      return;
    }

    // 2. Atomic In-Memory Sliding Window Rate Limiting Check
    const windowMs = endpoint.windowMs || 60000;
    const rateCheck = rateLimiter.checkAndConsume(cleanSlug, endpoint.customRateLimit, windowMs);

    if (!rateCheck.allowed) {
      // Record rate-limited 429 attempt in background to MongoDB
      RequestLog.create({
        proxySlug: cleanSlug,
        endpoint: req.originalUrl,
        method: req.method,
        status: 429,
        timestamp: new Date()
      }).catch(() => {});

      const remainingSecs = Math.max(1, Math.ceil(rateCheck.resetMs / 1000));
      res.setHeader('Retry-After', remainingSecs.toString());
      res.setHeader('X-RateLimit-Limit', rateCheck.limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateCheck.resetMs).toISOString());

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit of ${rateCheck.limit} req/${Math.round(windowMs / 1000)}s exceeded. Try again in ${remainingSecs}s.`,
        limit: rateCheck.limit,
        windowSeconds: Math.round(windowMs / 1000)
      });
      return;
    }

    // 3. Construct Forwarding Target URL (with subpaths and query parameters)
    const slugPrefix = `/proxy/${cleanSlug}`;
    let subPath = '';
    if (req.originalUrl.startsWith(slugPrefix)) {
      subPath = req.originalUrl.slice(slugPrefix.length);
    }

    let fullTargetUrl = endpoint.targetUrl;
    if (subPath) {
      const [pathPart, queryPart] = subPath.split('?');
      if (pathPart && pathPart !== '/') {
        const base = endpoint.targetUrl.endsWith('/') ? endpoint.targetUrl.slice(0, -1) : endpoint.targetUrl;
        const sub = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
        fullTargetUrl = `${base}${sub}`;
      }
      if (queryPart) {
        const separator = fullTargetUrl.includes('?') ? '&' : '?';
        fullTargetUrl = `${fullTargetUrl}${separator}${queryPart}`;
      }
    }

    // Double check SSRF safety on the constructed fullTargetUrl
    const ssrfCheck = validateSafeTargetUrl(fullTargetUrl);
    if (!ssrfCheck.isValid) {
      res.status(400).json({
        error: 'Invalid Destination',
        message: ssrfCheck.error || 'Blocked by SSRF security policy'
      });
      return;
    }

    // 4. Prepare Headers (filter host-specific headers)
    const forwardHeaders: Record<string, string> = {};
    for (const [headerName, headerValue] of Object.entries(req.headers)) {
      if (headerValue !== undefined && !EXCLUDED_HEADERS.has(headerName.toLowerCase())) {
        forwardHeaders[headerName] = Array.isArray(headerValue) ? headerValue.join(', ') : headerValue;
      }
    }

    // 5. Prepare Request Body
    let body: string | undefined = undefined;
    const allowsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (allowsBody && req.body !== undefined) {
      if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
        if (!forwardHeaders['content-type']) {
          forwardHeaders['content-type'] = 'application/json';
        }
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        body = req.body;
      }
    }

    // 6. Forward Request to Destination
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const targetResponse = await fetch(fullTargetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const status = targetResponse.status;

      // Asynchronously log the successful request to MongoDB
      RequestLog.create({
        proxySlug: cleanSlug,
        endpoint: req.originalUrl,
        method: req.method,
        status,
        timestamp: new Date()
      }).catch(() => {});

      // Forward response headers back to client
      targetResponse.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!['transfer-encoding', 'content-encoding', 'content-length'].includes(lower)) {
          res.setHeader(key, value);
        }
      });

      res.setHeader('X-RateLimit-Limit', rateCheck.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateCheck.resetMs).toISOString());

      const responseBuffer = await targetResponse.arrayBuffer();
      res.status(status).send(Buffer.from(responseBuffer));
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const isTimeout = fetchErr.name === 'AbortError';
      const errorStatus = isTimeout ? 504 : 502;

      RequestLog.create({
        proxySlug: cleanSlug,
        endpoint: req.originalUrl,
        method: req.method,
        status: errorStatus,
        timestamp: new Date()
      }).catch(() => {});

      res.status(errorStatus).json({
        error: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
        message: `Failed to reach target API (${endpoint.targetUrl}): ${fetchErr.message}`
      });
    }
  } catch (error: any) {
    console.error(`[Proxy Error - ${cleanSlug}]:`, error);
    res.status(500).json({ error: 'Internal Gateway Error', message: 'An internal error occurred while processing the proxy request.' });
  }
}
