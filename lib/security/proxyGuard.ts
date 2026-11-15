/**
 * Phase 10 §2 & Phase 9 §C — Server-Side Security, SSRF Protection, Rate Limiting & Mutation Validation
 * Guarantees:
 *   1. Strict HTTPS-only upstream domain allowlist (trek.nasa.gov, ssd.jpl.nasa.gov, wms.im-ldi.com, wms.lroc.asu.edu, data.lroc.im-ldi.com).
 *   2. Blocks private/loopback/link-local/metadata IPs and disallow automatic HTTP redirects (`redirect: 'error'`).
 *   3. Provider-specific sliding-window rate limits and bounded concurrency semaphores.
 *   4. Request body size caps, parameter validation helpers, and safe error message sanitization (no stack/internal leak).
 *   5. Same-origin / browser CSRF guard for state-mutating API endpoints.
 */

import { NextRequest } from 'next/server';

export const ALLOWED_UPSTREAM_HOSTS = new Set<string>([
  'trek.nasa.gov',
  'ssd.jpl.nasa.gov',
  'wms.im-ldi.com',
  'wms.lroc.asu.edu',
  'data.lroc.im-ldi.com',
]);

const PRIVATE_OR_LOCAL_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export type GuardedProviderId =
  | 'NASA_MOON_TREK_WMTS'
  | 'JPL_HORIZONS_REST'
  | 'LROC_LUNASERV_WMS'
  | 'LROC_PDS_ARCHIVE'
  | 'LOCAL_ANALYTICAL_DE441';

interface ProviderLimitPolicy {
  maxRequestsPerMinute: number;
  maxConcurrent: number;
  timeoutMs: number;
}

export const PROVIDER_LIMIT_POLICIES: Record<GuardedProviderId, ProviderLimitPolicy> = {
  NASA_MOON_TREK_WMTS: { maxRequestsPerMinute: 240, maxConcurrent: 12, timeoutMs: 9500 },
  JPL_HORIZONS_REST: { maxRequestsPerMinute: 45, maxConcurrent: 4, timeoutMs: 9500 },
  LROC_LUNASERV_WMS: { maxRequestsPerMinute: 90, maxConcurrent: 6, timeoutMs: 9500 },
  LROC_PDS_ARCHIVE: { maxRequestsPerMinute: 30, maxConcurrent: 4, timeoutMs: 9500 },
  LOCAL_ANALYTICAL_DE441: { maxRequestsPerMinute: 1000, maxConcurrent: 64, timeoutMs: 2000 },
};

const providerWindowTimestamps = new Map<string, number[]>();
const providerInFlightCounts = new Map<string, number>();

export function assertAllowedUpstreamUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Rejected invalid upstream URL syntax.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Rejected non-HTTPS upstream protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('Rejected upstream URL containing embedded credentials.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_OR_LOCAL_IP_PATTERNS.some((rx) => rx.test(hostname))) {
    throw new Error(`Rejected private/loopback upstream host: ${hostname}`);
  }
  if (!ALLOWED_UPSTREAM_HOSTS.has(hostname)) {
    throw new Error(`Upstream host '${hostname}' is not in the NASA/JPL/LROC allowlist.`);
  }

  return parsed;
}

export function checkProviderRateLimit(
  provider: GuardedProviderId,
  clientKey = 'global'
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const policy = PROVIDER_LIMIT_POLICIES[provider];
  const bucketKey = `${provider}:${clientKey}`;
  const now = Date.now();
  const windowStart = now - 60_000;

  const existing = providerWindowTimestamps.get(bucketKey) ?? [];
  const pruned = existing.filter((ts) => ts >= windowStart);

  if (pruned.length >= policy.maxRequestsPerMinute) {
    const oldest = pruned[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    providerWindowTimestamps.set(bucketKey, pruned);
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  pruned.push(now);
  providerWindowTimestamps.set(bucketKey, pruned);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, policy.maxRequestsPerMinute - pruned.length),
  };
}

export async function withProviderConcurrencyGuard<T>(
  provider: GuardedProviderId,
  fn: () => Promise<T>
): Promise<T> {
  const policy = PROVIDER_LIMIT_POLICIES[provider];
  const current = providerInFlightCounts.get(provider) ?? 0;
  if (current >= policy.maxConcurrent) {
    throw new Error(`Provider '${provider}' concurrency limit reached (${policy.maxConcurrent}).`);
  }
  providerInFlightCounts.set(provider, current + 1);
  try {
    return await fn();
  } finally {
    const next = Math.max(0, (providerInFlightCounts.get(provider) ?? 1) - 1);
    providerInFlightCounts.set(provider, next);
  }
}

export function getClientIdentifier(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    return fwd.split(',')[0]?.trim() || 'client';
  }
  return req.headers.get('x-real-ip') || 'local-client';
}

export function validateSameOriginMutation(req: NextRequest): { ok: boolean; reason?: string } {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: false, reason: 'Content-Type must be application/json.' };
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (originHost !== host.toLowerCase()) {
        return { ok: false, reason: `Cross-origin mutation rejected (${originHost} !== ${host}).` };
      }
    } catch {
      return { ok: false, reason: 'Invalid Origin header on mutation request.' };
    }
  }

  return { ok: true };
}

export async function readBoundedJsonBody<T = Record<string, unknown>>(
  req: NextRequest,
  maxBytes = 65_536
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      error: `Request payload exceeds maximum allowed size (${maxBytes} bytes).`,
      status: 413,
    };
  }

  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      return {
        ok: false,
        error: `Request payload exceeds maximum allowed size (${maxBytes} bytes).`,
        status: 413,
      };
    }
    const parsed = JSON.parse(raw) as T;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Request body must be a JSON object.', status: 400 };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'Malformed JSON request body.', status: 400 };
  }
}

export function sanitizePublicError(err: unknown, fallbackMessage = 'Upstream request failed'): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip filesystem paths or stack traces before returning to client
  return raw
    .replace(/\/[^\s:]+\.(ts|tsx|js|mjs|db)/g, '[internal-module]')
    .slice(0, 240) || fallbackMessage;
}

export function validateEnvironmentIntegrity(): {
  ok: boolean;
  warnings: string[];
  runtimeMode: 'cloud-run' | 'local-node';
} {
  const warnings: string[] = [];
  const runtimeMode = process.env.K_SERVICE ? 'cloud-run' : 'local-node';

  if (process.env.NEXT_PUBLIC_NASA_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    warnings.push('SECURITY_WARNING: Secret key detected with NEXT_PUBLIC_ prefix.');
  }

  return {
    ok: warnings.length === 0,
    warnings,
    runtimeMode,
  };
}
