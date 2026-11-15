/**
 * Phase 3 — NASA/JPL Horizons Ephemeris Service (`ssd.jpl.nasa.gov/api/horizons.api`)
 * Supports:
 *   A. OBSERVER EPHEMERIDES (RA/Dec, Sub-Observer/Sub-Solar Lon/Lat, Angular Diameter, Illuminated %, Range, Range-Rate)
 *   B. VECTORS (Cartesian Position X,Y,Z and Velocity VX,VY,VZ in ICRF/J2000, TDB/UTC)
 *   C. ELEMENTS (Osculating Keplerian Elements EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR)
 *
 * Verified Target Identifiers:
 *   - Moon: '301'
 *   - Earth: '399'
 *   - Sun: '10'
 *   - Lunar Reconnaissance Orbiter (LRO): '-85'
 *
 * Endpoint Normalization Note:
 *   JPL hosts documentation at `https://ssd-api.jpl.nasa.gov/doc/horizons.html`, while the live
 *   production API endpoint is `https://ssd.jpl.nasa.gov/api/horizons.api` (`ssd-api.jpl.nasa.gov/api/horizons.api`
 *   returns 404 on JPL's nginx). This service automatically normalizes any `ssd-api.jpl.nasa.gov` API URL
 *   to `https://ssd.jpl.nasa.gov/api/horizons.api` and records the normalization in provenance.
 */

import {
  fetchWithProvenanceCache,
  ScientificProvenanceEnvelope,
} from '@/lib/services/scientificProvenance';
import { computeTimeScales } from '@/lib/astrodynamics/timeScales';
import { moonMeTargetToHorizon } from '@/lib/astrodynamics/coordinateFrames';
import { computeCalibratedEphemeris } from '@/lib/astrodynamics/offlineCalibratedProvider';

export type HorizonsTargetId = '301' | '399' | '10' | '-85' | string;
export type HorizonsEphemType = 'OBSERVER' | 'VECTORS' | 'ELEMENTS';
export type HorizonsRefSystem = 'ICRF' | 'J2000';
export type HorizonsTimeType = 'TDB' | 'UT';
export type HorizonsOutUnits = 'KM-S' | 'AU-D' | 'KM-D';

export const HORIZONS_OFFICIAL_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

export const HORIZONS_KNOWN_TARGETS: Record<
  string,
  { id: string; name: string; description: string; category: 'NATURAL_BODY' | 'SPACECRAFT' }
> = {
  '301': {
    id: '301',
    name: 'Moon (Luna / 301)',
    description: 'Earth Moon center of mass (DE441 planetary and lunar ephemeris)',
    category: 'NATURAL_BODY',
  },
  '399': {
    id: '399',
    name: 'Earth (Geocenter / 399)',
    description: 'Earth center of mass (DE441)',
    category: 'NATURAL_BODY',
  },
  '10': {
    id: '10',
    name: 'Sun (Heliocenter / 10)',
    description: 'Solar center of mass (DE441)',
    category: 'NATURAL_BODY',
  },
  '-85': {
    id: '-85',
    name: 'Lunar Reconnaissance Orbiter (LRO / -85)',
    description: 'NASA LRO spacecraft trajectory kernel (when within active JPL SPK coverage window)',
    category: 'SPACECRAFT',
  },
};

export interface HorizonsQueryConfig {
  command: HorizonsTargetId;
  center: string; // e.g., '500@399' (Geocentric), '500@301' (Selenocentric), '500@10' (Heliocentric), '500@0' (SSB)
  startTime: string; // e.g., '2027-02-01T00:00'
  stopTime: string; // e.g., '2027-02-02T00:00'
  stepSize: string; // e.g., '6 h' or '1 d'
  ephemType: HorizonsEphemType;
  refSystem?: HorizonsRefSystem;
  timeType?: HorizonsTimeType;
  outUnits?: HorizonsOutUnits;
  quantities?: string; // For OBSERVER mode: default '1,14,15,17,20,24'
}

