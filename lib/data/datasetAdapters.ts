/**
 * Project Selene — Client-Safe Site Classification & Scientific Dataset Integration Adapters
 * Provides:
 * 1. Explicit Landing-Site Status Classification (Historical, Confirmed, Planned, Candidate Region, Custom)
 * 2. Dynamic Dataset Validation & Provenance Metadata contracts compatible with DE441-MOON_ME & LOLA LDEM_80S
 * 3. Integration-ready schema slots for upcoming user-provided datasets without fabricated values
 */

import type {
  DatasetRecord,
  LandingSiteRecord,
  LandingSiteStatus,
} from '@/server/db/database';

export function resolveSiteStatusClient(
  site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>
): LandingSiteStatus {
  if (site.site_status) return site.site_status;
  if (!site.is_preset || site.mission_category === 'CUSTOM') return 'CUSTOM_COORDINATES';
  if (site.mission_category === 'APOLLO') return 'HISTORICAL_LANDING';
  if (site.id === 'clps-im1-malapert-a' || site.id === 'isro-chandrayaan3-shiv-shakti') {
    return 'CONFIRMED_LANDING';
  }
  if (
    site.id === 'clps-viper-mons-mouton' ||
    site.id === 'clps-blue-ghost-crisium' ||
    site.id === 'cnsa-change7-shackleton'
  ) {
    return 'PLANNED_TARGET';
  }
  return 'CANDIDATE_REGION';
}

export function getSiteStatusLabelClient(
  site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>
): string {
  const status = resolveSiteStatusClient(site);
  switch (status) {
    case 'HISTORICAL_LANDING':
      return 'HISTORICAL LANDING LOCATION';
    case 'CONFIRMED_LANDING':
      return 'CONFIRMED LANDING';
    case 'PLANNED_TARGET':
      return 'PLANNED MISSION TARGET';
    case 'CUSTOM_COORDINATES':
      return 'CUSTOM COORDINATES';
    case 'CANDIDATE_REGION':
    default:
      return 'CANDIDATE REGION';
  }
}

export function getSiteStatusDescriptionClient(
  site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>
): string {
  const status = resolveSiteStatusClient(site);
  switch (status) {
    case 'HISTORICAL_LANDING':
      return 'Verified historical surface touchdown site with benchmarked selenographic coordinates.';
    case 'CONFIRMED_LANDING':
      return 'Confirmed modern lunar surface touchdown location verified via orbital reconnaissance.';
    case 'PLANNED_TARGET':
      return 'Assigned target landing zone for a manifested lunar surface mission.';
    case 'CUSTOM_COORDINATES':
      return 'User-designated selenographic coordinates evaluated against planetary ephemerides.';
    case 'CANDIDATE_REGION':
    default:
      return 'Candidate study region under engineering evaluation; not a completed surface landing.';
  }
}

export type ExternalDatasetDomain =
  | 'LANDING_SITE_CATALOG'
  | 'TERRAIN_ELEVATION_DEM'
  | 'ILLUMINATION_HORIZON_MASK'
  | 'SPICE_EPHEMERIS_KERNEL'
  | 'VOLATILE_THERMAL_MAP';

export interface DatasetIntegrationSchemaSlot {
  slotId: string;
  domain: ExternalDatasetDomain;
  title: string;
  expectedFormat: string;
  referenceFrame: string;
  requiredColumns: string[];
  targetWorkspaces: string[];
  statusMessage: string;
}

/**
 * Transparent, non-fabricated integration specifications for upcoming user-provided datasets.
 */
