/**
 * Phase 5 & Phase 8 — Common Scientific Data Architecture, CRS Transformations & Two-Tier Cache
 * Preserves original data, units, coordinate reference systems, dataset versions,
 * acquisition/retrieval timestamps, and processing history across:
 *   1. NASA Moon Trek OGC WMTS
 *   2. NASA/JPL Horizons REST Ephemeris
 *   3. LROC QuickMap / Lunaserv OGC WMS & PDS Archive
 */

import {
  getSqliteCachedResponse,
  setSqliteCachedResponse,
} from '@/server/db/database';
import {
  latLonToPolarStereo,
  polarStereoToLatLon,
} from '@/lib/terrain/lolaTerrainEngine';
import {
  assertAllowedUpstreamUrl,
  checkProviderRateLimit,
  sanitizePublicError,
  withProviderConcurrencyGuard,
} from '@/lib/security/proxyGuard';

export type ExternalScientificSource =
  | 'NASA_MOON_TREK_WMTS'
  | 'JPL_HORIZONS_REST'
  | 'LROC_LUNASERV_WMS'
  | 'LROC_PDS_ARCHIVE'
  | 'LOCAL_ANALYTICAL_DE441';

export type LunarCrsIdentifier =
  | 'urn:ogc:def:crs:EPSG::104903' // Moon Trek Global Equirectangular
  | 'urn:ogc:def:crs:IAU2000::30118' // Moon Trek North Polar Stereographic
  | 'urn:ogc:def:crs:IAU2000::30120' // Moon Trek South Polar Stereographic
  | 'EPSG:4326' // Lunaserv / OGC Global Cylindrical (-180..180, -90..90)
  | 'IAU2000:30100' // IAU Moon 2000 Selenographic Sphere (R = 1737.4 km)
  | 'AUTO:42003,9001,0,-90' // Lunaserv South Polar Orthographic (meters)
  | 'AUTO:42003,9001,0,90' // Lunaserv North Polar Orthographic (meters)
  | 'ICRF/J2000' // JPL Horizons Inertial Barycentric / Geocentric / Selenocentric
  | 'IAU_MOON_ME' // Mean Earth / Polar Axis Body-Fixed Frame (DE421 / DE441)
  | 'IAU_MOON_PA' // Principal Axis Body-Fixed Frame
  | 'TOPOCENTRIC_ENU'; // Local Lunar Surface East-North-Up

export type LongitudeConvention = '[-180,+180]_EAST' | '[0,360]_EAST' | 'CARTESIAN_METERS_OR_KM';

export type TimeScaleIdentifier = 'UTC' | 'TT' | 'TDB_ET' | 'STATIC_CARTOGRAPHIC';

export interface ScientificProvenanceEnvelope {
  source: ExternalScientificSource;
  providerOrganization: string;
  endpointUrl: string;
  datasetIdentifier: string;
  datasetVersion: string;
  nativeCrs: LunarCrsIdentifier;
  longitudeConvention: LongitudeConvention;
  elevationDatum: string;
  nativeUnits: string;
  timeScale: TimeScaleIdentifier;
  retrievedAtUtc: string;
  cacheStatus: 'LIVE_NETWORK' | 'MEMORY_LRU_HIT' | 'SQLITE_CACHE_HIT' | 'FALLBACK_SYNTHESIS';
  cacheAgeSeconds?: number;
  ttlSeconds?: number;
  isNumericalDem: boolean;
  processingHistory: string[];
  warnings: string[];
}

/**
 * Normalizes any selenographic East longitude to [-180°, +180°].
 */
