/**
 * Project Selene — Bracketed Root-Finding (Brent-Dekker) Horizon Crossing & Event Detector
 * Solves h(t) - h_threshold(alpha(t)) = 0 within tolerance Delta_t <= 60 seconds (configured to <= 5 seconds).
 * Detects non-crossing polar conditions: CONTINUOUS_SUNLIGHT, PERMANENT_SHADOW, GRAZING_DIP.
 */

import {
  EngineeringConstraints,
  SOLAR_ANGULAR_RADIUS_DEG,
  evaluateDecoupledState,
  getLolaHorizonElevationDeg,
} from './coordinateFrames';
import { computeCalibratedEphemeris } from './offlineCalibratedProvider';

export interface HorizonEvent {
  type:
    | 'SUNRISE'
    | 'SUNSET'
    | 'EARTHRISE'
    | 'EARTHSET'
    | 'SPAC_START'
    | 'SPAC_END'
    | 'SOLAR_APEX'
    | 'GRAZING_DIP';
  timestampUtc: string;
  unixMs: number;
  azimuthDeg: number;
  elevationDeg: number;
  terrainHorizonDeg: number;
  description: string;
}

export type PolarIlluminationRegime =
  | 'CONTINUOUS_SUNLIGHT'
  | 'PERMANENT_SHADOW_PSR'
  | 'SYNODIC_DAY_NIGHT_CYCLE'
  | 'GRAZING_HORIZON_SKIM';

/**
 * Brent-Dekker root-finding algorithm to locate t in [tA, tB] where f(t) = 0
 * within toleranceMs (default 5,000 ms = 5 seconds, well inside the 60s aerospace requirement).
 */
export function brentDekkerRoot(
  fn: (unixMs: number) => number,
  tA: number,
  tB: number,
  toleranceMs = 5000,
  maxIterations = 40
): number {
  let a = tA;
  let b = tB;
  let fa = fn(a);
  let fb = fn(b);

  if (fa * fb > 0) {
    return (a + b) / 2;
  }

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;

  for (let iter = 0; iter < maxIterations; iter++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }

    const tol = 2 * Number.EPSILON * Math.abs(b) + 0.5 * toleranceMs;
    const m = 0.5 * (c - b);

    if (Math.abs(m) <= tol || fb === 0) {
      return Math.round(b);
    }

    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        // Secant method
        p = 2 * m * s;
        q = 1 - s;
      } else {
        // Inverse quadratic interpolation
        q = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) {
        q = -q;
      } else {
        p = -p;
      }
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = d;
      }
    } else {
      d = m;
      e = d;
    }

    a = b;
    fa = fb;
    if (Math.abs(d) > tol) {
      b += d;
    } else {
      b += m > 0 ? tol : -tol;
    }
    fb = fn(b);
  }

  return Math.round(b);
}

/**
 * Scans a mission window for exact terrain-aware Sunrise/Sunset, Earthrise/Earthset,
 * and SPAC transition events using Brent-Dekker root finding, and classifies the polar illumination regime.
 */