export interface HorizonsObserverRecord {
  timestampUtc: string;
  raHms?: string;
  decDms?: string;
  raDeg?: number;
  decDeg?: number;
  obsSubLonDeg?: number;
  obsSubLatDeg?: number;
  sunSubLonDeg?: number;
  sunSubLatDeg?: number;
  northPolePosAngleDeg?: number;
  northPoleDistArcsec?: number;
  deltaAu?: number;
  deltaKm?: number;
  deldotKmS?: number;
  illuminatedFractionPct?: number;
  rawLine: string;
}

export interface HorizonsVectorRecord {
  jdTdb: number;
  calendarDateTdb: string;
  position: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
  lightTimeSec?: number;
  rangeModulus?: number;
  rangeRate?: number;
  units: HorizonsOutUnits;
  referenceFrame: string;
}

export interface HorizonsElementRecord {
  jdTdb: number;
  calendarDateTdb: string;
  eccentricity: number; // EC
  periapsisDistKmOrAu: number; // QR
  inclinationDeg: number; // IN
  longitudeOfAscendingNodeDeg: number; // OM
  argumentOfPeriapsisDeg: number; // W
  timeOfPeriapsisJd: number; // Tp
  meanMotionDegPerDay: number; // N
  meanAnomalyDeg: number; // MA
  trueAnomalyDeg: number; // TA
  semiMajorAxisKmOrAu: number; // A
  apoapsisDistKmOrAu: number; // AD
  orbitalPeriodDays: number; // PR
}

export interface HorizonsParsedResponse {
  query: HorizonsQueryConfig;
  signatureVersion: string;
  targetBodyName: string;
  centerBodyName: string;
  sourceKernel: string;
  referenceFrame: string;
  timeScale: 'TDB' | 'UTC';
  rawSoeBlock: string;
  observerRecords?: HorizonsObserverRecord[];
  vectorRecords?: HorizonsVectorRecord[];
  elementRecords?: HorizonsElementRecord[];
  provenance: ScientificProvenanceEnvelope;
}

/**
 * Normalizes any Horizons API endpoint URL so `ssd-api.jpl.nasa.gov/api/horizons.api`
 * is transparently rewritten to the live JPL endpoint `https://ssd.jpl.nasa.gov/api/horizons.api`.
 */
export function normalizeHorizonsEndpointUrl(inputUrl?: string): {
  url: string;
  wasRewritten: boolean;
} {
  if (!inputUrl || inputUrl.includes('ssd-api.jpl.nasa.gov')) {
    return {
      url: HORIZONS_OFFICIAL_API_URL,
      wasRewritten: Boolean(inputUrl && inputUrl.includes('ssd-api.jpl.nasa.gov')),
    };
  }
  return { url: inputUrl, wasRewritten: false };
}

/**
 * Converts sexagesimal RA (`HH MM SS.ff`) and Dec (`+DD MM SS.f`) strings into decimal degrees.
 */
function parseSexagesimalRaDec(
  raStr: string,
  decStr: string
): { raDeg?: number; decDeg?: number } {
  const raParts = raStr.trim().split(/\s+/).map(Number);
  const decParts = decStr.trim().split(/\s+/);
  let raDeg: number | undefined;
  let decDeg: number | undefined;

  if (raParts.length === 3 && raParts.every((n) => Number.isFinite(n))) {
    raDeg = Number(((raParts[0]! + raParts[1]! / 60.0 + raParts[2]! / 3600.0) * 15.0).toFixed(6));
  }
  if (decParts.length === 3) {
    const sign = decParts[0]!.startsWith('-') ? -1 : 1;
    const d = Math.abs(Number(decParts[0]));
    const m = Number(decParts[1]);
    const s = Number(decParts[2]);
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(s)) {
      decDeg = Number((sign * (d + m / 60.0 + s / 3600.0)).toFixed(6));
    }
  }
  return { raDeg, decDeg };
}

/**
 * Parses a JPL Horizons `VECTORS` `$$SOE ... $$EOE` text block.
 * Format per epoch:
 *   2461438.500000000 = A.D. 2027-Feb-01 00:00:00.0000 TDB
 *    X = ... Y = ... Z = ...
 *    VX= ... VY= ... VZ= ...
 *    LT= ... RG= ... RR= ...
 */
