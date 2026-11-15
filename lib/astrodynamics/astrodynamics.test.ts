import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimeScales,
  computeLunarPhase,
  normalizeUtcIso,
  utcToEt,
  etToUtc,
  etToUnixMsExact,
  getTaiMinusUtcSeconds,
} from './timeScales';
import {
  computeTopocentricEnuBasis,
  moonMeTargetToHorizon,
  selenographicToMoonMeCartesian,
  evaluateDecoupledState,
  ROT_PA421_TO_ME421,
  ROT_PA440_TO_ME440,
  multiplyMatrix3x3,
  transposeMatrix3x3,
  transformMoonMeDe440ToDe421,
  computeLimbDarkenedSolarDiskFraction,
  computeThreeStageDteLinkBudget,
  getLolaHorizonElevationDeg,
} from './coordinateFrames';
import {
  latLonToPolarStereo,
  polarStereoToLatLon,
  sampleLunarTerrain,
  extractElevationTransect,
  evaluateSiteEllipseScreening,
  LRUTileCache,
} from '../terrain/lolaTerrainEngine';
import { computeCalibratedEphemeris } from './offlineCalibratedProvider';
import { brentDekkerRoot, detectMissionHorizonEvents } from './eventDetection';
import { runMissionTimelineAnalysis } from './missionAnalyzer';

test('VAL-TIME-01: SPICE naif0012.tls LSK lookup and ET <-> UTC round-trip conversion', () => {
  // 1. LCROSS Impact Epoch (2009-10-09): TAI - UTC must be 34.0 s, NOT hardcoded 37.0 s
  const lcrossIso = '2009-10-09T11:31:19.400Z';
  const lcrossTs = computeTimeScales(lcrossIso);
  assert.equal(lcrossTs.taiMinusUtcSeconds, 34);
  assert.equal(lcrossTs.deltaTtSeconds, 66.184);

  // 2. Modern Artemis Epoch (2026-11-12): TAI - UTC must be 37.0 s
  const modernIso = '2026-11-12T16:00:00.000Z';
  const modernTs = computeTimeScales(modernIso);
  assert.equal(modernTs.taiMinusUtcSeconds, 37);
  assert.equal(modernTs.deltaTtSeconds, 69.184);

  // 3. Exact ET <-> UTC round-trip within < 10 microseconds (1e-5 s)
  const etLcross = utcToEt(lcrossIso);
  const roundTripUnixMs = etToUnixMsExact(etLcross);
  const errorSeconds = Math.abs(roundTripUnixMs - Date.parse(lcrossIso)) / 1000.0;
  assert.ok(errorSeconds < 1e-5, `Expected round-trip error < 1e-5 s, got ${errorSeconds}`);
  assert.equal(etToUtc(etLcross), lcrossIso);

  const phase = computeLunarPhase('2027-02-04T20:39:00.181Z');
  assert.ok(phase.illuminatedPercent >= 0 && phase.illuminatedPercent <= 100);
  assert.ok(phase.phaseName.length > 0);
});

test('VAL-PROJ-01: South Polar Stereographic projection round-trip and 90°S singularity freedom', () => {
  // Exact South Pole (-90°S) must map to (0, 0) without NaN or division by zero
  const pole = latLonToPolarStereo(-90.0, 0.0);
  assert.equal(pole.xM, 0);
  assert.equal(pole.yM, 0);
  const invPole = polarStereoToLatLon(0, 0);
  assert.equal(invPole.latDeg, -90.0);

  // Test round-trip accuracy at multiple South Polar coordinates
  const coords = [
    { lat: -89.95, lon: 135.0 },
    { lat: -88.48, lon: -88.4 },
    { lat: -80.0, lon: -45.0 },
  ];
  for (const c of coords) {
    const fwd = latLonToPolarStereo(c.lat, c.lon);
    const inv = polarStereoToLatLon(fwd.xM, fwd.yM);
    const reFwd = latLonToPolarStereo(inv.latDeg, inv.lonDeg);
    const distErrM = Math.hypot(reFwd.xM - fwd.xM, reFwd.yM - fwd.yM);
    assert.ok(distErrM < 1e-6, `Expected stereo round-trip < 1e-6 m, got ${distErrM}`);
  }
});