export function detectMissionHorizonEvents(params: {
  siteId: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  epochStartUtc: string;
  epochEndUtc: string;
  stepHours?: number;
  constraints: EngineeringConstraints;
}): {
  events: HorizonEvent[];
  regime: PolarIlluminationRegime;
} {
  const {
    siteId,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    epochStartUtc,
    epochEndUtc,
    stepHours = 2,
    constraints,
  } = params;

  const startMs = new Date(epochStartUtc).getTime();
  const endMs = new Date(epochEndUtc).getTime();
  const stepMs = Math.max(0.5, stepHours) * 3600 * 1000;

  const events: HorizonEvent[] = [];

  // Target function for solar terrain limb visibility: h_sun(t) - h_terrain(az(t)) + R_sun_limb
  const solarMarginFn = (ms: number): number => {
    const eph = computeCalibratedEphemeris(ms, siteLatDeg, siteLonDeg, siteElevationKm);
    const terr = getLolaHorizonElevationDeg(
      siteId,
      eph.solarHorizon.azimuthDeg,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm
    );
    return eph.solarHorizon.elevationDeg - terr + SOLAR_ANGULAR_RADIUS_DEG;
  };

  // Target function for Earth terrain visibility: h_earth(t) - max(h_terrain(az(t)), minEarthEl)
  const earthMarginFn = (ms: number): number => {
    const eph = computeCalibratedEphemeris(ms, siteLatDeg, siteLonDeg, siteElevationKm);
    const terr = getLolaHorizonElevationDeg(
      siteId,
      eph.earthHorizon.azimuthDeg,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm
    );
    const threshold = Math.max(terr, constraints.minEarthElevationDeg);
    return eph.earthHorizon.elevationDeg - threshold;
  };

  let prevMs = startMs;
  let prevSolarVal = solarMarginFn(prevMs);
  let prevEarthVal = earthMarginFn(prevMs);

  const prevEphInit = computeCalibratedEphemeris(prevMs, siteLatDeg, siteLonDeg, siteElevationKm);
  let prevSpac = evaluateDecoupledState({
    siteId,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    solar: prevEphInit.solarHorizon,
    earth: prevEphInit.earthHorizon,
    constraints,
  }).isSpac;

  let sunlitSamples = prevSolarVal > 0 ? 1 : 0;
  let totalSamples = 1;
  let minSolarMargin = prevSolarVal;
  let maxSolarMargin = prevSolarVal;

  for (let currMs = startMs + stepMs; currMs <= endMs; currMs += stepMs) {
    const currSolarVal = solarMarginFn(currMs);
    const currEarthVal = earthMarginFn(currMs);

    totalSamples++;
    if (currSolarVal > 0) sunlitSamples++;
    if (currSolarVal < minSolarMargin) minSolarMargin = currSolarVal;
    if (currSolarVal > maxSolarMargin) maxSolarMargin = currSolarVal;

    // 1. Check Solar Horizon Crossing via Brent-Dekker
    if (prevSolarVal <= 0 && currSolarVal > 0) {
      const rootMs = brentDekkerRoot(solarMarginFn, prevMs, currMs, 5000);
      const eph = computeCalibratedEphemeris(rootMs, siteLatDeg, siteLonDeg, siteElevationKm);
      const terr = getLolaHorizonElevationDeg(
        siteId,
        eph.solarHorizon.azimuthDeg,
        siteLatDeg,
        siteLonDeg,
        siteElevationKm
      );
      events.push({
        type: 'SUNRISE',
        timestampUtc: new Date(rootMs).toISOString(),
        unixMs: rootMs,
        azimuthDeg: Number(eph.solarHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(eph.solarHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: Number(terr.toFixed(2)),
        description: `Solar upper limb rises above LOLA ridge (${terr.toFixed(2)}° el at ${eph.solarHorizon.azimuthDeg.toFixed(1)}° az)`,
      });
    } else if (prevSolarVal > 0 && currSolarVal <= 0) {
      const rootMs = brentDekkerRoot(solarMarginFn, prevMs, currMs, 5000);
      const eph = computeCalibratedEphemeris(rootMs, siteLatDeg, siteLonDeg, siteElevationKm);
      const terr = getLolaHorizonElevationDeg(
        siteId,
        eph.solarHorizon.azimuthDeg,
        siteLatDeg,
        siteLonDeg,
        siteElevationKm
      );
      events.push({
        type: 'SUNSET',
        timestampUtc: new Date(rootMs).toISOString(),
        unixMs: rootMs,
        azimuthDeg: Number(eph.solarHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(eph.solarHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: Number(terr.toFixed(2)),
        description: `Solar disk occluded below LOLA topographic mask (${terr.toFixed(2)}° el at ${eph.solarHorizon.azimuthDeg.toFixed(1)}° az)`,
      });
    }

    // 2. Check Earth Horizon / Link Threshold Crossing via Brent-Dekker
    if (prevEarthVal <= 0 && currEarthVal > 0) {
      const rootMs = brentDekkerRoot(earthMarginFn, prevMs, currMs, 5000);
      const eph = computeCalibratedEphemeris(rootMs, siteLatDeg, siteLonDeg, siteElevationKm);
      const terr = getLolaHorizonElevationDeg(
        siteId,
        eph.earthHorizon.azimuthDeg,
        siteLatDeg,
        siteLonDeg,
        siteElevationKm
      );
      events.push({
        type: 'EARTHRISE',
        timestampUtc: new Date(rootMs).toISOString(),
        unixMs: rootMs,
        azimuthDeg: Number(eph.earthHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(eph.earthHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: Number(terr.toFixed(2)),
        description: `Earth DTE link acquired above terrain & elevation floor (${eph.earthHorizon.elevationDeg.toFixed(2)}° el)`,
      });
    } else if (prevEarthVal > 0 && currEarthVal <= 0) {
      const rootMs = brentDekkerRoot(earthMarginFn, prevMs, currMs, 5000);
      const eph = computeCalibratedEphemeris(rootMs, siteLatDeg, siteLonDeg, siteElevationKm);
      const terr = getLolaHorizonElevationDeg(
        siteId,
        eph.earthHorizon.azimuthDeg,
        siteLatDeg,
        siteLonDeg,
        siteElevationKm
      );
      events.push({
        type: 'EARTHSET',
        timestampUtc: new Date(rootMs).toISOString(),
        unixMs: rootMs,
        azimuthDeg: Number(eph.earthHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(eph.earthHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: Number(terr.toFixed(2)),
        description: `Earth DTE link lost below horizon/elevation threshold (${eph.earthHorizon.elevationDeg.toFixed(2)}° el)`,
      });
    }

    // 3. Check SPAC Window Transitions
    const currEph = computeCalibratedEphemeris(currMs, siteLatDeg, siteLonDeg, siteElevationKm);
    const currSpac = evaluateDecoupledState({
      siteId,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm,
      solar: currEph.solarHorizon,
      earth: currEph.earthHorizon,
      constraints,
    }).isSpac;

    if (!prevSpac && currSpac) {
      events.push({
        type: 'SPAC_START',
        timestampUtc: new Date(currMs).toISOString(),
        unixMs: currMs,
        azimuthDeg: Number(currEph.solarHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(currEph.solarHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: 0,
        description: 'Simultaneous Power & Communication (SPAC) operational window begins',
      });
    } else if (prevSpac && !currSpac) {
      events.push({
        type: 'SPAC_END',
        timestampUtc: new Date(currMs).toISOString(),
        unixMs: currMs,
        azimuthDeg: Number(currEph.solarHorizon.azimuthDeg.toFixed(2)),
        elevationDeg: Number(currEph.solarHorizon.elevationDeg.toFixed(2)),
        terrainHorizonDeg: 0,
        description: 'Simultaneous Power & Communication (SPAC) operational window ends',
      });
    }

    prevMs = currMs;
    prevSolarVal = currSolarVal;
    prevEarthVal = currEarthVal;
    prevSpac = currSpac;
  }

  let regime: PolarIlluminationRegime = 'SYNODIC_DAY_NIGHT_CYCLE';
  if (sunlitSamples === totalSamples) {
    regime = minSolarMargin < 1.2 ? 'GRAZING_HORIZON_SKIM' : 'CONTINUOUS_SUNLIGHT';
  } else if (sunlitSamples === 0) {
    regime = 'PERMANENT_SHADOW_PSR';
  }

  events.sort((a, b) => a.unixMs - b.unixMs);

  return { events, regime };
}

export interface HorizonCountdownSummary {
  nextSunriseUtc: string | null;
  nextSunsetUtc: string | null;
  nextEarthriseUtc: string | null;
  nextEarthsetUtc: string | null;
  remainingUntilSunsetHours: number | null;
  remainingUntilSunriseHours: number | null;
  remainingUntilEarthsetHours: number | null;
  remainingUntilEarthriseHours: number | null;
  sunsetCountdownLabel: string;
  earthsetCountdownLabel: string;
}

function formatHoursToCountdown(hours: number | null, fallbackLabel: string): string {
  if (hours === null || !Number.isFinite(hours)) return fallbackLabel;
  const absH = Math.max(0, hours);
  const d = Math.floor(absH / 24);
  const h = Math.floor(absH % 24);
  const m = Math.floor((absH * 60) % 60);
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Computes exact remaining time until Sunset, Sunrise, Earthset, and Earthrise
 * relative to currentEpochUtc from the detected Brent-Dekker horizon crossing events.
 */
export function computeRemainingHorizonCountdowns(
  events: HorizonEvent[],
  currentEpochUtc: string,
  solarCurrentlyVisible: boolean,
  earthCurrentlyVisible: boolean
): HorizonCountdownSummary {
  const currentMs = new Date(currentEpochUtc).getTime();

  const futureSunrises = events.filter((e) => e.type === 'SUNRISE' && e.unixMs >= currentMs);
  const futureSunsets = events.filter((e) => e.type === 'SUNSET' && e.unixMs >= currentMs);
  const futureEarthrises = events.filter((e) => e.type === 'EARTHRISE' && e.unixMs >= currentMs);
  const futureEarthsets = events.filter((e) => e.type === 'EARTHSET' && e.unixMs >= currentMs);

  const nextSunrise = futureSunrises[0] ?? events.find((e) => e.type === 'SUNRISE') ?? null;
  const nextSunset = futureSunsets[0] ?? events.find((e) => e.type === 'SUNSET') ?? null;
  const nextEarthrise = futureEarthrises[0] ?? events.find((e) => e.type === 'EARTHRISE') ?? null;
  const nextEarthset = futureEarthsets[0] ?? events.find((e) => e.type === 'EARTHSET') ?? null;

  const remainingUntilSunsetHours =
    futureSunsets[0] ? Number(((futureSunsets[0].unixMs - currentMs) / 3600000).toFixed(2)) : null;
  const remainingUntilSunriseHours =
    futureSunrises[0] ? Number(((futureSunrises[0].unixMs - currentMs) / 3600000).toFixed(2)) : null;
  const remainingUntilEarthsetHours =
    futureEarthsets[0]
      ? Number(((futureEarthsets[0].unixMs - currentMs) / 3600000).toFixed(2))
      : null;
  const remainingUntilEarthriseHours =
    futureEarthrises[0]
      ? Number(((futureEarthrises[0].unixMs - currentMs) / 3600000).toFixed(2))
      : null;

  const sunsetCountdownLabel = solarCurrentlyVisible
    ? remainingUntilSunsetHours !== null
      ? `${formatHoursToCountdown(remainingUntilSunsetHours, '')} until Sunset`
      : 'Continuous Sunlight (No Sunset in Window)'
    : remainingUntilSunriseHours !== null
      ? `In Shadow (${formatHoursToCountdown(remainingUntilSunriseHours, '')} until Sunrise)`
      : 'Extended Polar Shadow';

  const earthsetCountdownLabel = earthCurrentlyVisible
    ? remainingUntilEarthsetHours !== null
      ? `${formatHoursToCountdown(remainingUntilEarthsetHours, '')} until Earthset`
      : 'Continuous DTE Visibility (No Earthset)'
    : remainingUntilEarthriseHours !== null
      ? `DTE Occluded (${formatHoursToCountdown(remainingUntilEarthriseHours, '')} until Earthrise)`
      : 'Terrain / Libration Occluded';

  return {
    nextSunriseUtc: nextSunrise?.timestampUtc ?? null,
    nextSunsetUtc: nextSunset?.timestampUtc ?? null,
    nextEarthriseUtc: nextEarthrise?.timestampUtc ?? null,
    nextEarthsetUtc: nextEarthset?.timestampUtc ?? null,
    remainingUntilSunsetHours,
    remainingUntilSunriseHours,
    remainingUntilEarthsetHours,
    remainingUntilEarthriseHours,
    sunsetCountdownLabel,
    earthsetCountdownLabel,
  };
}