export function normalizeLongitude180(lonDeg: number): number {
  let wrapped = ((lonDeg + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;
  if (wrapped === -180.0 && lonDeg > 0) wrapped = 180.0;
  return Number(wrapped.toFixed(6));
}

/**
 * Normalizes any selenographic East longitude to [0°, 360°).
 */
export function normalizeLongitude360(lonDeg: number): number {
  const wrapped = ((lonDeg % 360.0) + 360.0) % 360.0;
  return Number(wrapped.toFixed(6));
}

/**
 * Projects selenographic (latDeg, lonDeg) on the IAU 1737.4 km sphere into
 * target map projection coordinates (Equirectangular degrees, Polar Stereographic meters,
 * or Lunaserv Polar Orthographic meters).
 */
export function projectLatLonToLunarCrs(
  latDeg: number,
  lonDeg: number,
  targetCrs: LunarCrsIdentifier
): { x: number; y: number; units: 'deg' | 'm' } {
  const R_MOON_M = 1737400.0;
  const latRad = (latDeg * Math.PI) / 180.0;
  const lon180 = normalizeLongitude180(lonDeg);
  const lonRad = (lon180 * Math.PI) / 180.0;

  switch (targetCrs) {
    case 'urn:ogc:def:crs:IAU2000::30120': {
      // South Polar Stereographic (true scale at 90°S, central meridian 0°E)
      const stereo = latLonToPolarStereo(latDeg, lon180);
      return { x: stereo.xM, y: stereo.yM, units: 'm' };
    }
    case 'urn:ogc:def:crs:IAU2000::30118': {
      // North Polar Stereographic (true scale at 90°N, central meridian 0°E)
      const colatRad = Math.PI / 2.0 - latRad;
      const rhoM = 2.0 * R_MOON_M * Math.tan(Math.max(0, colatRad) * 0.5);
      const xM = rhoM * Math.sin(lonRad);
      const yM = -rhoM * Math.cos(lonRad);
      return { x: Number(xM.toFixed(2)), y: Number(yM.toFixed(2)), units: 'm' };
    }
    case 'AUTO:42003,9001,0,-90': {
      // Lunaserv South Polar Orthographic (centered at 0°E, -90°S)
      const cosLat = Math.cos(latRad);
      const xM = R_MOON_M * cosLat * Math.sin(lonRad);
      const yM = R_MOON_M * cosLat * Math.cos(lonRad);
      return { x: Number(xM.toFixed(2)), y: Number(yM.toFixed(2)), units: 'm' };
    }
    case 'AUTO:42003,9001,0,90': {
      // Lunaserv North Polar Orthographic (centered at 0°E, +90°N)
      const cosLat = Math.cos(latRad);
      const xM = R_MOON_M * cosLat * Math.sin(lonRad);
      const yM = -R_MOON_M * cosLat * Math.cos(lonRad);
      return { x: Number(xM.toFixed(2)), y: Number(yM.toFixed(2)), units: 'm' };
    }
    case 'urn:ogc:def:crs:EPSG::104903':
    case 'EPSG:4326':
    case 'IAU2000:30100':
    default:
      return { x: lon180, y: Number(latDeg.toFixed(6)), units: 'deg' };
  }
}

/**
 * Inverse projection from South Polar Stereographic meters back to Selenographic (lat, lon).
 */
export function unprojectSouthPolarStereoToLatLon(xM: number, yM: number): {
  latDeg: number;
  lonDeg180: number;
  lonDeg360: number;
} {
  const { latDeg, lonDeg } = polarStereoToLatLon(xM, yM);
  return {
    latDeg,
    lonDeg180: normalizeLongitude180(lonDeg),
    lonDeg360: normalizeLongitude360(lonDeg),
  };
}

// Fast in-memory LRU cache (Tier 1) sitting in front of SQLite (Tier 2)
interface MemoryCacheItem {
  contentType: string;
  payloadText: string | null;
  payloadBlob: Buffer | null;
  provenance: ScientificProvenanceEnvelope;
  httpStatus: number;
  expiresAtMs: number;
}

const MEMORY_LRU_MAX = 250;
const memoryCache = new Map<string, MemoryCacheItem>();
const inFlightRequests = new Map<string, Promise<MemoryCacheItem>>();

function putMemoryCache(key: string, item: MemoryCacheItem): void {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MEMORY_LRU_MAX) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, item);
}

/**
 * Executes an external HTTP request with:
 * - Two-tier caching (Memory LRU + SQLite `external_api_cache`)
 * - Request coalescing (deduplicates concurrent identical requests)
 * - Timeout & exponential backoff retry handling
 * - Strict provenance tracking
 */
