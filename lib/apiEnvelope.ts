import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ApiWarning } from './astrodynamics/jplHorizonsProvider';

export interface ApiEnvelopeMetadata {
  provider: string;
  model_version: string;
  terrain_status: string;
  timestamp_utc: string;
}

export function buildApiEnvelope<T>(
  data: T,
  options?: {
    status?: 'success' | 'error';
    httpStatus?: number;
    provider?: string;
    modelVersion?: string;
    terrainStatus?: string;
    warnings?: ApiWarning[];
  }
) {
  const reqId = `req-${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(2).toString('hex')}`;
  return NextResponse.json(
    {
      request_id: reqId,
      status: options?.status ?? 'success',
      data,
      metadata: {
        provider: options?.provider ?? 'NASA_JPL_HORIZONS',
        model_version: options?.modelVersion ?? 'DE441-MOON_ME',
        terrain_status: options?.terrainStatus ?? 'LOLA_V1.4_ACTIVE',
        timestamp_utc: new Date().toISOString(),
      },
      warnings: options?.warnings ?? [],
    },
    { status: options?.httpStatus ?? 200 }
  );
}
