import { NextRequest, NextResponse } from 'next/server';
import { evaluatePhysicalLunarIllumination } from '@/lib/services/illuminationEngine';
import { readBoundedJsonBody, sanitizePublicError } from '@/lib/security/proxyGuard';

function validateIlluminationParams(input: {
  siteId?: unknown;
  latDeg?: unknown;
  lonDeg?: unknown;
  epochUtc?: unknown;
}):
  | { ok: true; siteId: string; latDeg: number; lonDeg: number; epochUtc: string }
  | { ok: false; error: string } {
  const siteId = typeof input.siteId === 'string' && input.siteId.trim()
    ? input.siteId.trim().slice(0, 80)
    : 'shackleton-rim';

  const latDeg = input.latDeg === undefined || input.latDeg === null ? -89.78 : Number(input.latDeg);
  const lonDeg = input.lonDeg === undefined || input.lonDeg === null ? 120.45 : Number(input.lonDeg);

  if (!Number.isFinite(latDeg) || latDeg < -90 || latDeg > 90) {
    return { ok: false, error: 'latDeg must be a finite number in [-90, 90].' };
  }
  if (!Number.isFinite(lonDeg) || lonDeg < -360 || lonDeg > 360) {
    return { ok: false, error: 'lonDeg must be a finite number in [-360, 360].' };
  }

  const rawEpoch =
    typeof input.epochUtc === 'string' && input.epochUtc.trim()
      ? input.epochUtc.trim()
      : '2027-06-09T19:21:00Z';
  const parsedMs = Date.parse(rawEpoch);
  if (!Number.isFinite(parsedMs)) {
    return { ok: false, error: 'epochUtc must be a valid ISO-8601 UTC timestamp.' };
  }

  return {
    ok: true,
    siteId,
    latDeg,
    lonDeg,
    epochUtc: new Date(parsedMs).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validated = validateIlluminationParams({
    siteId: searchParams.get('siteId') ?? undefined,
    latDeg: searchParams.get('lat') ?? undefined,
    lonDeg: searchParams.get('lon') ?? undefined,
    epochUtc: searchParams.get('epochUtc') ?? undefined,
  });

  if (!validated.ok) {
    return NextResponse.json({ status: 'error', message: validated.error }, { status: 400 });
  }

  try {
    const evaluation = await evaluatePhysicalLunarIllumination(validated);
    return NextResponse.json({
      status: 'ok',
      data: evaluation,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: sanitizePublicError(err, 'Illumination evaluation failed'),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const bounded = await readBoundedJsonBody<{
    siteId?: unknown;
    latDeg?: unknown;
    lonDeg?: unknown;
    epochUtc?: unknown;
  }>(req, 16_384);

  if (!bounded.ok) {
    return NextResponse.json({ status: 'error', message: bounded.error }, { status: bounded.status });
  }

  const validated = validateIlluminationParams(bounded.data);
  if (!validated.ok) {
    return NextResponse.json({ status: 'error', message: validated.error }, { status: 400 });
  }

  try {
    const evaluation = await evaluatePhysicalLunarIllumination(validated);
    return NextResponse.json({
      status: 'ok',
      data: evaluation,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: sanitizePublicError(err, 'Illumination evaluation failed'),
      },
      { status: 500 }
    );
  }
}
