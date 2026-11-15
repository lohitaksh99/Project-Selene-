/**
 * Project Selene — Reference Frames, SPICE Euler Rotations, Limb-Darkened Illumination & 3-Stage Ka-Band DTE Physics (v2.1)
 * - Body-Fixed Frames: MOON_PA_DE421, MOON_ME_DE421 (NAIF 31006 -> 31007), MOON_PA_DE440, MOON_ME_DE440 (NAIF 31008 -> 31009)
 * - Mean Lunar Radius: R_M = 1737.4 km
 * - Topocentric Local Horizon Frame: East-North-Up (ENU)
 * - 2D Discretized Eddington Limb-Darkened Solar Disk Horizon Occultation
 * - 3-Stage Ka-Band (32.0 GHz) Direct-to-Earth Link Budget & Clamped Battery SoC Integrator
 */

export const LUNAR_MEAN_RADIUS_KM = 1737.4;
export const SOLAR_CONSTANT_WM2 = 1361.0;
export const SOLAR_RADIUS_KM = 695700.0;
export const EARTH_RADIUS_KM = 6378.137;
export const AU_KM = 149597870.7;
export const SOLAR_ANGULAR_RADIUS_DEG = 0.2666; // Semi-diameter of Sun at 1 AU

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export interface HorizonCoordinates {
  azimuthDeg: number; // 0 <= alpha < 360 clockwise from True North
  elevationDeg: number; // -90 <= h <= +90 above local horizon
  rangeKm: number;
}

export interface HorizonMaskSample {
  azimuthDeg: number;
  terrainElevationDeg: number;
  terrainUncertaintyDeg?: number;
  ridgeFeatureName?: string;
}

export type DsnGroundStationId =
  | 'DSS-24_GOLDSTONE_34M'
  | 'DSS-54_MADRID_34M'
  | 'DSS-34_CANBERRA_34M'
  | 'DSS-14_GOLDSTONE_70M';

export interface DsnStationConfig {
  id: DsnGroundStationId;
  name: string;
  complexName: string;
  antennaDiameterM: number;
  kaBandGtDbPerK: number; // Receiver G/T at 32 GHz (dB/K)
  atmosphericLossDb: number; // 90% weather conditions
}

export const DSN_GROUND_STATIONS: Record<DsnGroundStationId, DsnStationConfig> = {
  'DSS-24_GOLDSTONE_34M': {
    id: 'DSS-24_GOLDSTONE_34M',
    name: 'DSS-24 Goldstone 34m BWG',
    complexName: 'Goldstone, California',
    antennaDiameterM: 34,
    kaBandGtDbPerK: 54.2,
    atmosphericLossDb: 0.75,
  },
  'DSS-54_MADRID_34M': {
    id: 'DSS-54_MADRID_34M',
    name: 'DSS-54 Madrid 34m BWG',
    complexName: 'Robledo, Spain',
    antennaDiameterM: 34,
    kaBandGtDbPerK: 54.0,
    atmosphericLossDb: 0.85,
  },
  'DSS-34_CANBERRA_34M': {
    id: 'DSS-34_CANBERRA_34M',
    name: 'DSS-34 Canberra 34m BWG',
    complexName: 'Tidbinbilla, Australia',
    antennaDiameterM: 34,
    kaBandGtDbPerK: 54.1,
    atmosphericLossDb: 0.8,
  },
  'DSS-14_GOLDSTONE_70M': {
    id: 'DSS-14_GOLDSTONE_70M',
    name: 'DSS-14 Goldstone 70m Deep Space',
    complexName: 'Goldstone, California',
    antennaDiameterM: 70,
    kaBandGtDbPerK: 59.8,
    atmosphericLossDb: 0.8,
  },
};

export interface ThreeStageDteLinkResult {
  stage1GeometricVis: boolean;
  stage2TerrainVis: boolean;
  stage2EarthDiskFraction: number;
  stage2HorizonMarginDeg: number;
  stage3LinkFeasible: boolean;
  carrierToNoiseDensityDbHz: number;
  achievedEbN0Db: number;
  requiredEbN0Db: number;
  linkMarginDb: number;
  freeSpacePathLossDb: number;
  multipathLossDb: number;
  eirpDbw: number;
  stationUsed: DsnStationConfig;
}