export const UPCOMING_DATASET_INTEGRATION_SLOTS: DatasetIntegrationSchemaSlot[] = [
  {
    slotId: 'ext-slot-site-catalog',
    domain: 'LANDING_SITE_CATALOG',
    title: 'Extended Lunar Landing Site & Candidate Region Catalog',
    expectedFormat: 'SQLite Table (`landing_sites`) / CSV / GeoJSON',
    referenceFrame: 'IAU MOON_ME Selenographic (Lat °N/S, Lon °E, Elev km)',
    requiredColumns: [
      'id',
      'name',
      'designation',
      'latitude',
      'longitude',
      'elevation_km',
      'slope_deg',
      'site_status',
    ],
    targetWorkspaces: ['Landing Site Explorer', 'Multi-Site Trade Matrix', 'Data Hub'],
    statusMessage: 'Dataset integration pending. Ready for external landing-site record ingestion.',
  },
  {
    slotId: 'ext-slot-terrain-dem',
    domain: 'TERRAIN_ELEVATION_DEM',
    title: 'High-Resolution Local Topographic DEM & Slope Hazard Grid',
    expectedFormat: 'PDS4 GeoTIFF / Gridded Elevation Matrix / Horizon Azimuth Table',
    referenceFrame: 'IAU/IAG MOON_ME Sphere (R = 1737.4 km) / LOLA LDEM_80S',
    requiredColumns: ['site_id', 'azimuth_deg', 'horizon_elevation_deg', 'local_slope_deg', 'datum'],
    targetWorkspaces: ['Site Physics & Terrain', 'Moon Trek GIS', 'Data Hub'],
    statusMessage: 'Scientific data not yet connected. Ready for custom local DEM or horizon mask upload.',
  },
  {
    slotId: 'ext-slot-illumination-series',
    domain: 'ILLUMINATION_HORIZON_MASK',
    title: 'Pre-Computed Multi-Epoch Solar Illumination & Shadow Series',
    expectedFormat: 'Time-Series JSON / CSV / SQLite (`analysis_points`)',
    referenceFrame: 'Topocentric ENU / UTC & JD(TDB) Epochs',
    requiredColumns: [
      'timestamp_utc',
      'solar_elevation_deg',
      'solar_azimuth_deg',
      'solar_terrain_vis',
      'solar_irradiance_wm2',
    ],
    targetWorkspaces: ['Illumination & Comms Timeline', '3D Orbital & Horizon Lab', 'Data Hub'],
    statusMessage: 'Additional source material will be available here once external illumination series are attached.',
  },
  {
    slotId: 'ext-slot-spice-ephemeris',
    domain: 'SPICE_EPHEMERIS_KERNEL',
    title: 'Validated Planetary & Lunar Orientation Ephemeris Tables (DE441 / MOON_PA_DE440)',
    expectedFormat: 'NAIF SPICE ASCII / Chebyshev Polynomial Table / Horizons Vector Series',
    referenceFrame: 'ICRF / IAU MOON_PA_DE440 / MOON_ME',
    requiredColumns: [
      'jd_tdb',
      'sub_solar_lat_deg',
      'sub_solar_lon_deg',
      'sub_earth_lat_deg',
      'sub_earth_lon_deg',
      'earth_moon_distance_km',
    ],
    targetWorkspaces: ['Mission Overview', 'Site Physics & Terrain', 'Data Hub'],
    statusMessage: 'Dataset integration pending. Validated against active DE441-MOON_ME analytical baseline.',
  },
];

export interface DatasetValidationResult {
  isValid: boolean;
  verifiedCount: number;
  unavailableCount: number;
  ephemerisKernelVersion: string;
  polarDemVersion: string;
}

export function summarizeDatabaseDatasets(datasets: DatasetRecord[]): DatasetValidationResult {
  const verifiedCount = datasets.filter((d) => d.is_available === 1).length;
  const unavailableCount = datasets.length - verifiedCount;
  const eph = datasets.find((d) => d.id.includes('de441') || d.version.includes('DE441'));
  const dem = datasets.find((d) => d.id.includes('lola-dem-sp'));

  return {
    isValid: verifiedCount > 0,
    verifiedCount,
    unavailableCount,
    ephemerisKernelVersion: eph?.version ?? 'DE441-MOON_ME (Database Query Pending)',
    polarDemVersion: dem?.version ?? 'LDEM_80S v1.4 GDS (Database Query Pending)',
  };
}
