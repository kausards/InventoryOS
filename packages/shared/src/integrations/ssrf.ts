import * as ipaddr from 'net';

export interface SsrfValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

/**
 * Validates that a user-supplied store URL is safe from Server-Side Request Forgery (SSRF).
 * Blocks loopback, RFC 1918 private IPs, AWS/GCP metadata (169.254.x.x), internal hostnames, and unsafe schemes.
 */
export function validateSsrfSafeUrl(inputUrl: string): SsrfValidationResult {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string.' };
  }

  const trimmed = inputUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Malformed URL provided.' };
  }

  // 1. Protocol check: only http and https allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Disallowed URL protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
    };
  }

  // 2. Reject credentials in URL (e.g., http://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { isValid: false, error: 'URLs containing embedded credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject empty hostname
  if (!hostname) {
    return { isValid: false, error: 'URL must contain a valid host.' };
  }

  // 4. Reject localhost and local domain names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '0.0.0.0'
  ) {
    return { isValid: false, error: 'Requests to localhost and internal domain names are blocked.' };
  }

  // 5. IP Address Checks
  // Handle IPv6 bracket notation
  const cleanHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Check IPv4
  const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = [
      Number(ipv4Match[1]),
      Number(ipv4Match[2]),
      Number(ipv4Match[3]),
      Number(ipv4Match[4]),
    ];

    if (octets.some((o) => o > 255)) {
      return { isValid: false, error: 'Invalid IPv4 octets in URL.' };
    }

    const [o1, o2] = octets as [number, number, number, number];

    // Loopback: 127.0.0.0/8
    if (o1 === 127) {
      return { isValid: false, error: 'Loopback IP addresses (127.0.0.0/8) are blocked.' };
    }

    // Zero-network: 0.0.0.0/8
    if (o1 === 0) {
      return { isValid: false, error: 'Zero-network IP addresses (0.0.0.0/8) are blocked.' };
    }

    // Private Class A: 10.0.0.0/8
    if (o1 === 10) {
      return { isValid: false, error: 'Private IP addresses (10.0.0.0/8) are blocked.' };
    }

    // Private Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return { isValid: false, error: 'Private IP addresses (172.16.0.0/12) are blocked.' };
    }

    // Private Class C: 192.168.0.0/16
    if (o1 === 192 && o2 === 168) {
      return { isValid: false, error: 'Private IP addresses (192.168.0.0/16) are blocked.' };
    }

    // Link-local / Cloud metadata: 169.254.0.0/16 (e.g., 169.254.169.254)
    if (o1 === 169 && o2 === 254) {
      return { isValid: false, error: 'Link-local / Cloud metadata IP addresses (169.254.0.0/16) are blocked.' };
    }
  }

  // Check IPv6 loopback and link-local
  if (cleanHost === '::1' || cleanHost === '0:0:0:0:0:0:0:1' || cleanHost.startsWith('fe80:') || cleanHost.startsWith('fc00:') || cleanHost.startsWith('fd00:')) {
    return { isValid: false, error: 'IPv6 loopback or private/link-local addresses are blocked.' };
  }

  // Check numeric IP representation (e.g. integer IP 2130706433 or hex 0x7f000001)
  if (/^\d+$/.test(cleanHost) || /^0x[0-9a-f]+$/i.test(cleanHost)) {
    return { isValid: false, error: 'Numeric or hex IP addresses are blocked.' };
  }

  // 6. Check ports: only standard web ports allowed
  if (parsed.port) {
    const port = Number(parsed.port);
    const ALLOWED_PORTS = [80, 443, 8080, 8443];
    if (!ALLOWED_PORTS.includes(port)) {
      return {
        isValid: false,
        error: `Port ${port} is not allowed. Only standard web ports (80, 443, 8080, 8443) are permitted.`,
      };
    }
  }

  // Return normalized sanitized URL (strip trailing slash for consistency)
  const sanitized = parsed.origin + (parsed.pathname.endsWith('/') && parsed.pathname.length > 1 ? parsed.pathname.slice(0, -1) : parsed.pathname);

  return {
    isValid: true,
    sanitizedUrl: sanitized,
  };
}
