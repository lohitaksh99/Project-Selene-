import { buildApiEnvelope } from '@/lib/apiEnvelope';
import { LUNAR_MEAN_RADIUS_KM, SOLAR_CONSTANT_WM2 } from '@/lib/astrodynamics/coordinateFrames';

export async function GET() {
  return buildApiEnvelope({
    reference_frames: {
      body_fixed: 'IAU/IAG Moon Mean Earth / Polar Axis (MOON_ME)',
      topocentric_horizon: 'East-North-Up (ENU) — Azimuth [0°, 360°) CW from True North',
      inertial: 'ICRF / J2000.0 Ecliptic & Dynamical Equator',
      lunar_reference_radius_km: LUNAR_MEAN_RADIUS_KM,
      solar_constant_wm2: SOLAR_CONSTANT_WM2,
    },
    coordinate_limits: {
      south_pole_latitude_deg: { min: -90.0, max: -60.0 },
      longitude_deg: { min: -180.0, max: 360.0 },
      elevation_km: { min: -9.1, max: 10.8 },
    },
    time_scales: ['UTC (ISO-8601)', 'TAI', 'TT (Terrestrial Time)', 'TDB (Barycentric Dynamical Time)', 'JD'],
    event_solver: {
      algorithm: 'Brent-Dekker Bracketed Root-Finding',
      convergence_tolerance_seconds: 5.0,
      max_allowed_tolerance_seconds: 60.0,
    },
    warning_codes: [
      'EPHEMERIS_PROVIDER_OFFLINE_FALLBACK',
      'GRAZING_SOLAR_ILLUMINATION',
      'MULTIPATH_DTE_MARGIN_LOW',
      'TERRAIN_OCCLUSION_ACTIVE',
      'PERMANENT_SHADOW_PROXIMITY',
    ],
  });
}
