import { NextRequest } from 'next/server';
import { buildApiEnvelope } from '@/lib/apiEnvelope';
import { runMissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import { LandingSiteRecord, getSeleneDb } from '@/server/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const siteId = String(body.site_id ?? 'shackleton-rim');
    const epochStartUtc = String(body.epoch_start_utc ?? '2027-02-01T00:00:00Z');
    const durationDays = Math.max(0.5, Math.min(90, Number(body.duration_days ?? 14)));
    const rawStep = body.step_hours;
    const stepHours: number | 'AUTO' =
      rawStep === 'AUTO' || rawStep === undefined || rawStep === null
        ? 'AUTO'
        : Math.max(0.25, Math.min(12, Number(rawStep)));

    const constraints = {
      minSolarElevationDeg: Number(body.min_solar_elevation_deg ?? 0.2),
      minEarthElevationDeg: Number(body.min_earth_elevation_deg ?? 1.0),
      requiredContinuousHours: Number(body.required_continuous_hours ?? 120),
      maxSlopeDeg: Number(body.max_slope_deg ?? 10.0),
    };

    const db = getSeleneDb();
    const site =
      (db
        .prepare('SELECT * FROM landing_sites WHERE id = ?')
        .get(siteId) as LandingSiteRecord | undefined) ??
      (db
        .prepare('SELECT * FROM landing_sites LIMIT 1')
        .get() as LandingSiteRecord);

    const analysis = runMissionTimelineAnalysis({
      siteId: site.id,
      siteName: site.name,
      siteLatDeg: site.latitude,
      siteLonDeg: site.longitude,
      siteElevationKm: site.elevation_km,
      psrProximityKm: site.psr_proximity_km,
      siteSlopeDeg: site.slope_deg,
      epochStartUtc,
      durationDays,
      stepHours,
      constraints,
      weights: body.weights,
    });

    // Persist analysis run & sampled points to SQLite (`analysis_runs` and `analysis_points`)
    const runId = `run-${Date.now()}`;
    db.prepare(`
      INSERT INTO analysis_runs (
        id, scenario_id, site_id, epoch_start, epoch_end, step_hours,
        ephemeris_provider, terrain_model_status, total_sunlit_hours,
        total_comms_hours, spac_hours, feasibility_score, status, created_at
      ) VALUES (
        @id, @scenario_id, @site_id, @epoch_start, @epoch_end, @step_hours,
        @ephemeris_provider, @terrain_model_status, @total_sunlit_hours,
        @total_comms_hours, @spac_hours, @feasibility_score, @status, @created_at
      )
    `).run({
      id: runId,
      scenario_id: body.scenario_id ?? null,
      site_id: site.id,
      epoch_start: analysis.epochStartUtc,
      epoch_end: analysis.epochEndUtc,
      step_hours: analysis.stepHours,
      ephemeris_provider: 'DE441-MOON_ME',
      terrain_model_status: 'LOLA_V1.4_ACTIVE',
      total_sunlit_hours: analysis.metrics.totalSunlitHours,
      total_comms_hours: analysis.metrics.totalCommsHours,
      spac_hours: analysis.metrics.cumulativeSpacHours,
      feasibility_score: analysis.scoreBreakdown.overallFeasibilityScore,
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
    });

    const insertPoint = db.prepare(`
      INSERT INTO analysis_points (
        run_id, epoch_hour, timestamp_utc, solar_azimuth_deg, solar_elevation_deg,
        earth_azimuth_deg, earth_elevation_deg, solar_geometric_vis, solar_terrain_vis,
        earth_geometric_vis, earth_terrain_vis, is_spac, solar_irradiance_wm2
      ) VALUES (
        @run_id, @epoch_hour, @timestamp_utc, @solar_azimuth_deg, @solar_elevation_deg,
        @earth_azimuth_deg, @earth_elevation_deg, @solar_geometric_vis, @solar_terrain_vis,
        @earth_geometric_vis, @earth_terrain_vis, @is_spac, @solar_irradiance_wm2
      )
    `);

    const persistPointsTx = db.transaction(() => {
      // Persist up to 60 representative points to keep DB fast and bounded
      const stride = Math.max(1, Math.floor(analysis.points.length / 60));
      for (let i = 0; i < analysis.points.length; i += stride) {
        const pt = analysis.points[i]!;
        insertPoint.run({
          run_id: runId,
          epoch_hour: pt.epochHour,
          timestamp_utc: pt.timestampUtc,
          solar_azimuth_deg: pt.solarAzimuthDeg,
          solar_elevation_deg: pt.solarElevationDeg,
          earth_azimuth_deg: pt.earthAzimuthDeg,
          earth_elevation_deg: pt.earthElevationDeg,
          solar_geometric_vis: pt.solarGeometricVis ? 1 : 0,
          solar_terrain_vis: pt.solarTerrainVis ? 1 : 0,
          earth_geometric_vis: pt.earthGeometricVis ? 1 : 0,
          earth_terrain_vis: pt.earthTerrainVis ? 1 : 0,
          is_spac: pt.isSpac ? 1 : 0,
          solar_irradiance_wm2: pt.solarIrradianceWm2,
        });
      }
    });
    persistPointsTx();

    return buildApiEnvelope({
      run_id: runId,
      analysis,
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: err instanceof Error ? err.message : 'Timeline analysis failed' },
      { status: 'error', httpStatus: 500 }
    );
  }
}