export function parseHorizonsVectorsBlock(
  soeBlock: string,
  outUnits: HorizonsOutUnits,
  referenceFrame: string
): HorizonsVectorRecord[] {
  const records: HorizonsVectorRecord[] = [];
  const lines = soeBlock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const numPattern = '[-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?';
  const xyzRegex = new RegExp(
    `X\\s*=\\s*(${numPattern})\\s*Y\\s*=\\s*(${numPattern})\\s*Z\\s*=\\s*(${numPattern})`,
    'i'
  );
  const vxyzRegex = new RegExp(
    `VX\\s*=\\s*(${numPattern})\\s*VY\\s*=\\s*(${numPattern})\\s*VZ\\s*=\\s*(${numPattern})`,
    'i'
  );
  const ltRgRrRegex = new RegExp(
    `LT\\s*=\\s*(${numPattern})\\s*RG\\s*=\\s*(${numPattern})\\s*RR\\s*=\\s*(${numPattern})`,
    'i'
  );

  for (let i = 0; i < lines.length; i++) {
    const headerLine = lines[i]!;
    const jdMatch = headerLine.match(/^(\d+\.\d+)\s*=\s*(?:A\.D\.\s*)?(.+)$/i);
    if (!jdMatch) continue;

    const jdTdb = Number(jdMatch[1]);
    const calendarDateTdb = jdMatch[2]!.trim();
    const posLine = lines[i + 1] || '';
    const velLine = lines[i + 2] || '';
    const ltLine = lines[i + 3] || '';

    const posMatch = posLine.match(xyzRegex);
    const velMatch = velLine.match(vxyzRegex);
    if (!posMatch || !velMatch) continue;

    const ltMatch = ltLine.match(ltRgRrRegex);
    const px = Number(posMatch[1]);
    const py = Number(posMatch[2]);
    const pz = Number(posMatch[3]);
    const computedRange = Number(Math.sqrt(px * px + py * py + pz * pz).toFixed(4));

    records.push({
      jdTdb,
      calendarDateTdb,
      position: {
        x: px,
        y: py,
        z: pz,
      },
      velocity: {
        vx: Number(velMatch[1]),
        vy: Number(velMatch[2]),
        vz: Number(velMatch[3]),
      },
      lightTimeSec: ltMatch ? Number(ltMatch[1]) : undefined,
      rangeModulus: ltMatch ? Number(ltMatch[2]) : computedRange,
      rangeRate: ltMatch ? Number(ltMatch[3]) : undefined,
      units: outUnits,
      referenceFrame,
    });
  }

  return records;
}

/**
 * Parses a JPL Horizons `ELEMENTS` `$$SOE ... $$EOE` text block.
 * Format per epoch:
 *   2461438.500000000 = A.D. 2027-Feb-01 00:00:00.0000 TDB
 *    EC= ... QR= ... IN= ...
 *    OM= ... W = ... Tp= ...
 *    N = ... MA= ... TA= ...
 *    A = ... AD= ... PR= ...
 */
export function parseHorizonsElementsBlock(soeBlock: string): HorizonsElementRecord[] {
  const records: HorizonsElementRecord[] = [];
  const lines = soeBlock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const extractVal = (text: string, key: string): number => {
    const regex = new RegExp(`\\b${key}\\s*=\\s*([-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)`, 'i');
    const m = text.match(regex);
    return m && m[1] ? Number(m[1]) : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const headerLine = lines[i]!;
    const jdMatch = headerLine.match(/^(\d+\.\d+)\s*=\s*(?:A\.D\.\s*)?(.+)$/i);
    if (!jdMatch) continue;

    const jdTdb = Number(jdMatch[1]);
    const calendarDateTdb = jdMatch[2]!.trim();
    const chunk = [lines[i + 1], lines[i + 2], lines[i + 3], lines[i + 4]].filter(Boolean).join(' ');

    if (!chunk.includes('EC=')) continue;

    records.push({
      jdTdb,
      calendarDateTdb,
      eccentricity: extractVal(chunk, 'EC'),
      periapsisDistKmOrAu: extractVal(chunk, 'QR'),
      inclinationDeg: extractVal(chunk, 'IN'),
      longitudeOfAscendingNodeDeg: extractVal(chunk, 'OM'),
      argumentOfPeriapsisDeg: extractVal(chunk, 'W'),
      timeOfPeriapsisJd: extractVal(chunk, 'Tp'),
      meanMotionDegPerDay: extractVal(chunk, 'N'),
      meanAnomalyDeg: extractVal(chunk, 'MA'),
      trueAnomalyDeg: extractVal(chunk, 'TA'),
      semiMajorAxisKmOrAu: extractVal(chunk, 'A'),
      apoapsisDistKmOrAu: extractVal(chunk, 'AD'),
      orbitalPeriodDays: extractVal(chunk, 'PR'),
    });
  }

  return records;
}