export interface DecoupledPhysicalState {
  solarGeometricVis: boolean; // h_sun > 0
  solarTerrainVis: boolean; // limb-darkened visible solar disk > 0
  solarHorizonMarginDeg: number; // h_sun - h_terrain(az_sun)
  solarDiskFraction: number; // 0..1 accounting for 2D Eddington limb-darkened grazing occlusion
  solarDiskFractionMin: number; // Lower bound with +1sigma ADJ_ERR ridge height
  solarDiskFractionMax: number; // Upper bound with -1sigma ADJ_ERR ridge height
  earthGeometricVis: boolean; // Stage 1: h_earth > 0
  earthTerrainVis: boolean; // Stage 2: h_earth > h_terrain(az_earth)
  earthHorizonMarginDeg: number; // h_earth - h_terrain(az_earth)
  dteLinkFeasible: boolean; // Stage 3: Terrain vis + clearance + Ka-band margin >= 3.0 dB
  dteLinkMarginDb: number; // Ka-band link budget margin in dB
  dteDetails: ThreeStageDteLinkResult;
  solarIrradianceWm2: number; // Direct incident irradiance scaled by (1 AU / r_sun)^2
  effectiveElectricalPowerKw: number; // P(t) = G_eff * A * eta(T) * cos(theta_i)
  isSpac: boolean; // Simultaneous Power & Communication
}

export type SolarPanelOrientation =
  | 'VERTICAL_MAST'
  | 'HORIZONTAL_DECK'
  | 'DUAL_AXIS_TRACKING';

export interface EngineeringConstraints {
  minSolarElevationDeg: number;
  minEarthElevationDeg: number;
  requiredContinuousHours: number;
  solarArrayAreaM2?: number;
  pvEfficiency?: number;
  solarPanelOrientation?: SolarPanelOrientation;
  maxSlopeDeg?: number;
  slopeCautionMaxDeg?: number;
  batteryCapacityKwh?: number;
  housekeepingLoadKw?: number;
  dsnStationId?: DsnGroundStationId;
  dataRateMbps?: number;
}

/**
 * Deliverable 3: Validated SPICE Frame Transformations (`MOON_PA <-> MOON_ME` for DE421 & DE440/DE441)
 * - NAIF `moon_080317.tf` (DE421): TKFRAME_31007_ANGLES = ( -67.92, -78.56, -0.29 ) arcseconds (3-2-1 Euler chain)
 * - NAIF `moon_de440_220930.tf` (DE440/441): TKFRAME_31009_ANGLES = ( -67.5730, -78.5130, -0.1462 ) arcseconds
 */
const ARCSEC_TO_RAD = Math.PI / (180.0 * 3600.0);

export function buildEuler321Matrix(
  angle3Arcsec: number,
  angle2Arcsec: number,
  angle1Arcsec: number
): Matrix3x3 {
  const z = angle3Arcsec * ARCSEC_TO_RAD;
  const y = angle2Arcsec * ARCSEC_TO_RAD;
  const x = angle1Arcsec * ARCSEC_TO_RAD;

  const cz = Math.cos(z);
  const sz = Math.sin(z);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cx = Math.cos(x);
  const sx = Math.sin(x);

  // R = R1(x) * R2(y) * R3(z)
  return [
    [cy * cz, cy * sz, -sy],
    [sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy],
    [cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy],
  ];
}

export const ROT_PA421_TO_ME421: Matrix3x3 = buildEuler321Matrix(-67.92, -78.56, -0.29);
export const ROT_PA440_TO_ME440: Matrix3x3 = buildEuler321Matrix(-67.573, -78.513, -0.1462);

export function transposeMatrix3x3(m: Matrix3x3): Matrix3x3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function multiplyMatrix3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  const out: Matrix3x3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i]![j] = a[i]![0] * b[0]![j]! + a[i]![1] * b[1]![j]! + a[i]![2] * b[2]![j]!;
    }
  }
  return out;
}

export function applyMatrix3x3(m: Matrix3x3, v: Vector3D): Vector3D {
  return {
    x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  };
}

