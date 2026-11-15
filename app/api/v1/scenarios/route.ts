import { NextRequest } from 'next/server';
import { buildApiEnvelope } from '@/lib/apiEnvelope';
import { ScenarioRecord, getSeleneDb } from '@/server/db/database';
import {
  readBoundedJsonBody,
  sanitizePublicError,
  validateSameOriginMutation,
} from '@/lib/security/proxyGuard';

export async function GET() {
  try {
    const db = getSeleneDb();
    const scenarios = db
      .prepare('SELECT * FROM scenarios ORDER BY created_at DESC')
      .all() as ScenarioRecord[];

    return buildApiEnvelope({
      count: scenarios.length,
      scenarios,
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: sanitizePublicError(err, 'Failed to read scenarios from database') },
      { status: 'error', httpStatus: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const originCheck = validateSameOriginMutation(req);
  if (!originCheck.ok) {
    return buildApiEnvelope(
      { error: originCheck.reason || 'Forbidden cross-origin mutation' },
      { status: 'error', httpStatus: 403 }
    );
  }

  const parsed = await readBoundedJsonBody<Record<string, unknown>>(req, 32_768);
  if (!parsed.ok) {
    return buildApiEnvelope({ error: parsed.error }, { status: 'error', httpStatus: parsed.status });
  }

  try {
    const body = parsed.data;
    const name = String(body.name ?? '').trim().slice(0, 140);
    const siteId = String(body.site_id ?? 'shackleton-rim').slice(0, 80);
    const landingDate = String(body.landing_date ?? '2027-02-01T00:00:00Z');
    const durationDays = Math.max(1, Math.min(90, Number(body.duration_days ?? 14) || 14));
    const landerType = String(body.lander_type ?? 'HLS Crewed Vertical Solar Array (18 m²)').slice(0, 120);
    const minSolarElevationDeg = Number(body.min_solar_elevation_deg ?? 0.2);
    const minEarthElevationDeg = Number(body.min_earth_elevation_deg ?? 1.0);
    const requiredContinuousHours = Math.max(12, Math.min(2160, Number(body.required_continuous_hours ?? 120) || 120));
    const notes = String(body.notes ?? 'Custom mission trade-study scenario.').slice(0, 800);

    if (!name) {
      return buildApiEnvelope(
        { error: 'Scenario name is required.' },
        { status: 'error', httpStatus: 400 }
      );
    }

    const db = getSeleneDb();
    const record: ScenarioRecord = {
      id: `scen-custom-${Date.now()}`,
      name,
      site_id: siteId,
      landing_date: new Date(landingDate).toISOString(),
      duration_days: durationDays,
      lander_type: landerType,
      min_solar_elevation_deg: minSolarElevationDeg,
      min_earth_elevation_deg: minEarthElevationDeg,
      required_continuous_hours: requiredContinuousHours,
      notes,
      created_at: new Date().toISOString(),
    };

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO scenarios (id, name, site_id, landing_date, duration_days, lander_type, min_solar_elevation_deg, min_earth_elevation_deg, required_continuous_hours, notes, created_at)
        VALUES (@id, @name, @site_id, @landing_date, @duration_days, @lander_type, @min_solar_elevation_deg, @min_earth_elevation_deg, @required_continuous_hours, @notes, @created_at)
      `).run(record);
    });
    tx();

    return buildApiEnvelope({ scenario: record }, { httpStatus: 201 });
  } catch (err) {
    return buildApiEnvelope(
      { error: sanitizePublicError(err, 'Failed to create scenario') },
      { status: 'error', httpStatus: 500 }
    );
  }
}
