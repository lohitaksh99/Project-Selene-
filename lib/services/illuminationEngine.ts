/**
 * Phase 7 — Physically Meaningful Lunar Illumination Engine
 * Combines:
 *   1. Time-dependent Sun-Moon geometry from NASA/JPL Horizons (`DE441`)
 *   2. Validated lunar surface coordinate transformations (`IAU_MOON_ME` / `IAU_MOON_PA` / `TOPOCENTRIC_ENU`)
 *   3. Numerical DEM elevation, local terrain slope (alpha), aspect (gamma), surface normal (n_DEM),
 *      and 360° horizon mask from the LOLA DEM Terrain Engine (`lib/terrain/lolaTerrainEngine.ts`)
 *
 * Explicitly distinguishes three physical illumination regimes:
 *   - Regime A: Simple Spherical/Ellipsoidal Solar Incidence (ignores local slope and terrain horizon shadows)
 *   - Regime B: Local Slope-Corrected Surface Normal Incidence (accounts for local DEM slope & aspect, ignores distant horizon occlusion)
 *   - Regime C: Full Terrain-Shadow & Limb-Darkened Solar Disk Illumination (accounts for 360° topographic horizon occlusion + Eddington limb darkening + local surface normal incidence)
 */

import { fetchHorizonsSyncedLunarGeometry } from '@/lib/services/horizonsService';
import { sampleLunarTerrain } from '@/lib/terrain/lolaTerrainEngine';
import {
  computeLimbDarkenedSolarDiskFraction,
  getLolaHorizonElevationDeg,
} from '@/lib/astrodynamics/coordinateFrames';
import { ScientificProvenanceEnvelope } from '@/lib/services/scientificProvenance';

export interface PhysicalIlluminationEvaluation {
  epochUtc: string;
  jdTdb: number;
  etSecondsJ2000: number;
  ephemerisSource: 'LIVE_JPL_HORIZONS_DE441' | 'ANALYTICAL_DE441_FALLBACK';
  coordinates: {
    latDeg: number;
    lonDeg: number;
    elevationM: number;
    slopeDeg: number;
    aspectDeg: number;
    confidenceTier: number;
    confidenceLabel: string;
    demProductId: string;
  };
  solarGeometry: {
    subSolarLatDeg: number;
    subSolarLonDeg: number;
    topocentricAzimuthDeg: number;
    topocentricElevationDeg: number;
    lolaHorizonMaskDeg: number;
    horizonClearanceMarginDeg: number;
  };
  surfaceNormalEnu: {
    east: number;
    north: number;
    up: number;
  };
  solarVectorEnu: {
    east: number;
    north: number;
    up: number;
  };
  regime1SphericalIncidence: {
    incidenceAngleDeg: number;
    cosIncidence: number;
    unshadowedIrradianceWm2: number;
    isGeometricallySunlit: boolean;
    description: string;
  };
  regime2SlopeCorrectedIncidence: {
    incidenceAngleDeg: number;
    cosIncidence: number;
    slopeIrradianceWm2: number;
    isSelfShadowedBySlope: boolean;
    description: string;
  };
  regime3FullTerrainShadowed: {
    visibleSolarDiskFraction: number;
    visibleSolarDiskMin: number;
    visibleSolarDiskMax: number;
    isOccludedByDistantHorizon: boolean;
    effectiveHorizontalIrradianceWm2: number;
    effectiveSlopeNormalIrradianceWm2: number;
    illuminationState: 'FULL_SUNLIGHT' | 'PARTIAL_PENUMBRA' | 'TERRAIN_OCCLUDED_SHADOW' | 'LUNAR_NIGHT';
    description: string;
  };
  provenance: ScientificProvenanceEnvelope;
}

const SOLAR_CONSTANT_1AU_WM2 = 1361.0;

/**
 * Computes the complete 3-regime physical illumination evaluation at `(latDeg, lonDeg)`
 * and `epochUtc` using JPL Horizons Sun-Moon geometry and LOLA DEM terrain normals/horizons.
 */
