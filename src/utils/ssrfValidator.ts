import net from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254'
]);

/**
 * Checks if an IP address belongs to a private/reserved/internal range
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [b0, b1] = parts;

    // Loopback: 127.0.0.0/8
    if (b0 === 127) return true;
    // Zero address: 0.0.0.0/8
    if (b0 === 0) return true;
    // Private Network 10.0.0.0/8
    if (b0 === 10) return true;
    // Private Network 172.16.0.0/12
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // Private Network 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;
    // Link-local / Cloud Metadata 169.254.0.0/16
    if (b0 === 169 && b1 === 254) return true;
    // Broadcast / Multicast
    if (b0 >= 224) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // IPv6 Loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // IPv6 Unspecified
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // Unique Local Address fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // Link-Local Address fe80::/10
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // IPv4-mapped IPv6 address ::ffff:x.x.x.x
    if (normalized.includes('::ffff:')) {
      const ipv4Part = normalized.split('::ffff:')[1];
      if (ipv4Part && net.isIPv4(ipv4Part)) {
        return isPrivateIp(ipv4Part);
      }
    }
    return false;
  }

  return false;
}

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validates target API URLs to prevent Server-Side Request Forgery (SSRF)
 * and ensure valid HTTP/HTTPS formatting.
 */
export function validateSafeTargetUrl(urlString: string): UrlValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { isValid: false, error: 'Target URL is required and must be a string' };
  }

  const trimmed = urlString.trim();

  if (trimmed.length > 2048) {
    return { isValid: false, error: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Invalid URL format. Must be a valid URL with http:// or https://' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: `Invalid protocol '${parsed.protocol}'. Only http: and https: are supported.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname) {
    return { isValid: false, error: 'URL must contain a valid hostname' };
  }

  // Block known internal hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { isValid: false, error: `Access to internal host '${hostname}' is blocked for security reasons (SSRF Protection).` };
  }

  // Block localhost variations
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { isValid: false, error: `Access to internal/private domain '${hostname}' is blocked (SSRF Protection).` };
  }

  // Check if hostname is an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { isValid: false, error: `Access to private or local IP address '${hostname}' is blocked for security reasons (SSRF Protection).` };
    }
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString()
  };
}
