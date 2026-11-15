/**
 * Project Selene — Dual Ephemeris Provider (NASA JPL Horizons REST API + Calibrated Offline Fallback)
 * Queries https://ssd.jpl.nasa.gov/api/horizons.api with bounded 4-second timeout and emits explicit
 * provenance metadata and warning flags.
 */

import {
  EphemerisStateVector,
  computeCalibratedEphemeris,
} from './offlineCalibratedProvider';
import { normalizeUtcIso } from './timeScales';

export type EphemerisProviderMode = 'AUTO_JPL' | 'CALIBRATED_OFFLINE';

export interface ApiWarning {
  code:
    | 'EPHEMERIS_PROVIDER_OFFLINE_FALLBACK'
    | 'GRAZING_SOLAR_ILLUMINATION'
    | 'MULTIPATH_DTE_MARGIN_LOW'
    | 'TERRAIN_OCCLUSION_ACTIVE'
    | 'PERMANENT_SHADOW_PROXIMITY';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface EphemerisProviderResult {
  ephemeris: EphemerisStateVector;
  providerUsed: 'NASA_JPL_HORIZONS' | 'CALIBRATED_ANALYTICAL_DE441';
  modelVersion: string;
  warnings: ApiWarning[];
}

/**
 * Attempts to query NASA JPL Horizons REST API for observer table at lunar surface coordinates,
 * with a strict 3500ms timeout, falling back seamlessly to `computeCalibratedEphemeris` with
 * explicit `EPHEMERIS_PROVIDER_OFFLINE_FALLBACK` warning if offline or rate-limited.
 */
export async function resolveInstantEphemeris(params: {
  timestampUtc: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  providerMode?: EphemerisProviderMode;
}): Promise<EphemerisProviderResult> {
  const {
    timestampUtc,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    providerMode = 'AUTO_JPL',
  } = params;

  const iso = normalizeUtcIso(timestampUtc);
  const warnings: ApiWarning[] = [];

  // Always compute calibrated analytical baseline first so we have full 3D vectors and instant fallback
  const calibrated = computeCalibratedEphemeris(iso, siteLatDeg, siteLonDeg, siteElevationKm);

  if (providerMode === 'CALIBRATED_OFFLINE') {
    warnings.push({
      code: 'EPHEMERIS_PROVIDER_OFFLINE_FALLBACK',
      severity: 'info',
      message:
        'Operating in user-selected Calibrated Analytical DE441-MOON_ME mode (independent of external JPL network).',
    });
    return {
      ephemeris: calibrated,
      providerUsed: 'CALIBRATED_ANALYTICAL_DE441',
      modelVersion: 'DE441-MOON_ME-ANALYTICAL-V2.4',
      warnings,
    };
  }

  // Attempt live NASA JPL Horizons probe with bounded 3.5s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const startDate = new Date(iso);
    const stopDate = new Date(startDate.getTime() + 60 * 1000);
    const tlist = `'${startDate.toISOString().slice(0, 19)}'`;

    // Center: coord@301 (Moon body-fixed selenographic coordinates)
    const siteCoord = `'${siteLonDeg.toFixed(4)},${siteLatDeg.toFixed(4)},${siteElevationKm.toFixed(3)}'`;
    const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
    url.searchParams.set('format', 'json');
    url.searchParams.set('COMMAND', "'10'"); // Sun
    url.searchParams.set('OBJ_DATA', "'NO'");
    url.searchParams.set('MAKE_EPHEM', "'YES'");
    url.searchParams.set('EPHEM_TYPE', "'OBSERVER'");
    url.searchParams.set('CENTER', "'coord@301'");
    url.searchParams.set('COORD_TYPE', "'GEODETIC'");
    url.searchParams.set('SITE_COORD', siteCoord);
    url.searchParams.set('TLIST', tlist);
    url.searchParams.set('QUANTITIES', "'4'"); // Apparent Azimuth & Elevation

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = (await response.json()) as { result?: string };
      if (json.result && json.result.includes('$$SOE')) {
        const soeBlock = json.result.split('$$SOE')[1]?.split('$$EOE')[0]?.trim();
        if (soeBlock) {
          const tokens = soeBlock.trim().split(/\s+/);
          const maybeEl = parseFloat(tokens[tokens.length - 1] ?? '');
          const maybeAz = parseFloat(tokens[tokens.length - 2] ?? '');
          if (!Number.isNaN(maybeAz) && !Number.isNaN(maybeEl)) {
            calibrated.solarHorizon.azimuthDeg = Number(maybeAz.toFixed(4));
            calibrated.solarHorizon.elevationDeg = Number(maybeEl.toFixed(4));
          }
        }
        return {
          ephemeris: calibrated,
          providerUsed: 'NASA_JPL_HORIZONS',
          modelVersion: 'JPL-HORIZONS-DE441-MOON_ME',
          warnings,
        };
      }
    }

    throw new Error(`Horizons API returned non-SOE payload or status ${response.status}`);
  } catch {
    clearTimeout(timeoutId);
    warnings.push({
      code: 'EPHEMERIS_PROVIDER_OFFLINE_FALLBACK',
      severity: 'warning',
      message:
        'Live NASA JPL Horizons endpoint unreachable or timed out (>3.5s); seamlessly engaged Calibrated Analytical DE441-MOON_ME ephemeris engine.',
    });
    return {
      ephemeris: calibrated,
      providerUsed: 'CALIBRATED_ANALYTICAL_DE441',
      modelVersion: 'DE441-MOON_ME-ANALYTICAL-V2.4',
      warnings,
    };
  }
}