export async function evaluatePhysicalLunarIllumination(params: {
  siteId?: string;
  latDeg: number;
  lonDeg: number;
  epochUtc: string;
}): Promise<PhysicalIlluminationEvaluation> {
  const { siteId = 'shackleton-rim', latDeg, lonDeg, epochUtc } = params;

  // 1. Sample numerical LOLA DEM terrain at (latDeg, lonDeg)
  const terrain = sampleLunarTerrain(latDeg, lonDeg);
  const elevationM = terrain.elevationM ?? 0;
  const elevationKm = elevationM / 1000.0;
  const slopeDeg = terrain.slopeDeg ?? 0;
  const aspectDeg = terrain.aspectDeg ?? 0;

  // 2. Obtain validated Sun-Moon geometry from JPL Horizons (with analytical DE441 fallback)
  const geom = await fetchHorizonsSyncedLunarGeometry({
    epochUtc,
    siteLatDeg: latDeg,
    siteLonDeg: lonDeg,
    siteElevationKm: elevationKm,
  });

  const azDeg = geom.solarHorizon.azimuthDeg;
  const elDeg = geom.solarHorizon.elevationDeg;
  const degToRad = Math.PI / 180.0;

  // 3. Construct unit solar direction vector s_hat in local Topocentric ENU frame
  // Azimuth is measured clockwise from North (0°=N, 90°=E, 180°=S, 270°=W)
  const azRad = azDeg * degToRad;
  const elRad = elDeg * degToRad;
  const cosEl = Math.cos(elRad);
  const solarVectorEnu = {
    east: Number((cosEl * Math.sin(azRad)).toFixed(6)),
    north: Number((cosEl * Math.cos(azRad)).toFixed(6)),
    up: Number(Math.sin(elRad).toFixed(6)),
  };

  // 4. Construct local DEM surface normal n_DEM in Topocentric ENU frame
  // Slope alpha is tilt from horizontal; aspect gamma is downslope azimuth clockwise from North
  const slopeRad = slopeDeg * degToRad;
  const aspectRad = aspectDeg * degToRad;
  const surfaceNormalEnu = {
    east: Number((Math.sin(slopeRad) * Math.sin(aspectRad)).toFixed(6)),
    north: Number((Math.sin(slopeRad) * Math.cos(aspectRad)).toFixed(6)),
    up: Number(Math.cos(slopeRad).toFixed(6)),
  };

  // 5. Regime 1: Simple Spherical Solar Incidence (n_sphere = [0, 0, 1])
  const cosSpherical = Math.max(0, solarVectorEnu.up);
  const sphericalIncidenceDeg = Number(
    ((Math.acos(Math.max(-1, Math.min(1, solarVectorEnu.up))) * 180.0) / Math.PI).toFixed(2)
  );
  const unshadowedIrradianceWm2 = Number((SOLAR_CONSTANT_1AU_WM2 * cosSpherical).toFixed(1));

  // 6. Regime 2: Local Slope-Corrected Surface Normal Incidence (n_DEM . s_hat)
  const rawDotSlope =
    surfaceNormalEnu.east * solarVectorEnu.east +
    surfaceNormalEnu.north * solarVectorEnu.north +
    surfaceNormalEnu.up * solarVectorEnu.up;
  const cosSlope = Math.max(0, rawDotSlope);
  const slopeIncidenceDeg = Number(
    ((Math.acos(Math.max(-1, Math.min(1, rawDotSlope))) * 180.0) / Math.PI).toFixed(2)
  );
  const slopeIrradianceWm2 = Number((SOLAR_CONSTANT_1AU_WM2 * cosSlope).toFixed(1));

  // 7. Regime 3: Full Terrain-Shadow & Limb-Darkened Solar Disk Illumination
  const lolaHorizonMaskDeg = Number(
    getLolaHorizonElevationDeg(siteId, azDeg, latDeg, lonDeg, elevationKm).toFixed(3)
  );
  const horizonClearanceMarginDeg = Number((elDeg - lolaHorizonMaskDeg).toFixed(3));

  const diskOccultation = computeLimbDarkenedSolarDiskFraction({
    siteId,
    siteLatDeg: latDeg,
    siteLonDeg: lonDeg,
    siteElevationKm: elevationKm,
    solarAzimuthDeg: azDeg,
    solarElevationDeg: elDeg,
    solarRangeKm: geom.solarHorizon.rangeKm,
  });

  const diskFrac = diskOccultation.fluxFraction;
  const effectiveHorizontalIrradianceWm2 = Number(
    (SOLAR_CONSTANT_1AU_WM2 * cosSpherical * diskFrac).toFixed(1)
  );
  const effectiveSlopeNormalIrradianceWm2 = Number(
    (SOLAR_CONSTANT_1AU_WM2 * cosSlope * diskFrac).toFixed(1)
  );

  let illuminationState: PhysicalIlluminationEvaluation['regime3FullTerrainShadowed']['illuminationState'] =
    'FULL_SUNLIGHT';
  if (elDeg < -0.27) {
    illuminationState = 'LUNAR_NIGHT';
  } else if (diskFrac <= 0.001) {
    illuminationState = 'TERRAIN_OCCLUDED_SHADOW';
  } else if (diskFrac < 0.99) {
    illuminationState = 'PARTIAL_PENUMBRA';
  }

  return {
    epochUtc: geom.epochUtc,
    jdTdb: geom.jdTdb,
    etSecondsJ2000: geom.etSecondsJ2000,
    ephemerisSource: geom.sourceMode,
    coordinates: {
      latDeg,
      lonDeg,
      elevationM,
      slopeDeg,
      aspectDeg,
      confidenceTier: terrain.confidenceTier,
      confidenceLabel: terrain.confidenceLabel,
      demProductId: terrain.sourceProductId,
    },
    solarGeometry: {
      subSolarLatDeg: geom.subSolarLatDeg,
      subSolarLonDeg: geom.subSolarLonDeg,
      topocentricAzimuthDeg: azDeg,
      topocentricElevationDeg: elDeg,
      lolaHorizonMaskDeg,
      horizonClearanceMarginDeg,
    },
    surfaceNormalEnu,
    solarVectorEnu,
    regime1SphericalIncidence: {
      incidenceAngleDeg: sphericalIncidenceDeg,
      cosIncidence: Number(cosSpherical.toFixed(4)),
      unshadowedIrradianceWm2,
      isGeometricallySunlit: elDeg > 0,
      description:
        'Smooth 1737.4 km reference sphere incidence only (Horizons Sun vector without local DEM slope or horizon shadows).',
    },
    regime2SlopeCorrectedIncidence: {
      incidenceAngleDeg: slopeIncidenceDeg,
      cosIncidence: Number(cosSlope.toFixed(4)),
      slopeIrradianceWm2,
      isSelfShadowedBySlope: rawDotSlope <= 0,
      description: `Accounts for local LOLA DEM slope (${slopeDeg.toFixed(
        1
      )}°) and aspect (${aspectDeg.toFixed(0)}°), without distant crater rim occlusion.`,
    },
    regime3FullTerrainShadowed: {
      visibleSolarDiskFraction: diskFrac,
      visibleSolarDiskMin: diskOccultation.fluxFractionMin,
      visibleSolarDiskMax: diskOccultation.fluxFractionMax,
      isOccludedByDistantHorizon: diskFrac < 1.0 && elDeg > -0.27,
      effectiveHorizontalIrradianceWm2,
      effectiveSlopeNormalIrradianceWm2,
      illuminationState,
      description:
        'Full physical terrain shadow solver: combines JPL Horizons solar vector, LOLA DEM surface normal, and 19-node Eddington limb-darkened solar disk occultation against the 360° LOLA horizon mask.',
    },
    provenance: {
      ...geom.provenance,
      isNumericalDem: true,
      processingHistory: [
        ...geom.provenance.processingHistory,
        `Sampled numerical LOLA DEM (${terrain.sourceProductId}): elev=${elevationM}m, slope=${slopeDeg}°, aspect=${aspectDeg}°`,
        `Evaluated 360° LOLA horizon mask at Az=${azDeg.toFixed(1)}° -> mask=${lolaHorizonMaskDeg}° (disk fraction=${diskFrac})`,
      ],
    },
  };
}