/**
 * Parses a JPL Horizons CSV-formatted `OBSERVER` `$$SOE ... $$EOE` block (`CSV_FORMAT='YES'`).
 * Quantities `'1,14,15,20'`:
 *   Col 0: Date__(UT)__HR:MN
 *   Col 1: solar presence marker
 *   Col 2: lunar/interfering marker
 *   Col 3: R.A._(ICRF)
 *   Col 4: DEC_(ICRF)
 *   Col 5: ObsSub-LON
 *   Col 6: ObsSub-LAT
 *   Col 7: SunSub-LON
 *   Col 8: SunSub-LAT
 *   Col 9: delta (AU)
 *   Col 10: deldot (km/s)
 */
export function parseHorizonsObserverCsvBlock(soeBlock: string): HorizonsObserverRecord[] {
  const AU_TO_KM = 149597870.7;
  const records: HorizonsObserverRecord[] = [];
  const lines = soeBlock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 6) continue;

    const timestampUtc = cols[0] || '';
    const raHms = cols[3] || '';
    const decDms = cols[4] || '';
    const { raDeg, decDeg } = parseSexagesimalRaDec(raHms, decDms);

    const parseOptionalNum = (val?: string): number | undefined => {
      if (!val || val === 'n.a.') return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    const obsSubLonDeg = parseOptionalNum(cols[5]);
    const obsSubLatDeg = parseOptionalNum(cols[6]);
    const sunSubLonDeg = parseOptionalNum(cols[7]);
    const sunSubLatDeg = parseOptionalNum(cols[8]);
    const deltaAu = parseOptionalNum(cols[9]);
    const deldotKmS = parseOptionalNum(cols[10]);

    records.push({
      timestampUtc,
      raHms: raHms || undefined,
      decDms: decDms || undefined,
      raDeg,
      decDeg,
      obsSubLonDeg,
      obsSubLatDeg,
      sunSubLonDeg,
      sunSubLatDeg,
      deltaAu,
      deltaKm: deltaAu !== undefined ? Number((deltaAu * AU_TO_KM).toFixed(2)) : undefined,
      deldotKmS,
      rawLine: line,
    });
  }

  return records;
}

/**
 * Executes a validated NASA/JPL Horizons query (`OBSERVER`, `VECTORS`, or `ELEMENTS`),
 * preserving time scales (`TDB` vs `UTC`) and coordinate reference frames (`ICRF/J2000` vs `IAU_MOON`).
 */
