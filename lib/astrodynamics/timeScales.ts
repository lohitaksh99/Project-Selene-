/**
 * Project Selene — Scientific Time Scales & NAIF SPICE LSK Epoch Engine (Version 2.1)
 * - Uses table-driven NAIF SPICE Leapseconds Kernel (naif0012.tls) for exact TAI - UTC step offsets (1972-present).
 * - Uses authoritative numeric SPICE Ephemeris Time (simulationEpochET: TDB seconds past J2000.0).
 * - Transforms UTC <-> TAI <-> Terrestrial Time (TT) <-> Barycentric Dynamical Time (TDB / ET) <-> Julian Date (JD).
 */

export interface TimeScaleRepresentation {
  utcIso: string;
  unixMs: number;
  etSecondsJ2000: number; // Authoritative SPICE ET / TDB seconds past J2000.0
  taiMinusUtcSeconds: number; // From validated NAIF LSK step table (e.g., 34s in 2009, 37s from 2017)
  jdUtc: number;
  jdTai: number;
  jdTt: number;
  jdTdb: number;
  julianCenturiesJ2000: number;
  deltaTtSeconds: number; // TT - UTC = (TAI - UTC) + 32.184s
}

export interface LunarPhaseInfo {
  phaseAngleDeg: number; // 0 = New, 90 = First Quarter, 180 = Full, 270 = Last Quarter
  illuminatedFraction: number; // 0.0 to 1.0
  illuminatedPercent: number; // 0.0 to 100.0
  phaseName:
    | 'New Moon'
    | 'Waxing Crescent'
    | 'First Quarter'
    | 'Waxing Gibbous'
    | 'Full Moon'
    | 'Waning Gibbous'
    | 'Last Quarter'
    | 'Waning Crescent';
  synodicAgeDays: number;
}

export interface SpiceLeapSecondEntry {
  effectiveUtcIso: string;
  effectiveUnixMs: number;
  taiMinusUtcSeconds: number;
}

export const J2000_JD = 2451545.0; // 2000-01-01T12:00:00.000 TT/TDB
export const J2000_UNIX_MS = 946728000000; // 2000-01-01T12:00:00.000Z
export const TT_MINUS_TAI_SECONDS = 32.184;

// NAIF SPICE naif0012.tls DELTET constants for TDB <-> TT periodic relativistic transformation
export const SPICE_DELTET_K = 1.657e-3;
export const SPICE_DELTET_EB = 1.671e-2;
export const SPICE_DELTET_M0 = 6.239996; // rad at J2000
export const SPICE_DELTET_M1 = 1.99096871e-7; // rad/s

export const SYNODIC_MONTH_DAYS = 29.530588853;
export const DRACONIC_MONTH_DAYS = 27.212220817;
export const ANOMALISTIC_MONTH_DAYS = 27.554549878;
export const SIDEREAL_MONTH_DAYS = 27.321661547;

/**
 * Authoritative NAIF SPICE `naif0012.tls` DELTET/DELTA_AT leap-second step table (1972-present).
 * Sorted chronologically so historical mission epochs (Apollo, Clementine, LCROSS 2009-10-09, LRO)
 * and modern Artemis epochs use the exact IERS/NAIF TAI - UTC offset.
 */