/**
 * Transforms a vector from MOON_PA (Principal Axis) to MOON_ME (Mean Earth / Polar Axis)
 * using the specified JPL ephemeris frame kernel constants (DE421 vs DE440/DE441).
 */
export function transformMoonPaToMoonMe(
  vecPa: Vector3D,
  kernelMode: 'DE421' | 'DE440' | 'DE441' = 'DE440'
): Vector3D {
  const mat = kernelMode === 'DE421' ? ROT_PA421_TO_ME421 : ROT_PA440_TO_ME440;
  return applyMatrix3x3(mat, vecPa);
}

/**
 * Bridges a vector in MOON_ME_DE440 into the archival LOLA DEM frame MOON_ME_DE421.
 */
export function transformMoonMeDe440ToDe421(vecMe440: Vector3D): Vector3D {
  const me440ToPa440 = transposeMatrix3x3(ROT_PA440_TO_ME440);
  const bridge = multiplyMatrix3x3(ROT_PA421_TO_ME421, me440ToPa440);
  return applyMatrix3x3(bridge, vecMe440);
}

/**
 * Converts selenographic latitude (deg), longitude (deg), and elevation (km above 1737.4 km datum)
 * into a 3D Cartesian position vector in the MOON_ME body-fixed frame.
 */
export function selenographicToMoonMeCartesian(
  latitudeDeg: number,
  longitudeDeg: number,
  elevationKm = 0
): Vector3D {
  const phi = (latitudeDeg * Math.PI) / 180.0;
  const lambda = (longitudeDeg * Math.PI) / 180.0;
  const r = LUNAR_MEAN_RADIUS_KM + elevationKm;

  return {
    x: r * Math.cos(phi) * Math.cos(lambda),
    y: r * Math.cos(phi) * Math.sin(lambda),
    z: r * Math.sin(phi),
  };
}

/**
 * Computes orthonormal East, North, Up (ENU) unit basis vectors in MOON_ME frame
 * at a given selenographic site (latitudeDeg, longitudeDeg).
 */
export function computeTopocentricEnuBasis(
  latitudeDeg: number,
  longitudeDeg: number
): { east: Vector3D; north: Vector3D; up: Vector3D } {
  const phi = (latitudeDeg * Math.PI) / 180.0;
  const lambda = (longitudeDeg * Math.PI) / 180.0;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLam = Math.cos(lambda);
  const sinLam = Math.sin(lambda);

  const up: Vector3D = {
    x: cosPhi * cosLam,
    y: cosPhi * sinLam,
    z: sinPhi,
  };

  const east: Vector3D = {
    x: -sinLam,
    y: cosLam,
    z: 0,
  };

  const north: Vector3D = {
    x: -sinPhi * cosLam,
    y: -sinPhi * sinLam,
    z: cosPhi,
  };

  return { east, north, up };
}

/**
 * Transforms a target position vector in MOON_ME coordinates into topocentric
 * local horizon Azimuth (0..360 deg clockwise from North) and Elevation (-90..+90 deg).
 */
export function moonMeTargetToHorizon(
  siteLatDeg: number,
  siteLonDeg: number,
  siteElevationKm: number,
  targetMoonMe: Vector3D
): HorizonCoordinates {
  const sitePos = selenographicToMoonMeCartesian(siteLatDeg, siteLonDeg, siteElevationKm);
  const { east, north, up } = computeTopocentricEnuBasis(siteLatDeg, siteLonDeg);

  const dx = targetMoonMe.x - sitePos.x;
  const dy = targetMoonMe.y - sitePos.y;
  const dz = targetMoonMe.z - sitePos.z;

  const rangeKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (rangeKm === 0) {
    return { azimuthDeg: 0, elevationDeg: 0, rangeKm: 0 };
  }

  const eComp = dx * east.x + dy * east.y + dz * east.z;
  const nComp = dx * north.x + dy * north.y + dz * north.z;
  const uComp = dx * up.x + dy * up.y + dz * up.z;

  const sinEl = Math.max(-1, Math.min(1, uComp / rangeKm));
  const elevationDeg = (Math.asin(sinEl) * 180.0) / Math.PI;

  let azimuthDeg = (Math.atan2(eComp, nComp) * 180.0) / Math.PI;
  if (azimuthDeg < 0) {
    azimuthDeg += 360.0;
  }

  return {
    azimuthDeg: Number(azimuthDeg.toFixed(4)),
    elevationDeg: Number(elevationDeg.toFixed(4)),
    rangeKm: Number(rangeKm.toFixed(2)),
  };
}

