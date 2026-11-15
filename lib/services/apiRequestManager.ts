/**
 * Phase 9 §B/D/E & Phase 10 §4 — Deterministic Cache Keys, Per-Provider Fallback Metadata & Request Lifecycle Manager
 *
 * Features:
 *   1. Canonical parameter sorting + SHA-256 cache key generation for WMTS/WMS tiles & scientific calculations.
 *   2. Workspace-scoped AbortController registry so switching workspaces immediately cancels superseded fetches.
 *   3. In-flight request deduplication + exponential backoff retry + per-provider fallback descriptors.
 */

export type ProvenanceTruthClass =
  | 'DIRECTLY_RETRIEVED'
  | 'LOCALLY_CALCULATED'
  | 'MODEL_DERIVED'
  | 'ESTIMATED'
  | 'CACHED'
  | 'UNAVAILABLE';

export interface ProviderFallbackDescriptor {
  originalProvider: string;
  actualDataSource: string;
  provenanceClass: ProvenanceTruthClass;
  retrievedAtUtc: string;
  cacheAgeSeconds: number;
  ttlSeconds: number;
  datasetVersion: string;
  resolutionAndCoverage: string;
  knownLimitations: string[];
  fallbackActive: boolean;
}

/**
 * Deterministic canonical JSON stringifier (sorted object keys recursively).
 */
export function canonicalizeParameters(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeParameters(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalizeParameters(obj[k])}`)
    .join(',')}}`;
}

/**
 * Fast, isomorphic SHA-256 (Web Crypto on browser / Node crypto fallback via synchronous FNV+WebCrypto helper)
 * Returns a deterministic canonical digest string usable on both client & server.
 */
export async function computeCanonicalSha256(
  namespace: string,
  params: Record<string, unknown>
): Promise<string> {
  const payload = `${namespace}::${canonicalizeParameters(params)}`;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const bytes = new TextEncoder().encode(payload);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic non-cryptographic fallback only if WebCrypto subtle is absent
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function buildTileCacheKey(params: {
  provider: string;
  dataset: string;
  layer: string;
  projection: string;
  tileMatrixSet: string;
  zoom: string | number;
  row: number;
  col: number;
  style?: string;
}): string {
  return `tile:${canonicalizeParameters({
    provider: params.provider,
    dataset: params.dataset,
    layer: params.layer,
    projection: params.projection,
    tileMatrixSet: params.tileMatrixSet,
    zoom: String(params.zoom),
    row: params.row,
    col: params.col,
    style: params.style ?? 'default',
  })}`;
}

export function buildCalculationCacheKey(params: {
  siteId: string;
  epochUtc: string;
  timeScale: 'UTC' | 'TT' | 'TDB_ET';
  referenceFrame: string;
  modelVersion: string;
  datasetChecksum?: string;
  calculationParams: Record<string, unknown>;
}): string {
  return `calc:${canonicalizeParameters({
    siteId: params.siteId,
    epochUtc: params.epochUtc,
    timeScale: params.timeScale,
    referenceFrame: params.referenceFrame,
    modelVersion: params.modelVersion,
    datasetChecksum: params.datasetChecksum ?? 'lola-v1.4',
    calculationParams: params.calculationParams,
  })}`;
}

// Workspace-scoped request lifecycle registry (client & isomorphic)
const workspaceAbortControllers = new Map<string, Set<AbortController>>();
const clientInFlightFetches = new Map<string, Promise<unknown>>();

export function registerWorkspaceAbortController(workspaceId: string): AbortController {
  const controller = new AbortController();
  let set = workspaceAbortControllers.get(workspaceId);
  if (!set) {
    set = new Set();
    workspaceAbortControllers.set(workspaceId, set);
  }
  set.add(controller);
  return controller;
}

export function abortWorkspaceRequests(workspaceId: string): void {
  const set = workspaceAbortControllers.get(workspaceId);
  if (!set) return;
  for (const controller of set) {
    try {
      controller.abort();
    } catch {
      // Ignore abort cleanup error
    }
  }
  set.clear();
}

export async function fetchJsonWithRetry<T>(params: {
  dedupeKey?: string;
  workspaceId?: string;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<T> {
  const {
    dedupeKey,
    workspaceId = 'global',
    url,
    init,
    timeoutMs = 10_000,
    maxRetries = 2,
  } = params;

  if (dedupeKey) {
    const existing = clientInFlightFetches.get(dedupeKey) as Promise<T> | undefined;
    if (existing) return existing;
  }

  const run = async (): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
      }
      const wsController = registerWorkspaceAbortController(workspaceId);
      const timer = setTimeout(() => wsController.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          ...init,
          signal: wsController.signal,
        });
        clearTimeout(timer);
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }
      } finally {
        workspaceAbortControllers.get(workspaceId)?.delete(wsController);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Request failed');
  };

  const promise = run().finally(() => {
    if (dedupeKey) clientInFlightFetches.delete(dedupeKey);
  });

  if (dedupeKey) {
    clientInFlightFetches.set(dedupeKey, promise);
  }
  return promise;
}

export function buildProviderFallbackDescriptor(
  params: Partial<ProviderFallbackDescriptor> & {
    originalProvider: string;
    actualDataSource: string;
    provenanceClass: ProvenanceTruthClass;
    datasetVersion: string;
    resolutionAndCoverage: string;
  }
): ProviderFallbackDescriptor {
  return {
    originalProvider: params.originalProvider,
    actualDataSource: params.actualDataSource,
    provenanceClass: params.provenanceClass,
    retrievedAtUtc: params.retrievedAtUtc ?? new Date().toISOString(),
    cacheAgeSeconds: params.cacheAgeSeconds ?? 0,
    ttlSeconds: params.ttlSeconds ?? 21_600,
    datasetVersion: params.datasetVersion,
    resolutionAndCoverage: params.resolutionAndCoverage,
    knownLimitations: params.knownLimitations ?? [],
    fallbackActive: params.fallbackActive ?? false,
  };
}