export async function fetchWithProvenanceCache(params: {
  cacheKey: string;
  serviceName: ExternalScientificSource;
  url: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  responseType: 'text' | 'binary';
  ttlMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseProvenance: Omit<
    ScientificProvenanceEnvelope,
    'retrievedAtUtc' | 'cacheStatus' | 'endpointUrl'
  >;
}): Promise<{
  contentType: string;
  payloadText: string | null;
  payloadBlob: Buffer | null;
  provenance: ScientificProvenanceEnvelope;
  httpStatus: number;
}> {
  const {
    cacheKey,
    serviceName,
    url,
    method = 'GET',
    body,
    headers = {},
    responseType,
    ttlMs = 1000 * 60 * 60 * 6, // 6 hours default TTL
    timeoutMs = 9500,
    maxRetries = 2,
    baseProvenance,
  } = params;

  const nowMs = Date.now();

  // 1. Check Tier-1 Memory LRU Cache
  const memHit = memoryCache.get(cacheKey);
  if (memHit && memHit.expiresAtMs > nowMs) {
    memoryCache.delete(cacheKey);
    memoryCache.set(cacheKey, memHit);
    const retrievedMs = Date.parse(memHit.provenance.retrievedAtUtc) || nowMs;
    return {
      ...memHit,
      provenance: {
        ...memHit.provenance,
        cacheStatus: 'MEMORY_LRU_HIT',
        cacheAgeSeconds: Math.max(0, Math.round((nowMs - retrievedMs) / 1000)),
        ttlSeconds: Math.max(0, Math.round((memHit.expiresAtMs - nowMs) / 1000)),
      },
    };
  }

  // 2. Check Tier-2 SQLite Persistent Cache
  const sqlHit = getSqliteCachedResponse(cacheKey);
  if (sqlHit) {
    let parsedProv: ScientificProvenanceEnvelope;
    try {
      parsedProv = JSON.parse(sqlHit.provenanceJson) as ScientificProvenanceEnvelope;
    } catch {
      parsedProv = {
        ...baseProvenance,
        endpointUrl: sqlHit.endpointUrl,
        retrievedAtUtc: new Date(sqlHit.createdAtMs).toISOString(),
        cacheStatus: 'SQLITE_CACHE_HIT',
      };
    }
    const hydrated: MemoryCacheItem = {
      contentType: sqlHit.contentType,
      payloadText: sqlHit.payloadText,
      payloadBlob: sqlHit.payloadBlob,
      provenance: {
        ...parsedProv,
        cacheStatus: 'SQLITE_CACHE_HIT',
        cacheAgeSeconds: Math.max(0, Math.round((nowMs - sqlHit.createdAtMs) / 1000)),
        ttlSeconds: Math.max(0, Math.round((sqlHit.expiresAtMs - nowMs) / 1000)),
      },
      httpStatus: sqlHit.httpStatus,
      expiresAtMs: sqlHit.expiresAtMs,
    };
    putMemoryCache(cacheKey, hydrated);
    return hydrated;
  }

  // 3. Enforce SSRF allowlist & provider-specific rate limit before network egress
  const validatedUrl = assertAllowedUpstreamUrl(url).toString();
  const rateCheck = checkProviderRateLimit(serviceName);
  if (!rateCheck.allowed) {
    throw new Error(
      `Provider rate limit reached for ${serviceName}; retry after ${rateCheck.retryAfterSec}s.`
    );
  }

  // 4. Coalesce concurrent identical network requests
  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const executeFetch = async (): Promise<MemoryCacheItem> =>
    withProviderConcurrencyGuard(serviceName, async () => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 350 * Math.pow(2, attempt - 1)));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(validatedUrl, {
            method,
            body,
            redirect: 'error',
            headers: {
              'User-Agent': 'ProjectSelene-LunarNavigator/3.0 (Scientific Research Client)',
              ...headers,
            },
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (res.status === 429 || res.status >= 500) {
            lastError = new Error(`Upstream HTTP ${res.status}`);
            continue;
          }

          if (!res.ok) {
            throw new Error(`HTTP ${res.status} (${res.statusText})`);
          }

          const contentType = res.headers.get('content-type') || 'application/octet-stream';
          let payloadText: string | null = null;
          let payloadBlob: Buffer | null = null;

          if (responseType === 'binary') {
            const ab = await res.arrayBuffer();
            payloadBlob = Buffer.from(ab);
          } else {
            payloadText = await res.text();
          }

          const retrievedAtUtc = new Date().toISOString();
          const provenance: ScientificProvenanceEnvelope = {
            ...baseProvenance,
            endpointUrl: validatedUrl,
            retrievedAtUtc,
            cacheStatus: 'LIVE_NETWORK',
            cacheAgeSeconds: 0,
            ttlSeconds: Math.round(ttlMs / 1000),
            processingHistory: [
              ...baseProvenance.processingHistory,
              `Retrieved HTTP ${res.status} (${contentType}) from ${validatedUrl} at ${retrievedAtUtc}`,
            ],
          };

          const item: MemoryCacheItem = {
            contentType,
            payloadText,
            payloadBlob,
            provenance,
            httpStatus: res.status,
            expiresAtMs: Date.now() + ttlMs,
          };

          putMemoryCache(cacheKey, item);
          setSqliteCachedResponse({
            cacheKey,
            serviceName,
            endpointUrl: validatedUrl,
            contentType,
            payloadText,
            payloadBlob,
            provenanceJson: JSON.stringify(provenance),
            httpStatus: res.status,
            createdAtMs: Date.now(),
            expiresAtMs: item.expiresAtMs,
          });

          return item;
        } catch (err) {
          clearTimeout(timer);
          lastError = new Error(sanitizePublicError(err, `Failed to fetch ${validatedUrl}`));
        }
      }
      throw lastError ?? new Error(`Failed to fetch ${validatedUrl}`);
    });

  const promise = executeFetch().finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, promise);
  return promise;
}