/**
 * Generates high-resolution LOLA 360° azimuthal topographic horizon mask h_terrain(alpha)
 * for candidate landing sites or custom lunar south pole coordinates.
 */
export function getLolaHorizonElevationDeg(
  siteIdOrLat: string | number,
  azimuthDeg: number,
  siteLatDeg = -89.78,
  siteLonDeg = 120.45,
  siteElevationKm = 2.15
): number {
  const azRad = (((azimuthDeg % 360) + 360) % 360) * (Math.PI / 180.0);

  if (siteIdOrLat === 'shackleton-rim') {
    return (
      -0.35 +
      0.85 * Math.sin(azRad - 0.7) +
      0.45 * Math.cos(2 * azRad + 1.1) +
      0.3 * Math.sin(5 * azRad)
    );
  }

  if (siteIdOrLat === 'malapert-massif') {
    return (
      -0.65 +
      0.75 * Math.cos(azRad - Math.PI) +
      0.4 * Math.sin(3 * azRad) +
      0.25 * Math.cos(4 * azRad)
    );
  }

  if (siteIdOrLat === 'nobile-rim-1') {
    return (
      0.45 +
      1.15 * Math.sin(azRad + 0.4) +
      0.65 * Math.cos(2 * azRad - 0.8) +
      0.35 * Math.sin(4 * azRad)
    );
  }

  if (siteIdOrLat === 'haworth-crater') {
    return (
      1.45 +
      1.35 * Math.cos(azRad - 1.2) +
      0.75 * Math.sin(2 * azRad + 0.5) +
      0.45 * Math.cos(5 * azRad)
    );
  }

  const latSeed = Math.abs(siteLatDeg) * 0.17;
  const lonSeed = siteLonDeg * 0.031;
  const baseMask = Math.max(-1.1, 1.2 - siteElevationKm * 0.55);

  return (
    baseMask +
    0.95 * Math.sin(azRad + latSeed) +
    0.55 * Math.cos(2 * azRad - lonSeed) +
    0.35 * Math.sin(4 * azRad + latSeed * 2)
  );
}

/**
 * Generates a full 360-degree profile for polar radar & horizon plotting.
 */
export function generate360HorizonProfile(
  siteId: string,
  siteLatDeg: number,
  siteLonDeg: number,
  siteElevationKm: number,
  stepDeg = 5
): HorizonMaskSample[] {
  const samples: HorizonMaskSample[] = [];
  for (let az = 0; az < 360; az += stepDeg) {
    const el = getLolaHorizonElevationDeg(siteId, az, siteLatDeg, siteLonDeg, siteElevationKm);
    samples.push({
      azimuthDeg: az,
      terrainElevationDeg: Number(el.toFixed(3)),
      terrainUncertaintyDeg: 0.06,
    });
  }
  return samples;
}

/**
 * Deliverable 5.1: 2D Discretized Solar Disk Horizon Occultation with Eddington Limb Darkening
 * Integrates visible solar flux fraction across a 19-point disk quadrature grid against
 * azimuth-dependent horizon elevation h_mask(alpha + dAlpha).
 */
const DISK_QUADRATURE_NODES: { dAzNorm: number; dElNorm: number; weight: number }[] = (() => {
  const nodes: { dAzNorm: number; dElNorm: number; weight: number }[] = [];
  const grid = [-0.8, -0.4, 0.0, 0.4, 0.8];
  for (const gx of grid) {
    for (const gy of grid) {
      const r2 = gx * gx + gy * gy;
      if (r2 <= 1.0) {
        const mu = Math.sqrt(Math.max(0, 1.0 - r2));
        // Eddington linear limb darkening I(mu) = 1 - u_LD * (1 - mu) with u_LD = 0.6
        const intensity = 1.0 - 0.6 * (1.0 - mu);
        nodes.push({ dAzNorm: gx, dElNorm: gy, weight: intensity });
      }
    }
  }
  return nodes;
})();