export async function queryJplHorizons(
  config: HorizonsQueryConfig
): Promise<HorizonsParsedResponse> {
  const {
    command = '301',
    center = '500@399',
    startTime: rawStartTime,
    stopTime: rawStopTime,
    stepSize = '6 h',
    ephemType = 'VECTORS',
    refSystem = 'ICRF',
    timeType = 'TDB',
    outUnits = 'KM-S',
    quantities = '1,14,15,20',
  } = config;

  const sanitizeHorizonsTime = (t: string) =>
    t.replace('T', ' ').replace(/Z$/i, '').slice(0, 16).trim();
  const startTime = sanitizeHorizonsTime(rawStartTime);
  const stopTime = sanitizeHorizonsTime(rawStopTime);

  const { url: baseEndpoint } = normalizeHorizonsEndpointUrl(
    'https://ssd-api.jpl.nasa.gov/api/horizons.api'
  );

  const searchParams = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: `'${ephemType}'`,
    CENTER: `'${center}'`,
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: `'${stepSize}'`,
    REF_SYSTEM: `'${refSystem}'`,
  });

  if (ephemType === 'VECTORS') {
    searchParams.set('OUT_UNITS', `'${outUnits}'`);
    searchParams.set('REF_PLANE', "'FRAME'");
    searchParams.set('VEC_TABLE', "'2'");
  } else if (ephemType === 'ELEMENTS') {
    searchParams.set('OUT_UNITS', `'${outUnits}'`);
    searchParams.set('REF_PLANE', "'ECLIPTIC'");
  } else if (ephemType === 'OBSERVER') {
    searchParams.set('QUANTITIES', `'${quantities}'`);
    searchParams.set('CSV_FORMAT', "'YES'");
    searchParams.set('ANG_FORMAT', "'HMS'");
  }

  const fullUrl = `${baseEndpoint}?${searchParams.toString()}`;
  const cacheKey = `horizons:${ephemType}:${command}:${center}:${startTime}:${stopTime}:${stepSize}:${refSystem}:${outUnits}`;

  const res = await fetchWithProvenanceCache({
    cacheKey,
    serviceName: 'JPL_HORIZONS_REST',
    url: fullUrl,
    responseType: 'text',
    ttlMs: 1000 * 60 * 60 * 12,
    baseProvenance: {
      source: 'JPL_HORIZONS_REST',
      providerOrganization: 'NASA/JPL Solar System Dynamics Group (ssd.jpl.nasa.gov)',
      datasetIdentifier: `Horizons_${ephemType}_${command}_from_${center}`,
      datasetVersion: 'API v1.2 / DE441',
      nativeCrs: ephemType === 'OBSERVER' ? 'IAU_MOON_ME' : 'ICRF/J2000',
      longitudeConvention:
        ephemType === 'OBSERVER' ? '[0,360]_EAST' : 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'Selenocenter / Target Center of Mass (DE441)',
      nativeUnits: ephemType === 'OBSERVER' ? 'deg, AU, km/s' : outUnits,
      timeScale: ephemType === 'OBSERVER' ? 'UTC' : 'TDB_ET',
      isNumericalDem: false,
      processingHistory: [
        'Normalized ssd-api.jpl.nasa.gov documentation domain to live endpoint https://ssd.jpl.nasa.gov/api/horizons.api',
        `Executed JPL Horizons ${ephemType} query for COMMAND=${command}, CENTER=${center}`,
      ],
      warnings: [],
    },
  });

  if (!res.payloadText) {
    throw new Error('Empty response from JPL Horizons API');
  }

  const parsedJson = JSON.parse(res.payloadText) as {
    signature?: { version?: string; source?: string };
    error?: string;
    result?: string;
  };

  if (parsedJson.error) {
    throw new Error(`JPL Horizons Error: ${parsedJson.error}`);
  }

  const rawText = parsedJson.result || '';
  const targetMatch = rawText.match(/Target body name:\s*([^\n{]+)(?:\{source:\s*([^}]+)\})?/i);
  const centerMatch = rawText.match(/Center body name:\s*([^\n{]+)/i);
  const refFrameMatch = rawText.match(/Reference frame\s*:\s*([^\n]+)/i);

  const targetBodyName = targetMatch?.[1]?.trim() || HORIZONS_KNOWN_TARGETS[command]?.name || command;
  const sourceKernel = targetMatch?.[2]?.trim() || 'DE441';
  const centerBodyName = centerMatch?.[1]?.trim() || center;
  const referenceFrame = refFrameMatch?.[1]?.trim() || `${refSystem} (J2000.0)`;

  const soeMatch = rawText.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!soeMatch || !soeMatch[1]) {
    throw new Error(
      `JPL Horizons response did not contain a $$SOE...$$EOE ephemeris block for COMMAND=${command}. Details: ${rawText.slice(
        0,
        280
      )}`
    );
  }
  const rawSoeBlock = soeMatch[1].trim();

  const output: HorizonsParsedResponse = {
    query: {
      command,
      center,
      startTime,
      stopTime,
      stepSize,
      ephemType,
      refSystem,
      timeType,
      outUnits,
      quantities,
    },
    signatureVersion: parsedJson.signature?.version || '1.2',
    targetBodyName,
    centerBodyName,
    sourceKernel,
    referenceFrame,
    timeScale: ephemType === 'OBSERVER' ? 'UTC' : 'TDB',
    rawSoeBlock,
    provenance: res.provenance,
  };

  if (ephemType === 'VECTORS') {
    output.vectorRecords = parseHorizonsVectorsBlock(rawSoeBlock, outUnits, referenceFrame);
  } else if (ephemType === 'ELEMENTS') {
    output.elementRecords = parseHorizonsElementsBlock(rawSoeBlock);
  } else if (ephemType === 'OBSERVER') {
    output.observerRecords = parseHorizonsObserverCsvBlock(rawSoeBlock);
  }

  return output;
}

