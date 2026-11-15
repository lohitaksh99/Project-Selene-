import { NextRequest } from 'next/server';
import { buildApiEnvelope } from '@/lib/apiEnvelope';
import {
  LandingSiteRecord,
  deleteCustomLandingSite,
  getSeleneDb,
} from '@/server/db/database';
import {
  readBoundedJsonBody,
  sanitizePublicError,
  validateSameOriginMutation,
} from '@/lib/security/proxyGuard';

export async function GET() {
  try {
    const db = getSeleneDb();
    const sites = db
      .prepare('SELECT * FROM landing_sites ORDER BY is_preset DESC, latitude ASC')
      .all() as LandingSiteRecord[];

    return buildApiEnvelope({
      count: sites.length,
      sites,
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: sanitizePublicError(err, 'Failed to read landing sites from database') },
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
    return buildApiEnvelope(
      { error: parsed.error },
      { status: 'error', httpStatus: parsed.status }
    );
  }

  try {
    const body = parsed.data;
    const name = String(body.name ?? '').trim().slice(0, 120);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!name) {
      return buildApiEnvelope(
        { error: 'Site name is required.' },
        { status: 'error', httpStatus: 400 }
      );
    }
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      return buildApiEnvelope(
        {
          error:
            'Latitude must be within valid selenographic bounds (-90.0° <= latitude <= +90.0°).',
        },
        { status: 'error', httpStatus: 400 }
      );
    }
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 360) {
      return buildApiEnvelope(
        { error: 'Longitude must be between -180.0° and +360.0°.' },
        { status: 'error', httpStatus: 400 }
      );
    }

    const normalizedLon = ((longitude + 540) % 360) - 180;
    const elevationKm =
      body.elevation_km !== undefined
        ? Number(body.elevation_km)
        : Number((1.4 + Math.sin(latitude * 0.3) * 1.1 + Math.cos(normalizedLon * 0.05) * 0.8).toFixed(2));
    const psrProximityKm =
      body.psr_proximity_km !== undefined
        ? Number(body.psr_proximity_km)
        : Number(Math.max(0.4, (90 - Math.abs(latitude)) * 0.35 + 0.6).toFixed(1));
    const slopeDeg =
      body.slope_deg !== undefined ? Number(body.slope_deg) : 6.4;

    const id = `custom-sp-${Date.now()}`;
    const designation = String(
      body.designation || `CUSTOM-${Math.floor(100 + Math.random() * 899)}`
    ).slice(0, 48);
    const craterName = String(body.crater_name || 'Lunar Custom Survey Sector').slice(0, 120);
    const latLabel = latitude < 0 ? `${Math.abs(latitude).toFixed(2)}°S` : `${latitude.toFixed(2)}°N`;
    const description = String(
      body.description ||
        `User-designated lunar landing zone at ${latLabel}, ${normalizedLon.toFixed(2)}°E.`
    ).slice(0, 600);
    const scientificValue = String(
      body.scientific_value ||
        'Custom topocentric illumination, DTE communication, and surface traverse evaluation station.'
    ).slice(0, 600);
    const regionTier = latitude <= -60 ? 'SOUTH_POLE' : 'EQUATORIAL_MID';
    const createdAt = new Date().toISOString();

    const db = getSeleneDb();
    const record: LandingSiteRecord = {
      id,
      name,
      designation,
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(normalizedLon.toFixed(4)),
      elevation_km: elevationKm,
      crater_name: craterName,
      description,
      scientific_value: scientificValue,
      psr_proximity_km: psrProximityKm,
      slope_deg: slopeDeg,
      is_preset: 0,
      mission_category: 'CUSTOM',
      region_tier: regionTier,
      site_status: 'CUSTOM_COORDINATES',
      created_at: createdAt,
    };

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO landing_sites (id, name, designation, latitude, longitude, elevation_km, crater_name, description, scientific_value, psr_proximity_km, slope_deg, is_preset, mission_category, region_tier, site_status, created_at)
        VALUES (@id, @name, @designation, @latitude, @longitude, @elevation_km, @crater_name, @description, @scientific_value, @psr_proximity_km, @slope_deg, @is_preset, @mission_category, @region_tier, @site_status, @created_at)
      `).run(record);
    });
    insertTx();

    return buildApiEnvelope({ site: record }, { httpStatus: 201 });
  } catch (err) {
    return buildApiEnvelope(
      { error: sanitizePublicError(err, 'Failed to create site') },
      { status: 'error', httpStatus: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
        return buildApiEnvelope({ error: 'Cross-origin deletion rejected.' }, { status: 'error', httpStatus: 403 });
      }
    } catch {
      return buildApiEnvelope({ error: 'Invalid Origin header.' }, { status: 'error', httpStatus: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const siteId = (searchParams.get('id') || '').trim();
  if (!siteId) {
    return buildApiEnvelope({ error: 'Query parameter id is required.' }, { status: 'error', httpStatus: 400 });
  }

  try {
    const result = deleteCustomLandingSite(siteId);
    return buildApiEnvelope({ id: siteId, ...result });
  } catch (err) {
    const msg = sanitizePublicError(err);
    const status = msg.includes('immutable') ? 403 : msg.includes('not found') ? 404 : 500;
    return buildApiEnvelope({ error: msg }, { status: 'error', httpStatus: status });
  }
}