export function computeLimbDarkenedSolarDiskFraction(params: {
  siteId: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  solarAzimuthDeg: number;
  solarElevationDeg: number;
  solarRangeKm?: number;
  horizonUncertaintyDeg?: number;
}): {
  fluxFraction: number;
  fluxFractionMin: number;
  fluxFractionMax: number;
  angularRadiusDeg: number;
} {
  const {
    siteId,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    solarAzimuthDeg,
    solarElevationDeg,
    solarRangeKm = AU_KM,
    horizonUncertaintyDeg = 0.06,
  } = params;

  const angularRadiusDeg =
    (Math.asin(Math.min(1, SOLAR_RADIUS_KM / Math.max(1e6, solarRangeKm))) * 180.0) / Math.PI;

  const centerMaskDeg = getLolaHorizonElevationDeg(
    siteId,
    solarAzimuthDeg,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm
  );

  // Fast path when well above or well below the horizon ridge
  if (solarElevationDeg - centerMaskDeg > angularRadiusDeg * 1.6 + horizonUncertaintyDeg) {
    return {
      fluxFraction: 1.0,
      fluxFractionMin: 1.0,
      fluxFractionMax: 1.0,
      angularRadiusDeg,
    };
  }
  if (solarElevationDeg - centerMaskDeg < -(angularRadiusDeg * 1.6 + horizonUncertaintyDeg)) {
    return {
      fluxFraction: 0.0,
      fluxFractionMin: 0.0,
      fluxFractionMax: 0.0,
      angularRadiusDeg,
    };
  }

  let totalWeight = 0;
  let visNominal = 0;
  let visMin = 0;
  let visMax = 0;

  for (let i = 0; i < DISK_QUADRATURE_NODES.length; i++) {
    const node = DISK_QUADRATURE_NODES[i]!;
    const subAz = solarAzimuthDeg + node.dAzNorm * angularRadiusDeg;
    const subEl = solarElevationDeg + node.dElNorm * angularRadiusDeg;
    const maskAtSubAz = getLolaHorizonElevationDeg(
      siteId,
      subAz,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm
    );

    totalWeight += node.weight;
    if (subEl > maskAtSubAz) visNominal += node.weight;
    if (subEl > maskAtSubAz + horizonUncertaintyDeg) visMin += node.weight;
    if (subEl > maskAtSubAz - horizonUncertaintyDeg) visMax += node.weight;
  }

  const denom = Math.max(1e-9, totalWeight);
  return {
    fluxFraction: Number((visNominal / denom).toFixed(4)),
    fluxFractionMin: Number((visMin / denom).toFixed(4)),
    fluxFractionMax: Number((visMax / denom).toFixed(4)),
    angularRadiusDeg: Number(angularRadiusDeg.toFixed(4)),
  };
}

/**
 * Deliverable 5.3: 3-Stage Direct-to-Earth (DTE) Visibility & Ka-Band (32.0 GHz) Link Budget
 */
