import { NextRequest, NextResponse } from 'next/server';
import {
  fetchHorizonsSyncedLunarGeometry,
  HORIZONS_KNOWN_TARGETS,
  HorizonsEphemType,
  HorizonsOutUnits,
  HorizonsRefSystem,
  HorizonsTimeType,
  queryJplHorizons,
} from '@/lib/services/horizonsService';
import {
  checkProviderRateLimit,
  getClientIdentifier,
  readBoundedJsonBody,
  sanitizePublicError,
  validateSameOriginMutation,
} from '@/lib/security/proxyGuard';

const ALLOWED_EPHEM_TYPES = new Set<HorizonsEphemType>(['OBSERVER', 'VECTORS', 'ELEMENTS']);
const ALLOWED_REF_SYSTEMS = new Set<HorizonsRefSystem>(['ICRF', 'J2000']);
const ALLOWED_TIME_TYPES = new Set<HorizonsTimeType>(['TDB', 'UT']);
const ALLOWED_OUT_UNITS = new Set<HorizonsOutUnits>(['KM-S', 'AU-D', 'KM-D']);

function sanitizeHorizonsParam(raw: string | null | undefined, fallback: string, maxLen = 40): string {
  const v = String(raw ?? fallback).trim();
  if (!v || v.length > maxLen || !/^[a-zA-Z0-9@._:+T\s-]+$/.test(v)) {
    return fallback;
  }
  return v;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'query';
  const rate = checkProviderRateLimit('JPL_HORIZONS_REST', getClientIdentifier(req));
  if (!rate.allowed) {
    return NextResponse.json(
      { status: 'error', action, message: 'Horizons proxy rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  try {
    if (action === 'targets') {
      return NextResponse.json({
        status: 'ok',
        targets: HORIZONS_KNOWN_TARGETS,
      });
    }

    if (action === 'lunar-geometry') {
      const epochUtc = sanitizeHorizonsParam(searchParams.get('epochUtc'), '2027-06-09T19:21:00Z');
      const siteLatDeg = Math.max(-90, Math.min(90, Number(searchParams.get('siteLat') ?? -89.78) || -89.78));
      const siteLonDeg = Math.max(-180, Math.min(360, Number(searchParams.get('siteLon') ?? 120.45) || 120.45));
      const siteElevationKm = Math.max(-12, Math.min(15, Number(searchParams.get('siteElevKm') ?? 2.15) || 2.15));

      const geometry = await fetchHorizonsSyncedLunarGeometry({
        epochUtc,
        siteLatDeg,
        siteLonDeg,
        siteElevationKm,
      });

      return NextResponse.json({
        status: 'ok',
        action: 'lunar-geometry',
        data: geometry,
      });
    }

    const command = sanitizeHorizonsParam(searchParams.get('command') || searchParams.get('COMMAND'), '301', 24);
    const center = sanitizeHorizonsParam(searchParams.get('center') || searchParams.get('CENTER'), '500@399', 24);
    const startTime = sanitizeHorizonsParam(
      searchParams.get('startTime') || searchParams.get('START_TIME'),
      '2027-06-09',
      32
    );
    const stopTime = sanitizeHorizonsParam(
      searchParams.get('stopTime') || searchParams.get('STOP_TIME'),
      '2027-06-10',
      32
    );
    const stepSize = sanitizeHorizonsParam(
      searchParams.get('stepSize') || searchParams.get('STEP_SIZE'),
      '6 h',
      16
    );
    const rawEphem = (searchParams.get('ephemType') || searchParams.get('EPHEM_TYPE') || 'VECTORS').toUpperCase() as HorizonsEphemType;
    const ephemType = ALLOWED_EPHEM_TYPES.has(rawEphem) ? rawEphem : 'VECTORS';
    const rawRef = (searchParams.get('refSystem') || searchParams.get('REF_SYSTEM') || 'ICRF').toUpperCase() as HorizonsRefSystem;
    const refSystem = ALLOWED_REF_SYSTEMS.has(rawRef) ? rawRef : 'ICRF';
    const rawTime = (searchParams.get('timeType') || searchParams.get('TIME_TYPE') || 'TDB').toUpperCase() as HorizonsTimeType;
    const timeType = ALLOWED_TIME_TYPES.has(rawTime) ? rawTime : 'TDB';
    const rawUnits = (searchParams.get('outUnits') || searchParams.get('OUT_UNITS') || 'KM-S').toUpperCase() as HorizonsOutUnits;
    const outUnits = ALLOWED_OUT_UNITS.has(rawUnits) ? rawUnits : 'KM-S';

    const parsed = await queryJplHorizons({
      command,
      center,
      startTime,
      stopTime,
      stepSize,
      ephemType,
      refSystem,
      timeType,
      outUnits,
    });

    return NextResponse.json({
      status: 'ok',
      action: 'query',
      data: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        action,
        message: sanitizePublicError(err),
      },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const originCheck = validateSameOriginMutation(req);
  if (!originCheck.ok) {
    return NextResponse.json({ status: 'error', message: originCheck.reason }, { status: 403 });
  }
  const rate = checkProviderRateLimit('JPL_HORIZONS_REST', getClientIdentifier(req));
  if (!rate.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'Horizons proxy rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  const parsedBody = await readBoundedJsonBody<{
    action?: string;
    command?: string;
    center?: string;
    startTime?: string;
    stopTime?: string;
    stepSize?: string;
    ephemType?: HorizonsEphemType;
    refSystem?: HorizonsRefSystem;
    timeType?: HorizonsTimeType;
    outUnits?: HorizonsOutUnits;
    epochUtc?: string;
    siteLatDeg?: number;
    siteLonDeg?: number;
    siteElevationKm?: number;
  }>(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ status: 'error', message: parsedBody.error }, { status: parsedBody.status });
  }

  const body = parsedBody.data;
  try {
    if (body.action === 'lunar-geometry') {
      const geometry = await fetchHorizonsSyncedLunarGeometry({
        epochUtc: sanitizeHorizonsParam(body.epochUtc, '2027-06-09T19:21:00Z'),
        siteLatDeg: Math.max(-90, Math.min(90, Number(body.siteLatDeg ?? -89.78) || -89.78)),
        siteLonDeg: Math.max(-180, Math.min(360, Number(body.siteLonDeg ?? 120.45) || 120.45)),
        siteElevationKm: Math.max(-12, Math.min(15, Number(body.siteElevationKm ?? 2.15) || 2.15)),
      });
      return NextResponse.json({
        status: 'ok',
        action: 'lunar-geometry',
        data: geometry,
      });
    }

    const parsed = await queryJplHorizons({
      command: sanitizeHorizonsParam(body.command, '301', 24),
      center: sanitizeHorizonsParam(body.center, '500@399', 24),
      startTime: sanitizeHorizonsParam(body.startTime, '2027-06-09', 32),
      stopTime: sanitizeHorizonsParam(body.stopTime, '2027-06-10', 32),
      stepSize: sanitizeHorizonsParam(body.stepSize, '6 h', 16),
      ephemType: body.ephemType && ALLOWED_EPHEM_TYPES.has(body.ephemType) ? body.ephemType : 'VECTORS',
      refSystem: body.refSystem && ALLOWED_REF_SYSTEMS.has(body.refSystem) ? body.refSystem : 'ICRF',
      timeType: body.timeType && ALLOWED_TIME_TYPES.has(body.timeType) ? body.timeType : 'TDB',
      outUnits: body.outUnits && ALLOWED_OUT_UNITS.has(body.outUnits) ? body.outUnits : 'KM-S',
    });

    return NextResponse.json({
      status: 'ok',
      action: 'query',
      data: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: sanitizePublicError(err),
      },
      { status: 502 }
    );
  }
}