/**
 * Fetches live JPL Horizons DE441 Lunar Sun-Earth geometry for a specific UTC epoch
 * and site coordinate, converting the validated Horizons sub-solar and sub-observer
 * selenographic coordinates into Project Selene's topocentric ENU solar and Earth horizon angles.
 * Automatically falls back to the local validated DE441-MOON_ME analytical solver if offline.
 */
export async function fetchHorizonsSyncedLunarGeometry(params: {
  epochUtc: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
}): Promise<{
  epochUtc: string;
  jdTdb: number;
  etSecondsJ2000: number;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
  subEarthLatDeg: number;
  subEarthLonDeg: number;
  earthMoonRangeKm: number;
  solarHorizon: { azimuthDeg: number; elevationDeg: number; rangeKm: number };
  earthHorizon: { azimuthDeg: number; elevationDeg: number; rangeKm: number };
  horizonsVectors?: HorizonsVectorRecord;
  sourceMode: 'LIVE_JPL_HORIZONS_DE441' | 'ANALYTICAL_DE441_FALLBACK';
  provenance: ScientificProvenanceEnvelope;
}> {
  const { epochUtc, siteLatDeg, siteLonDeg, siteElevationKm } = params;
  const timeScales = computeTimeScales(epochUtc);

  // Format start/stop time 1 hour apart for JPL Horizons
  const startMs = new Date(timeScales.utcIso).getTime();
  const stopMs = startMs + 3600 * 1000;
  const fmtHorizonsUtc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

  try {
    const [obsRes, vecRes] = await Promise.all([
      queryJplHorizons({
        command: '301',
        center: '500@399',
        startTime: fmtHorizonsUtc(startMs),
        stopTime: fmtHorizonsUtc(stopMs),
        stepSize: '1 h',
        ephemType: 'OBSERVER',
        quantities: '1,14,15,20',
      }),
      queryJplHorizons({
        command: '301',
        center: '500@399',
        startTime: fmtHorizonsUtc(startMs),
        stopTime: fmtHorizonsUtc(stopMs),
        stepSize: '1 h',
        ephemType: 'VECTORS',
        outUnits: 'KM-S',
      }),
    ]);

    const firstObs = obsRes.observerRecords?.[0];
    const firstVec = vecRes.vectorRecords?.[0];

    if (
      firstObs &&
      firstObs.sunSubLatDeg !== undefined &&
      firstObs.sunSubLonDeg !== undefined &&
      firstObs.obsSubLatDeg !== undefined &&
      firstObs.obsSubLonDeg !== undefined
    ) {
      // Convert [0, 360] East longitude to [-180, +180] East
      const wrap180 = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
      const subSolarLatDeg = firstObs.sunSubLatDeg;
      const subSolarLonDeg = wrap180(firstObs.sunSubLonDeg);
      const subEarthLatDeg = firstObs.obsSubLatDeg;
      const subEarthLonDeg = wrap180(firstObs.obsSubLonDeg);
      const earthRangeKm = firstObs.deltaKm || 384400;
      const solarRangeKm = 149597870.7;

      const R_MOON_KM = 1737.4;
      const degToRad = Math.PI / 180.0;

      // Construct Moon-fixed (IAU_MOON_ME) Cartesian vectors from Horizons sub-solar and sub-Earth points
      const sLatR = subSolarLatDeg * degToRad;
      const sLonR = subSolarLonDeg * degToRad;
      const sunMoonFixed = {
        x: solarRangeKm * Math.cos(sLatR) * Math.cos(sLonR),
        y: solarRangeKm * Math.cos(sLatR) * Math.sin(sLonR),
        z: solarRangeKm * Math.sin(sLatR),
      };

      const eLatR = subEarthLatDeg * degToRad;
      const eLonR = subEarthLonDeg * degToRad;
      const earthMoonFixed = {
        x: earthRangeKm * Math.cos(eLatR) * Math.cos(eLonR),
        y: earthRangeKm * Math.cos(eLatR) * Math.sin(eLonR),
        z: earthRangeKm * Math.sin(eLatR),
      };

      const siteLatR = siteLatDeg * degToRad;
      const siteLonR = siteLonDeg * degToRad;
      const rSite = R_MOON_KM + siteElevationKm;
      const siteMoonFixed = {
        x: rSite * Math.cos(siteLatR) * Math.cos(siteLonR),
        y: rSite * Math.cos(siteLatR) * Math.sin(siteLonR),
        z: rSite * Math.sin(siteLatR),
      };

      const solarHorizon = moonMeTargetToHorizon(
        siteLatDeg,
        siteLonDeg,
        siteElevationKm,
        sunMoonFixed
      );
      const earthHorizon = moonMeTargetToHorizon(
        siteLatDeg,
        siteLonDeg,
        siteElevationKm,
        earthMoonFixed
      );

      return {
        epochUtc: timeScales.utcIso,
        jdTdb: timeScales.jdTdb,
        etSecondsJ2000: timeScales.etSecondsJ2000,
        subSolarLatDeg,
        subSolarLonDeg,
        subEarthLatDeg,
        subEarthLonDeg,
        earthMoonRangeKm: earthRangeKm,
        solarHorizon,
        earthHorizon,
        horizonsVectors: firstVec,
        sourceMode: 'LIVE_JPL_HORIZONS_DE441',
        provenance: obsRes.provenance,
      };
    }
  } catch {
    // Fall through to analytical fallback below
  }

  const fallback = computeCalibratedEphemeris(
    timeScales.utcIso,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm
  );

  return {
    epochUtc: timeScales.utcIso,
    jdTdb: timeScales.jdTdb,
    etSecondsJ2000: timeScales.etSecondsJ2000,
    subSolarLatDeg: fallback.subSolarLatDeg,
    subSolarLonDeg: fallback.subSolarLonDeg,
    subEarthLatDeg: fallback.subEarthLatDeg,
    subEarthLonDeg: fallback.subEarthLonDeg,
    earthMoonRangeKm: fallback.earthHorizon.rangeKm,
    solarHorizon: fallback.solarHorizon,
    earthHorizon: fallback.earthHorizon,
    sourceMode: 'ANALYTICAL_DE441_FALLBACK',
    provenance: {
      source: 'LOCAL_ANALYTICAL_DE441',
      providerOrganization: 'Project Selene Validated DE441-MOON_ME Analytical Engine',
      endpointUrl: 'internal://lib/astrodynamics/coordinateFrames',
      datasetIdentifier: 'DE441_Analytical_Fallback',
      datasetVersion: 'v2.1',
      nativeCrs: 'IAU_MOON_ME',
      longitudeConvention: '[-180,+180]_EAST',
      elevationDatum: 'IAU 1737.4 km Sphere',
      nativeUnits: 'deg, km',
      timeScale: 'TDB_ET',
      retrievedAtUtc: new Date().toISOString(),
      cacheStatus: 'FALLBACK_SYNTHESIS',
      isNumericalDem: false,
      processingHistory: ['Computed via local DE441-MOON_ME analytical ephemeris fallback'],
      warnings: ['Live JPL Horizons network unavailable; using local analytical DE441 solver.'],
    },
  };
}