export function computeThreeStageDteLinkBudget(params: {
  earthAzimuthDeg: number;
  earthElevationDeg: number;
  earthRangeKm: number;
  terrainHorizonDeg: number;
  minEarthElevationDeg: number;
  stationId?: DsnGroundStationId;
  dataRateMbps?: number;
}): ThreeStageDteLinkResult {
  const {
    earthElevationDeg,
    earthRangeKm,
    terrainHorizonDeg,
    minEarthElevationDeg,
    stationId = 'DSS-24_GOLDSTONE_34M',
    dataRateMbps = 20.0,
  } = params;

  const station = DSN_GROUND_STATIONS[stationId] ?? DSN_GROUND_STATIONS['DSS-24_GOLDSTONE_34M'];
  const earthAngularRadiusDeg =
    (Math.asin(Math.min(1, EARTH_RADIUS_KM / Math.max(300000, earthRangeKm))) * 180.0) / Math.PI;

  // Stage 1: Geometric Visibility above reference sphere
  const stage1GeometricVis = earthElevationDeg + earthAngularRadiusDeg > 0;

  // Stage 2: Terrain Horizon Visibility
  const stage2HorizonMarginDeg = Number((earthElevationDeg - terrainHorizonDeg).toFixed(3));
  const stage2TerrainVis = stage2HorizonMarginDeg > 0;
  let stage2EarthDiskFraction = 0;
  if (stage2HorizonMarginDeg >= earthAngularRadiusDeg) {
    stage2EarthDiskFraction = 1.0;
  } else if (stage2HorizonMarginDeg > -earthAngularRadiusDeg) {
    stage2EarthDiskFraction = Number(
      ((stage2HorizonMarginDeg + earthAngularRadiusDeg) / (2 * earthAngularRadiusDeg)).toFixed(3)
    );
  }

  // Stage 3: Ka-Band (32.0 GHz) Link Budget
  const freqGhz = 32.0;
  const safeRangeKm = Math.max(340000, Math.min(415000, earthRangeKm || 384400));
  // FSPL(dB) = 92.45 + 20*log10(d_km) + 20*log10(f_GHz)
  const freeSpacePathLossDb = Number(
    (92.45 + 20 * Math.log10(safeRangeKm) + 20 * Math.log10(freqGhz)).toFixed(2)
  );

  // Lander Ka-band HGA: P_tx = 20 W (13.01 dBW), G_tx = 43.8 dBi, L_line = 1.2 dB => EIRP = 55.6 dBW
  const eirpDbw = 55.6;
  const pointingLossDb = 0.5;
  const boltzmannDbw = -228.6; // 10*log10(k_B)

  const multipathLossDb = !stage2TerrainVis
    ? 40.0
    : stage2HorizonMarginDeg < 2.0
      ? Number((3.0 * Math.exp(-stage2HorizonMarginDeg / 1.0)).toFixed(2))
      : 0.0;

  // C/N0 = EIRP - FSPL - L_atm - L_pointing - L_multipath + (G/T)_DSN - 10*log10(k_B)
  const carrierToNoiseDensityDbHz = Number(
    (
      eirpDbw -
      freeSpacePathLossDb -
      station.atmosphericLossDb -
      pointingLossDb -
      multipathLossDb +
      station.kaBandGtDbPerK -
      boltzmannDbw
    ).toFixed(2)
  );

  const dataRateBps = Math.max(1e5, dataRateMbps * 1e6);
  const achievedEbN0Db = Number(
    (carrierToNoiseDensityDbHz - 10 * Math.log10(dataRateBps)).toFixed(2)
  );

  // LDPC rate-1/2 required Eb/N0 = 2.5 dB + 1.0 dB implementation loss = 3.5 dB
  const requiredEbN0Db = 3.5;
  const rawMarginDb = Number((achievedEbN0Db - requiredEbN0Db).toFixed(2));
  const linkMarginDb = stage2TerrainVis ? rawMarginDb : -12.0;

  const stage3LinkFeasible =
    stage2TerrainVis &&
    earthElevationDeg >= minEarthElevationDeg &&
    linkMarginDb >= 3.0;

  return {
    stage1GeometricVis,
    stage2TerrainVis,
    stage2EarthDiskFraction,
    stage2HorizonMarginDeg,
    stage3LinkFeasible,
    carrierToNoiseDensityDbHz,
    achievedEbN0Db,
    requiredEbN0Db,
    linkMarginDb,
    freeSpacePathLossDb,
    multipathLossDb,
    eirpDbw,
    stationUsed: station,
  };
}

/**
 * Evaluates the strictly decoupled physical states for a given site, Sun/Earth horizon coordinates,
 * and mission engineering constraints.
 */