test('VAL-FRAME-01: SPICE MOON_PA -> MOON_ME Euler rotation matrices for DE421 and DE440 are strictly orthogonal', () => {
  const checkOrthogonal = (mat: typeof ROT_PA421_TO_ME421) => {
    const prod = multiplyMatrix3x3(mat, transposeMatrix3x3(mat));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1.0 : 0.0;
        assert.ok(Math.abs(prod[i]![j]! - expected) < 1e-14);
      }
    }
  };
  checkOrthogonal(ROT_PA421_TO_ME421);
  checkOrthogonal(ROT_PA440_TO_ME440);

  // Bridging a unit vector from MOON_ME_DE440 to MOON_ME_DE421 preserves norm = 1
  const v440 = { x: 0.6, y: -0.5, z: Math.sqrt(1 - 0.36 - 0.25) };
  const v421 = transformMoonMeDe440ToDe421(v440);
  const norm = Math.hypot(v421.x, v421.y, v421.z);
  assert.ok(Math.abs(norm - 1.0) < 1e-14);
});

test('VAL-TERR-01: LOLA DEM Shackleton relief, fractional Float32 LDEC preservation, and LRU tile disposal', () => {
  const rimSample = sampleLunarTerrain(-89.325, 129.78);
  const floorSample = sampleLunarTerrain(-89.67, 129.78);
  const reliefKm = ((rimSample.elevationM ?? 0) - (floorSample.elevationM ?? 0)) / 1000.0;
  assert.ok(reliefKm > 3.2 && reliefKm < 5.0, `Expected Shackleton relief ~4.2 km, got ${reliefKm}`);

  // Non-integer fractional LDEC (0.42) in blended mosaic must be preserved as Float32 and assigned Tier 1
  const blendedSample = sampleLunarTerrain(-89.5, 45.0, { forceLdecOverride: 0.42 });
  assert.equal(blendedSample.measurementSupportLdec, 0.42);
  assert.equal(blendedSample.confidenceTier, 1);
  assert.equal(blendedSample.interpolationStatus, 'MEASUREMENT_CONSTRAINED_GRID');

  // LDEC == 0 must be assigned Tier 2 (Gap-Interpolated)
  const gapSample = sampleLunarTerrain(-89.5, 45.0, { forceLdecOverride: 0.0 });
  assert.equal(gapSample.confidenceTier, 2);
  assert.equal(gapSample.interpolationStatus, 'GAP_INTERPOLATED_GRID');

  // Verify LRU Tile Cache eviction & GPU disposal hook
  let disposedCount = 0;
  const lru = new LRUTileCache(4);
  for (let i = 0; i < 6; i++) {
    lru.put({
      tileKey: `tile-${i}`,
      lodLevel: 2,
      minXM: 0,
      maxXM: 1000,
      minYM: 0,
      maxYM: 1000,
      resolutionPx: 64,
      elevationBuffer: new Float32Array(64 * 64),
      ldecBuffer: new Float32Array(64 * 64),
      slopeBuffer: new Uint16Array(64 * 64),
      uncertaintyBuffer: new Uint16Array(64 * 64),
      byteLength: 64 * 64 * 12,
      lastAccessedMs: Date.now(),
      onDisposeGpu: () => {
        disposedCount++;
      },
    });
  }
  assert.equal(lru.getStats().activeTileCount, 4);
  assert.equal(disposedCount, 2);
});

test('VAL-ILLUM-01: 2D discretized Eddington limb-darkened solar disk occultation', () => {
  const maskDeg = getLolaHorizonElevationDeg('shackleton-rim', 90, -89.78, 120.45, 2.15);

  const occluded = computeLimbDarkenedSolarDiskFraction({
    siteId: 'shackleton-rim',
    siteLatDeg: -89.78,
    siteLonDeg: 120.45,
    siteElevationKm: 2.15,
    solarAzimuthDeg: 90,
    solarElevationDeg: maskDeg - 0.6,
  });
  assert.equal(occluded.fluxFraction, 0.0);

  const grazing = computeLimbDarkenedSolarDiskFraction({
    siteId: 'shackleton-rim',
    siteLatDeg: -89.78,
    siteLonDeg: 120.45,
    siteElevationKm: 2.15,
    solarAzimuthDeg: 90,
    solarElevationDeg: maskDeg,
  });
  assert.ok(grazing.fluxFraction > 0.35 && grazing.fluxFraction < 0.65);

  const clear = computeLimbDarkenedSolarDiskFraction({
    siteId: 'shackleton-rim',
    siteLatDeg: -89.78,
    siteLonDeg: 120.45,
    siteElevationKm: 2.15,
    solarAzimuthDeg: 90,
    solarElevationDeg: maskDeg + 0.6,
  });
  assert.equal(clear.fluxFraction, 1.0);
});

