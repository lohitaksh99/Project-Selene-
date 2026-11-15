import { NextRequest } from 'next/server';
import { buildApiEnvelope } from '@/lib/apiEnvelope';
import {
  evaluateDecoupledState,
  generate360HorizonProfile,
} from '@/lib/astrodynamics/coordinateFrames';
import {
  EphemerisProviderMode,
  resolveInstantEphemeris,
} from '@/lib/astrodynamics/jplHorizonsProvider';
import { computeLunarPhase, computeTimeScales } from '@/lib/astrodynamics/timeScales';
import { LandingSiteRecord, getSeleneDb } from '@/server/db/database';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const siteId = url.searchParams.get('site_id') || url.searchParams.get('siteId') || 'shackleton-rim';
  const timestampUtc = url.searchParams.get('timestamp_utc') || url.searchParams.get('timestamp') || '2027-02-04T20:39:00.181Z';
  const providerMode: EphemerisProviderMode =
    url.searchParams.get('provider_mode') === 'CALIBRATED_OFFLINE' ? 'CALIBRATED_OFFLINE' : 'AUTO_JPL';

  const body = {
    site_id: siteId,
    timestamp_utc: timestampUtc,
    provider_mode: providerMode,
    min_solar_elevation_deg: url.searchParams.get('min_solar_elevation_deg') ?? 0.2,
    min_earth_elevation_deg: url.searchParams.get('min_earth_elevation_deg') ?? 1.0,
    required_continuous_hours: url.searchParams.get('required_continuous_hours') ?? 120,
  };

  return handleInstantAnalysis(body);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handleInstantAnalysis(body);
  } catch (err) {
    return buildApiEnvelope(
      { error: err instanceof Error ? err.message : 'Instant analysis failed' },
      { status: 'error', httpStatus: 500 }
    );
  }
}

async function handleInstantAnalysis(body: Record<string, unknown>) {
  try {
    const siteId = String(body.site_id ?? 'shackleton-rim');
    const timestampUtc = String(body.timestamp_utc ?? '2027-02-04T20:39:00.181Z');
    const providerMode: EphemerisProviderMode =
      body.provider_mode === 'CALIBRATED_OFFLINE' ? 'CALIBRATED_OFFLINE' : 'AUTO_JPL';

    const db = getSeleneDb();
    const site =
      (db
        .prepare('SELECT * FROM landing_sites WHERE id = ?')
        .get(siteId) as LandingSiteRecord | undefined) ??
      (db
        .prepare('SELECT * FROM landing_sites LIMIT 1')
        .get() as LandingSiteRecord);

    const constraints = {
      minSolarElevationDeg: Number(body.min_solar_elevation_deg ?? 0.2),
      minEarthElevationDeg: Number(body.min_earth_elevation_deg ?? 1.0),
      requiredContinuousHours: Number(body.required_continuous_hours ?? 120),
    };

    const ephResult = await resolveInstantEphemeris({
      timestampUtc,
      siteLatDeg: site.latitude,
      siteLonDeg: site.longitude,
      siteElevationKm: site.elevation_km,
      providerMode,
    });

    const decoupledState = evaluateDecoupledState({
      siteId: site.id,
      siteLatDeg: site.latitude,
      siteLonDeg: site.longitude,
      siteElevationKm: site.elevation_km,
      solar: ephResult.ephemeris.solarHorizon,
      earth: ephResult.ephemeris.earthHorizon,
      constraints,
    });

    const timeScales = computeTimeScales(ephResult.ephemeris.timestampUtc);
    const lunarPhase = computeLunarPhase(ephResult.ephemeris.timestampUtc);
    const horizonProfile = generate360HorizonProfile(
      site.id,
      site.latitude,
      site.longitude,
      site.elevation_km,
      5
    );

    if (
      decoupledState.solarTerrainVis &&
      decoupledState.solarHorizonMarginDeg < 1.0
    ) {
      ephResult.warnings.push({
        code: 'GRAZING_SOLAR_ILLUMINATION',
        severity: 'info',
        message: `Grazing polar solar angle (${decoupledState.solarHorizonMarginDeg.toFixed(2)}° above LOLA ridge); long shadows active.`,
      });
    }

    if (!decoupledState.solarTerrainVis && decoupledState.solarGeometricVis) {
      ephResult.warnings.push({
        code: 'TERRAIN_OCCLUSION_ACTIVE',
        severity: 'warning',
        message: 'Sun is above reference sphere horizon but occluded by local LOLA topographic massif.',
      });
    }

    return buildApiEnvelope(
      {
        site,
        time_scales: timeScales,
        lunar_phase: lunarPhase,
        ephemeris: ephResult.ephemeris,
        physical_state: decoupledState,
        horizon_profile: horizonProfile,
      },
      {
        provider: ephResult.providerUsed,
        modelVersion: ephResult.modelVersion,
        warnings: ephResult.warnings,
      }
    );
  } catch (err) {
    return buildApiEnvelope(
      { error: err instanceof Error ? err.message : 'Instant analysis failed' },
      { status: 'error', httpStatus: 500 }
    );
  }
}