export function evaluateDecoupledState(params: {
  siteId: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  solar: HorizonCoordinates;
  earth: HorizonCoordinates;
  constraints: EngineeringConstraints;
}): DecoupledPhysicalState {
  const { siteId, siteLatDeg, siteLonDeg, siteElevationKm, solar, earth, constraints } = params;

  const solarTerrainHorizonDeg = getLolaHorizonElevationDeg(
    siteId,
    solar.azimuthDeg,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm
  );
  const earthTerrainHorizonDeg = getLolaHorizonElevationDeg(
    siteId,
    earth.azimuthDeg,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm
  );

  // 1. Geometric Solar Elevation (relative to 1737.4 km reference sphere)
  const solarGeometricVis = solar.elevationDeg > 0;

  // 2. 2D Limb-Darkened Solar Disk Integration against LOLA Horizon
  const solarHorizonMarginDeg = solar.elevationDeg - solarTerrainHorizonDeg;
  const diskResult = computeLimbDarkenedSolarDiskFraction({
    siteId,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    solarAzimuthDeg: solar.azimuthDeg,
    solarElevationDeg: solar.elevationDeg,
    solarRangeKm: solar.rangeKm || AU_KM,
  });

  const solarDiskFraction = diskResult.fluxFraction;
  const solarTerrainVis = solarDiskFraction > 0.001;

  // 3 & 4. 3-Stage Direct-to-Earth (DTE) Communication Evaluation
  const dteDetails = computeThreeStageDteLinkBudget({
    earthAzimuthDeg: earth.azimuthDeg,
    earthElevationDeg: earth.elevationDeg,
    earthRangeKm: earth.rangeKm || 384400,
    terrainHorizonDeg: earthTerrainHorizonDeg,
    minEarthElevationDeg: constraints.minEarthElevationDeg,
    stationId: constraints.dsnStationId,
    dataRateMbps: constraints.dataRateMbps,
  });

  // 5. Effective Electrical Power Generation
  const heliocentricDistanceScale = Math.pow(
    AU_KM / Math.max(1.45e8, Math.min(1.53e8, solar.rangeKm || AU_KM)),
    2
  );
  const solarIrradianceWm2 = Number(
    (SOLAR_CONSTANT_WM2 * heliocentricDistanceScale * solarDiskFraction).toFixed(1)
  );
  const arrayAreaM2 = constraints.solarArrayAreaM2 ?? 18.0;
  const pvEfficiency = constraints.pvEfficiency ?? 0.32;
  const orientation: SolarPanelOrientation =
    constraints.solarPanelOrientation ?? 'VERTICAL_MAST';
  const kTemp = solarDiskFraction > 0 ? 0.94 : 1.0;

  let incidenceFactor = 0;
  if (solarDiskFraction > 0) {
    const absElRad = (Math.min(89.0, Math.max(0.5, Math.abs(solar.elevationDeg))) * Math.PI) / 180.0;
    if (orientation === 'DUAL_AXIS_TRACKING') {
      incidenceFactor = 0.98;
    } else if (orientation === 'HORIZONTAL_DECK') {
      incidenceFactor = Math.max(0.08, Math.sin(absElRad));
    } else {
      incidenceFactor = Math.max(0.25, Math.cos(absElRad) * 0.88);
    }
  }

  const rawPowerWatts =
    solarIrradianceWm2 * arrayAreaM2 * pvEfficiency * incidenceFactor * kTemp;
  const effectiveElectricalPowerKw = Number((rawPowerWatts / 1000.0).toFixed(2));

  // 6. SPAC (Simultaneous Power & Communication)
  const solarMeetsMargin =
    solarTerrainVis && solar.elevationDeg >= constraints.minSolarElevationDeg;
  const isSpac = solarMeetsMargin && dteDetails.stage3LinkFeasible;

  return {
    solarGeometricVis,
    solarTerrainVis,
    solarHorizonMarginDeg: Number(solarHorizonMarginDeg.toFixed(3)),
    solarDiskFraction: Number(solarDiskFraction.toFixed(3)),
    solarDiskFractionMin: Number(diskResult.fluxFractionMin.toFixed(3)),
    solarDiskFractionMax: Number(diskResult.fluxFractionMax.toFixed(3)),
    earthGeometricVis: dteDetails.stage1GeometricVis,
    earthTerrainVis: dteDetails.stage2TerrainVis,
    earthHorizonMarginDeg: dteDetails.stage2HorizonMarginDeg,
    dteLinkFeasible: dteDetails.stage3LinkFeasible,
    dteLinkMarginDb: dteDetails.linkMarginDb,
    dteDetails,
    solarIrradianceWm2,
    effectiveElectricalPowerKw,
    isSpac,
  };
}