test('VAL-DTE-01 & VAL-SCREEN-01: 3-stage Ka-band DTE link budget and 95th-percentile topographic screening', () => {
  const dteClear = computeThreeStageDteLinkBudget({
    earthAzimuthDeg: 0,
    earthElevationDeg: 5.0,
    earthRangeKm: 384400,
    terrainHorizonDeg: 0.2,
    minEarthElevationDeg: 1.0,
    stationId: 'DSS-24_GOLDSTONE_34M',
    dataRateMbps: 20.0,
  });
  assert.ok(Math.abs(dteClear.freeSpacePathLossDb - 234.25) <= 0.06);
  assert.equal(dteClear.stage1GeometricVis, true);
  assert.equal(dteClear.stage2TerrainVis, true);
  assert.equal(dteClear.stage3LinkFeasible, true);
  assert.ok(dteClear.linkMarginDb >= 3.0);

  const dteOccluded = computeThreeStageDteLinkBudget({
    earthAzimuthDeg: 0,
    earthElevationDeg: 1.2,
    earthRangeKm: 384400,
    terrainHorizonDeg: 2.5,
    minEarthElevationDeg: 1.0,
  });
  assert.equal(dteOccluded.stage1GeometricVis, true);
  assert.equal(dteOccluded.stage2TerrainVis, false);
  assert.equal(dteOccluded.stage3LinkFeasible, false);

  // Topographic screening & transect extraction
  const transect = extractElevationTransect(-89.55, 115.0, -89.88, 295.0, 32);
  assert.equal(transect.length, 32);
  const screening = evaluateSiteEllipseScreening(-89.78, 120.45, 250);
  assert.ok(screening.p95SlopeDeg >= screening.medianSlopeDeg);
  assert.ok(screening.certificationDisclaimer.includes('Not Flight Landing Certification'));
});

test('Topocentric ENU basis, Brent-Dekker root-finder, and VAL-POWER-01 battery SoC timeline integration', () => {
  const { east, north, up } = computeTopocentricEnuBasis(-89.78, 120.45);
  const dotEN = east.x * north.x + east.y * north.y + east.z * north.z;
  assert.ok(Math.abs(dotEN) < 1e-12);

  const siteCart = selenographicToMoonMeCartesian(-89.78, 120.45, 2.15);
  const overheadTarget = {
    x: siteCart.x + up.x * 1000,
    y: siteCart.y + up.y * 1000,
    z: siteCart.z + up.z * 1000,
  };
  const hor = moonMeTargetToHorizon(-89.78, 120.45, 2.15, overheadTarget);
  assert.ok(Math.abs(hor.elevationDeg - 90.0) < 1e-3);

  const root = brentDekkerRoot((t) => (t - 100000) / 1000, 0, 3600000, 1000);
  assert.ok(Math.abs(root - 100000) <= 1000);

  const eph = computeCalibratedEphemeris('2027-02-04T20:39:00.181Z', -89.78, 120.45, 2.15);
  const state = evaluateDecoupledState({
    siteId: 'shackleton-rim',
    siteLatDeg: -89.78,
    siteLonDeg: 120.45,
    siteElevationKm: 2.15,
    solar: { azimuthDeg: 45, elevationDeg: 1.8, rangeKm: 149600000 },
    earth: { azimuthDeg: 0, elevationDeg: 4.5, rangeKm: 384400 },
    constraints: {
      minSolarElevationDeg: 0.5,
      minEarthElevationDeg: 1.0,
      requiredContinuousHours: 120,
    },
  });
  assert.equal(state.isSpac, true);
  assert.ok(eph.earthMoonDistanceKm > 350000 && eph.earthMoonDistanceKm < 410000);

  const iso = normalizeUtcIso('2027-01-15T00:00:00Z');
  const analysis = runMissionTimelineAnalysis({
    siteId: 'shackleton-rim',
    siteName: 'Shackleton Crater Rim',
    siteLatDeg: -89.78,
    siteLonDeg: 120.45,
    siteElevationKm: 2.15,
    psrProximityKm: 0.8,
    epochStartUtc: iso,
    durationDays: 14,
    stepHours: 4,
    constraints: {
      minSolarElevationDeg: 0.0,
      minEarthElevationDeg: 0.5,
      requiredContinuousHours: 96,
    },
  });
  assert.ok(analysis.points.length > 50);
  for (const pt of analysis.points) {
    assert.ok(pt.batterySocPct >= 0 && pt.batterySocPct <= 100);
    assert.ok(Number.isFinite(pt.etSecondsJ2000));
  }

  const eventScan = detectMissionHorizonEvents({
    siteId: 'nobile-rim-1',
    siteLatDeg: -85.2,
    siteLonDeg: 53.5,
    siteElevationKm: 1.65,
    epochStartUtc: '2027-01-01T00:00:00Z',
    epochEndUtc: '2027-01-30T00:00:00Z',
    stepHours: 4,
    constraints: {
      minSolarElevationDeg: 0.0,
      minEarthElevationDeg: 0.5,
      requiredContinuousHours: 72,
    },
  });
  assert.ok(Array.isArray(eventScan.events));
});
