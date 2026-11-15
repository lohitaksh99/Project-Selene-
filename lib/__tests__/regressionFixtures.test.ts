import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTimeScales, utcToEt, etToUtc } from '../astrodynamics/timeScales';
import { computeCalibratedEphemeris } from '../astrodynamics/offlineCalibratedProvider';
import {
  evaluateDecoupledState,
  getLolaHorizonElevationDeg,
  computeLimbDarkenedSolarDiskFraction,
  computeThreeStageDteLinkBudget,
} from '../astrodynamics/coordinateFrames';
import { sampleLunarTerrain, evaluateSiteEllipseScreening } from '../terrain/lolaTerrainEngine';
import { runMissionTimelineAnalysis } from '../astrodynamics/missionAnalyzer';

describe('Phase 0/1 — Golden Scientific Regression Fixtures (Pre-Refactor Numerical Lock)', () => {
  it('locks SPICE naif0012.tls time scales and ET <-> UTC roundtrip at 2027-02-04T20:39:00.181Z', () => {
    const epoch = '2027-02-04T20:39:00.181Z';
    const ts = computeTimeScales(epoch);
    assert.equal(ts.taiMinusUtcSeconds, 37);
    assert.equal(ts.deltaTtSeconds, 69.184);
    assert.ok(Math.abs(ts.etSecondsJ2000 - 855045609.3658751) < 1e-6);
    assert.ok(Math.abs(ts.jdTdb - 2461441.3612195123) < 1e-9);
    assert.equal(etToUtc(utcToEt(epoch)), epoch);
  });

  it('locks Shackleton Crater Rim DE441 calibrated ephemeris & ENU topocentric horizon', () => {
    const eph = computeCalibratedEphemeris('2027-02-04T20:39:00.181Z', -89.78, 120.45, 2.15);
    assert.equal(eph.subSolarLatDeg, 0.14);
    assert.equal(eph.subSolarLonDeg, -164.2359);
    assert.equal(eph.subEarthLatDeg, 2.8109);
    assert.equal(eph.subEarthLonDeg, 2.329);
    assert.equal(eph.earthMoonDistanceKm, 405137.7);
    assert.equal(eph.solarHorizon.azimuthDeg, 75.3137);
    assert.equal(eph.solarHorizon.elevationDeg, -0.0849);
    assert.equal(eph.earthHorizon.azimuthDeg, 241.8887);
    assert.equal(eph.earthHorizon.elevationDeg, -3.1602);
  });

  it('locks decoupled physical visibility, limb-darkened solar disk, and DTE link budget', () => {
    const eph = computeCalibratedEphemeris('2027-02-04T20:39:00.181Z', -89.78, 120.45, 2.15);
    const dec = evaluateDecoupledState({
      siteId: 'shackleton-rim',
      siteLatDeg: -89.78,
      siteLonDeg: 120.45,
      siteElevationKm: 2.15,
      solar: eph.solarHorizon,
      earth: eph.earthHorizon,
      constraints: {
        minSolarElevationDeg: 0.2,
        minEarthElevationDeg: 1.0,
        requiredContinuousHours: 120,
      },
    });
    assert.equal(dec.solarGeometricVis, false);
    assert.equal(dec.solarTerrainVis, true);
    assert.equal(dec.solarHorizonMarginDeg, 0.064);
    assert.equal(dec.solarDiskFraction, 0.632);
    assert.equal(dec.solarIrradianceWm2, 884.8);
    assert.equal(dec.effectiveElectricalPowerKw, 4.22);
    assert.equal(dec.isSpac, false);

    const disk = computeLimbDarkenedSolarDiskFraction({
      siteId: 'shackleton-rim',
      siteLatDeg: -89.78,
      siteLonDeg: 120.45,
      siteElevationKm: 2.15,
      solarAzimuthDeg: eph.solarHorizon.azimuthDeg,
      solarElevationDeg: eph.solarHorizon.elevationDeg,
      solarRangeKm: eph.solarHorizon.rangeKm,
    });
    assert.equal(disk.fluxFraction, 0.6318);

    const dte = computeThreeStageDteLinkBudget({
      earthAzimuthDeg: eph.earthHorizon.azimuthDeg,
      earthElevationDeg: eph.earthHorizon.elevationDeg,
      earthRangeKm: eph.earthHorizon.rangeKm,
      terrainHorizonDeg: getLolaHorizonElevationDeg(
        'shackleton-rim',
        eph.earthHorizon.azimuthDeg,
        -89.78,
        120.45,
        2.15
      ),
      minEarthElevationDeg: 1.0,
    });
    assert.equal(dte.freeSpacePathLossDb, 234.71);
    assert.equal(dte.linkMarginDb, -12);
  });

  it('locks LOLA DEM sampling and 95th-percentile site ellipse screening', () => {
    const terr = sampleLunarTerrain(-89.78, 120.45);
    assert.equal(terr.elevationM, -2033.7);
    assert.equal(terr.slopeDeg, 4.96);
    assert.equal(terr.measurementSupportLdec, 5.54);
    assert.equal(terr.confidenceTier, 1);

    const screen = evaluateSiteEllipseScreening(-89.78, 120.45, 250);
    assert.equal(screen.sampleCount, 29);
    assert.equal(screen.medianSlopeDeg, 5.07);
    assert.equal(screen.p95SlopeDeg, 5.71);
    assert.equal(screen.safeCellFractionPct, 100);
  });

  it('locks 14-day Mission Timeline Analysis & MCDA feasibility score', () => {
    const tl = runMissionTimelineAnalysis({
      siteId: 'shackleton-rim',
      siteName: 'Shackleton Crater Rim',
      siteLatDeg: -89.78,
      siteLonDeg: 120.45,
      siteElevationKm: 2.15,
      psrProximityKm: 0.8,
      siteSlopeDeg: 5.8,
      epochStartUtc: '2027-02-01T00:00:00Z',
      durationDays: 14,
      stepHours: 4,
      constraints: {
        minSolarElevationDeg: 0.2,
        minEarthElevationDeg: 1.0,
        requiredContinuousHours: 120,
      },
    });
    assert.equal(tl.metrics.totalDurationHours, 336);
    assert.equal(tl.metrics.totalSunlitHours, 256);
    assert.equal(tl.metrics.totalCommsHours, 172);
    assert.equal(tl.metrics.cumulativeSpacHours, 136);
    assert.equal(tl.metrics.avgElectricalPowerKw, 4.86);
    assert.equal(tl.metrics.totalEnergyGeneratedKwh, 1652);
    assert.equal(tl.scoreBreakdown.overallFeasibilityScore, 67);
  });
});