export const NAIF0012_LSK_TABLE: SpiceLeapSecondEntry[] = [
  { effectiveUtcIso: '1972-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1972-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 10 },
  { effectiveUtcIso: '1972-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1972-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 11 },
  { effectiveUtcIso: '1973-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1973-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 12 },
  { effectiveUtcIso: '1974-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1974-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 13 },
  { effectiveUtcIso: '1975-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1975-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 14 },
  { effectiveUtcIso: '1976-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1976-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 15 },
  { effectiveUtcIso: '1977-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1977-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 16 },
  { effectiveUtcIso: '1978-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1978-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 17 },
  { effectiveUtcIso: '1979-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1979-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 18 },
  { effectiveUtcIso: '1980-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1980-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 19 },
  { effectiveUtcIso: '1981-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1981-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 20 },
  { effectiveUtcIso: '1982-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1982-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 21 },
  { effectiveUtcIso: '1983-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1983-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 22 },
  { effectiveUtcIso: '1985-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1985-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 23 },
  { effectiveUtcIso: '1988-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1988-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 24 },
  { effectiveUtcIso: '1990-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1990-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 25 },
  { effectiveUtcIso: '1991-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1991-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 26 },
  { effectiveUtcIso: '1992-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1992-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 27 },
  { effectiveUtcIso: '1993-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1993-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 28 },
  { effectiveUtcIso: '1994-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1994-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 29 },
  { effectiveUtcIso: '1996-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1996-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 30 },
  { effectiveUtcIso: '1997-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1997-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 31 },
  { effectiveUtcIso: '1999-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('1999-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 32 },
  { effectiveUtcIso: '2006-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('2006-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 33 },
  { effectiveUtcIso: '2009-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('2009-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 34 },
  { effectiveUtcIso: '2012-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('2012-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 35 },
  { effectiveUtcIso: '2015-07-01T00:00:00.000Z', effectiveUnixMs: Date.parse('2015-07-01T00:00:00.000Z'), taiMinusUtcSeconds: 36 },
  { effectiveUtcIso: '2017-01-01T00:00:00.000Z', effectiveUnixMs: Date.parse('2017-01-01T00:00:00.000Z'), taiMinusUtcSeconds: 37 },
];

let activeLskTable: SpiceLeapSecondEntry[] = [...NAIF0012_LSK_TABLE];

/**
 * Looks up the exact NAIF SPICE `TAI - UTC` leap-second offset for a given UTC Unix millisecond timestamp.
 */
export function getTaiMinusUtcSeconds(
  unixMs: number,
  table: SpiceLeapSecondEntry[] = activeLskTable
): number {
  let offset = 10; // 1972 baseline
  for (let i = 0; i < table.length; i++) {
    const entry = table[i]!;
    if (unixMs >= entry.effectiveUnixMs) {
      offset = entry.taiMinusUtcSeconds;
    } else {
      break;
    }
  }
  return offset;
}

/**
 * Computes periodic relativistic `TDB - TT` offset in seconds using NAIF SPICE `naif0012.tls` formulation:
 * TDB - TT = K * sin(E), where E = M + EB * sin(M), and M = M0 + M1 * t_tt_seconds_past_j2000.
 */
export function computeSpiceTdbMinusTtSeconds(ttSecondsPastJ2000: number): number {
  const M = SPICE_DELTET_M0 + SPICE_DELTET_M1 * ttSecondsPastJ2000;
  const E = M + SPICE_DELTET_EB * Math.sin(M);
  return SPICE_DELTET_K * Math.sin(E);
}

/**
 * Validates and normalizes any input timestamp into a strict UTC ISO-8601 string.
 */
export function normalizeUtcIso(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid UTC timestamp input: ${String(input)}`);
  }
  return date.toISOString();
}

/**
 * Converts a UTC timestamp (ISO string, Date, or Unix ms) into SPICE Ephemeris Time (ET / TDB seconds past J2000.0).
 */
export function utcToEt(input: string | number | Date): number {
  const date = input instanceof Date ? input : new Date(input);
  const unixMs = date.getTime();
  if (Number.isNaN(unixMs)) {
    throw new Error(`Invalid UTC input for SPICE utcToEt: ${String(input)}`);
  }
  const utcSecondsPastJ2000 = (unixMs - J2000_UNIX_MS) / 1000.0;
  const taiMinusUtc = getTaiMinusUtcSeconds(unixMs);
  const ttSecondsPastJ2000 = utcSecondsPastJ2000 + taiMinusUtc + TT_MINUS_TAI_SECONDS;
  const tdbMinusTt = computeSpiceTdbMinusTtSeconds(ttSecondsPastJ2000);
  return ttSecondsPastJ2000 + tdbMinusTt;
}

/**
 * Converts SPICE Ephemeris Time (`etSecondsJ2000`: TDB seconds past J2000.0) into an exact UTC ISO-8601 string.
 * Uses 2-iteration Newton/fixed-point inversion of the periodic TDB - TT term (converges to < 10^-12 s).
 */
export function etToUtc(etSecondsJ2000: number): string {
  if (!Number.isFinite(etSecondsJ2000)) {
    throw new Error(`Invalid SPICE ET seconds: ${String(etSecondsJ2000)}`);
  }
  // Invert TDB -> TT (2 fixed-point iterations achieve sub-picosecond precision)
  let ttSec = etSecondsJ2000 - computeSpiceTdbMinusTtSeconds(etSecondsJ2000);
  ttSec = etSecondsJ2000 - computeSpiceTdbMinusTtSeconds(ttSec);

  // Initial estimate of UTC to resolve the exact leap-second step
  const approxUnixMs = J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - 37) * 1000.0;
  let taiMinusUtc = getTaiMinusUtcSeconds(approxUnixMs);
  const refinedUnixMs = J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - taiMinusUtc) * 1000.0;
  taiMinusUtc = getTaiMinusUtcSeconds(refinedUnixMs);

  const exactUnixMs = J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - taiMinusUtc) * 1000.0;
  return new Date(Math.round(exactUnixMs)).toISOString();
}

/**
 * Converts SPICE ET seconds past J2000.0 to exact floating-point Unix milliseconds (preserving sub-millisecond fraction).
 */
export function etToUnixMsExact(etSecondsJ2000: number): number {
  let ttSec = etSecondsJ2000 - computeSpiceTdbMinusTtSeconds(etSecondsJ2000);
  ttSec = etSecondsJ2000 - computeSpiceTdbMinusTtSeconds(ttSec);
  const approxUnixMs = J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - 37) * 1000.0;
  const taiMinusUtc = getTaiMinusUtcSeconds(approxUnixMs);
  const refinedUnixMs = J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - taiMinusUtc) * 1000.0;
  const finalTaiMinusUtc = getTaiMinusUtcSeconds(refinedUnixMs);
  return J2000_UNIX_MS + (ttSec - TT_MINUS_TAI_SECONDS - finalTaiMinusUtc) * 1000.0;
}

/**
 * Converts UTC Date or ISO string to full astrodynamics time scale representation
 * using the validated NAIF SPICE `naif0012.tls` leap-second table.
 */
export function computeTimeScales(input: string | number | Date): TimeScaleRepresentation {
  const date = input instanceof Date ? input : new Date(input);
  const unixMs = date.getTime();
  if (Number.isNaN(unixMs)) {
    throw new Error(`Invalid epoch for time scale transformation: ${String(input)}`);
  }

  const jdUtc = unixMs / 86400000.0 + 2440587.5;
  const taiMinusUtcSeconds = getTaiMinusUtcSeconds(unixMs);
  const deltaTtSeconds = Number((taiMinusUtcSeconds + TT_MINUS_TAI_SECONDS).toFixed(3));

  const jdTai = jdUtc + taiMinusUtcSeconds / 86400.0;
  const jdTt = jdUtc + deltaTtSeconds / 86400.0;

  const utcSecondsPastJ2000 = (unixMs - J2000_UNIX_MS) / 1000.0;
  const ttSecondsPastJ2000 = utcSecondsPastJ2000 + deltaTtSeconds;
  const tdbMinusTtSeconds = computeSpiceTdbMinusTtSeconds(ttSecondsPastJ2000);
  const etSecondsJ2000 = ttSecondsPastJ2000 + tdbMinusTtSeconds;

  const jdTdb = J2000_JD + etSecondsJ2000 / 86400.0;
  const julianCenturiesJ2000 = (jdTdb - J2000_JD) / 36525.0;

  return {
    utcIso: date.toISOString(),
    unixMs,
    etSecondsJ2000,
    taiMinusUtcSeconds,
    jdUtc,
    jdTai,
    jdTt,
    jdTdb,
    julianCenturiesJ2000,
    deltaTtSeconds,
  };
}

/**
 * Computes synodic lunar phase, illuminated percentage (as seen from Earth), and phase name.
 */
export function computeLunarPhase(input: string | number | Date): LunarPhaseInfo {
  const ts = computeTimeScales(input);
  const T = ts.julianCenturiesJ2000;

  // Mean elongation of the Moon from the Sun (D) in degrees (Meeus / IAU)
  const D =
    297.8501921 +
    445267.1114034 * T -
    0.0018819 * T * T +
    (T * T * T) / 545868.0 -
    (T * T * T * T) / 113065000.0;

  // Sun's mean anomaly (M)
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;

  // Moon's mean anomaly (M')
  const Mprime =
    134.9633964 +
    477198.8675055 * T +
    0.0087414 * T * T +
    (T * T * T) / 69699.0;

  const deg2rad = Math.PI / 180.0;
  const phaseAngleRaw =
    180.0 -
    D -
    6.289 * Math.sin(Mprime * deg2rad) +
    2.1 * Math.sin(M * deg2rad) -
    1.274 * Math.sin((2 * D - Mprime) * deg2rad) -
    0.658 * Math.sin(2 * D * deg2rad);

  const normalizedElongation = ((D % 360) + 360) % 360;
  const k = (1 + Math.cos(phaseAngleRaw * deg2rad)) / 2;
  const illuminatedFraction = Math.max(0, Math.min(1, k));
  const illuminatedPercent = Number((illuminatedFraction * 100).toFixed(1));
  const synodicAgeDays = Number(
    ((normalizedElongation / 360.0) * SYNODIC_MONTH_DAYS).toFixed(2)
  );

  let phaseName: LunarPhaseInfo['phaseName'] = 'New Moon';
  if (normalizedElongation < 22.5 || normalizedElongation >= 337.5) {
    phaseName = 'New Moon';
  } else if (normalizedElongation < 67.5) {
    phaseName = 'Waxing Crescent';
  } else if (normalizedElongation < 112.5) {
    phaseName = 'First Quarter';
  } else if (normalizedElongation < 157.5) {
    phaseName = 'Waxing Gibbous';
  } else if (normalizedElongation < 202.5) {
    phaseName = 'Full Moon';
  } else if (normalizedElongation < 247.5) {
    phaseName = 'Waning Gibbous';
  } else if (normalizedElongation < 292.5) {
    phaseName = 'Last Quarter';
  } else {
    phaseName = 'Waning Crescent';
  }

  return {
    phaseAngleDeg: Number(normalizedElongation.toFixed(2)),
    illuminatedFraction,
    illuminatedPercent,
    phaseName,
    synodicAgeDays,
  };
}
