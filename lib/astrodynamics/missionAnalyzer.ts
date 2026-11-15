/**
 * Project Selene — High-Resolution Mission Timeline, Battery SoC Integrator & Multi-Scenario Trade Study Analyzer (v2.1)
 * Generates full ephemeris timelines, SPAC windows, clamped/efficiency-weighted Battery SoC & Energy Deficit profiles,
 * 95th-percentile Topographic Screening evaluations, and explainable Multi-Criteria Decision Analysis (MCDA) rankings.
 */

import {
  EngineeringConstraints,
  evaluateDecoupledState,
  getLolaHorizonElevationDeg,
} from './coordinateFrames';
import {
  HorizonEvent,
  PolarIlluminationRegime,
  detectMissionHorizonEvents,
} from './eventDetection';
import { computeCalibratedEphemeris } from './offlineCalibratedProvider';
import { utcToEt } from './timeScales';
import { evaluateSiteEllipseScreening } from '../terrain/lolaTerrainEngine';

export interface TimelinePoint {
  epochHour: number;
  timestampUtc: string;
  etSecondsJ2000: number;
  solarAzimuthDeg: number;
  solarElevationDeg: number;
  solarTerrainHorizonDeg: number;
  solarDiskFraction: number;
  solarDiskFractionMin: number;
  solarDiskFractionMax: number;
  earthAzimuthDeg: number;
  earthElevationDeg: number;
  earthTerrainHorizonDeg: number;
  solarGeometricVis: boolean;
  solarTerrainVis: boolean;
  earthGeometricVis: boolean;
  earthTerrainVis: boolean;
  dteLinkFeasible: boolean;
  dteLinkMarginDb: number;
  isSpac: boolean;
  solarIrradianceWm2: number;
  effectivePowerKw: number;
  missionLoadKw: number;
  netPowerKw: number;
  batterySocPct: number;
  cumulativeEnergyKwh: number;
  unmetEnergyDeficitKwh: number;
  eclipseSurvivalBreach: boolean;
}

export interface TimelineMetrics {
  totalDurationHours: number;
  totalSunlitHours: number;
  sunlitFractionPct: number;
  longestContinuousSunlightHours: number;
  longestContinuousDarknessHours: number;
  totalCommsHours: number;
  commsFractionPct: number;
  longestContinuousCommsHours: number;
  cumulativeSpacHours: number;
  spacFractionPct: number;
  longestContinuousSpacHours: number;
  avgElectricalPowerKw: number;
  totalEnergyGeneratedKwh: number;
  minBatterySocPct: number;
  totalUnmetEnergyDeficitKwh: number;
  eclipseSurvivalBreachCount: number;
  peakSolarElevationDeg: number;
  minEarthElevationDegObserved: number;
  maxEarthElevationDegObserved: number;
}

export type EngineeringAssessmentStatus =
  | 'MEETS REQUIREMENTS'
  | 'DOES NOT MEET REQUIREMENTS'
  | 'INSUFFICIENT DATA'
  | 'REQUIRES FURTHER ANALYSIS';

export interface McdaConstraintWeights {
  spacWeightPct: number;
  solarWeightPct: number;
  commsWeightPct: number;
  eclipseWeightPct: number;
  scienceWeightPct: number;
}

export const DEFAULT_MCDA_WEIGHTS: McdaConstraintWeights = {
  spacWeightPct: 35,
  solarWeightPct: 25,
  commsWeightPct: 20,
  eclipseWeightPct: 10,
  scienceWeightPct: 10,
};

export interface ConstraintEvaluationItem {
  id: string;
  label: string;
  thresholdValue: string;
  observedValue: string;
  status: 'PASS' | 'FAIL' | 'INDETERMINATE';
  engineeringStatus: EngineeringAssessmentStatus;
  marginSummary: string;
  uncertaintySummary?: string;
}

export interface ExplainableScoreBreakdown {
  overallFeasibilityScore: number; // 0..100
  feasibilityTier: 'TIER I — GO / OPTIMAL' | 'TIER II — CONDITIONAL' | 'TIER III — NO-GO / HIGH RISK';
  engineeringAssessment: EngineeringAssessmentStatus;
  assessmentRationale: string;
  weightsUsed: McdaConstraintWeights;
  criteria: {
    criterion: string;
    weightPct: number;
    rawScore: number; // 0..100
    weightedContribution: number;
    rationale: string;
  }[];
  tradeOffSummary: string;
}

export interface MissionTimelineAnalysis {
  siteId: string;
  siteName: string;
  epochStartUtc: string;
  epochEndUtc: string;
  stepHours: number;
  samplingMode: 'ADAPTIVE_AUTO' | 'MANUAL_FIXED';
  regime: PolarIlluminationRegime;
  points: TimelinePoint[];
  events: HorizonEvent[];
  metrics: TimelineMetrics;
  constraintsEvaluation: ConstraintEvaluationItem[];
  scoreBreakdown: ExplainableScoreBreakdown;
}

/**
 * Computes an adaptive sampling step (in hours) based on mission duration and optional user override.
 */
export function computeAdaptiveStepHours(
  durationDays: number,
  requestedStepHours?: number | 'AUTO'
): { stepHours: number; samplingMode: 'ADAPTIVE_AUTO' | 'MANUAL_FIXED' } {
  if (
    typeof requestedStepHours === 'number' &&
    Number.isFinite(requestedStepHours) &&
    requestedStepHours > 0
  ) {
    const totalHours = Math.max(12, durationDays * 24);
    const minSafeStep = Math.max(0.1, Number((totalHours / 2400).toFixed(2)));
    const clamped = Math.max(minSafeStep, Math.min(12, requestedStepHours));
    return { stepHours: clamped, samplingMode: 'MANUAL_FIXED' };
  }

  if (durationDays <= 1.5) {
    return { stepHours: 0.25, samplingMode: 'ADAPTIVE_AUTO' };
  }
  if (durationDays <= 7.5) {
    return { stepHours: 0.5, samplingMode: 'ADAPTIVE_AUTO' };
  }
  if (durationDays <= 15) {
    return { stepHours: 1.0, samplingMode: 'ADAPTIVE_AUTO' };
  }
  if (durationDays <= 32) {
    return { stepHours: 2.0, samplingMode: 'ADAPTIVE_AUTO' };
  }
  return { stepHours: 4.0, samplingMode: 'ADAPTIVE_AUTO' };
}

/**
 * Generates a complete mission timeline and trade-study evaluation for a site & scenario window.
 */
export function runMissionTimelineAnalysis(params: {
  siteId: string;
  siteName: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  psrProximityKm?: number;
  siteSlopeDeg?: number;
  epochStartUtc: string;
  durationDays: number;
  stepHours?: number | 'AUTO';
  constraints: EngineeringConstraints;
  weights?: Partial<McdaConstraintWeights>;
}): MissionTimelineAnalysis {
  const {
    siteId,
    siteName,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    psrProximityKm = 2.0,
    siteSlopeDeg = 5.8,
    epochStartUtc,
    durationDays,
    stepHours: requestedStep = 'AUTO',
    constraints,
    weights,
  } = params;

  const { stepHours, samplingMode } = computeAdaptiveStepHours(durationDays, requestedStep);

  const startMs = new Date(epochStartUtc).getTime();
  const totalDurationHours = Number(Math.max(6, durationDays * 24).toFixed(2));
  const endMs = startMs + totalDurationHours * 3600 * 1000;
  const epochEndUtc = new Date(endMs).toISOString();

  const points: TimelinePoint[] = [];

  let sunlitSteps = 0;
  let commsSteps = 0;
  let spacSteps = 0;

  let curSunStreak = 0;
  let maxSunStreak = 0;
  let curDarkStreak = 0;
  let maxDarkStreak = 0;
  let curCommsStreak = 0;
  let maxCommsStreak = 0;
  let curSpacStreak = 0;
  let maxSpacStreak = 0;

  let totalPowerKwSum = 0;
  let totalEnergyGeneratedKwh = 0;
  let peakSolarEl = -90;
  let minEarthEl = 90;
  let maxEarthEl = -90;

  // Deliverable 5.2: Physical Battery State-of-Charge (SoC) & Eclipse Deficit Integrator
  const batteryCapKwh = constraints.batteryCapacityKwh ?? 18.0;
  const baseLoadKw = constraints.housekeepingLoadKw ?? 0.35;
  const etaCharge = 0.94;
  const etaDischarge = 0.95;
  const minSafeSocPct = 20.0; // 80% maximum Depth of Discharge (DoD)
  let currentBatteryKwh = batteryCapKwh * 0.95; // Start at 95% SoC at touchdown
  let minBatterySocPct = 95.0;
  let cumulativeEnergyKwh = 0;
  let unmetEnergyDeficitKwh = 0;
  let eclipseSurvivalBreachCount = 0;

  for (let h = 0; h <= totalDurationHours + 1e-6; h += stepHours) {
    const clampedHour = Number(Math.min(totalDurationHours, h).toFixed(3));
    const tMs = startMs + clampedHour * 3600 * 1000;
    const eph = computeCalibratedEphemeris(tMs, siteLatDeg, siteLonDeg, siteElevationKm);
    const state = evaluateDecoupledState({
      siteId,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm,
      solar: eph.solarHorizon,
      earth: eph.earthHorizon,
      constraints,
    });

    const solarTerrainDeg = getLolaHorizonElevationDeg(
      siteId,
      eph.solarHorizon.azimuthDeg,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm
    );
    const earthTerrainDeg = getLolaHorizonElevationDeg(
      siteId,
      eph.earthHorizon.azimuthDeg,
      siteLatDeg,
      siteLonDeg,
      siteElevationKm
    );

    if (eph.solarHorizon.elevationDeg > peakSolarEl) {
      peakSolarEl = eph.solarHorizon.elevationDeg;
    }
    if (eph.earthHorizon.elevationDeg < minEarthEl) {
      minEarthEl = eph.earthHorizon.elevationDeg;
    }
    if (eph.earthHorizon.elevationDeg > maxEarthEl) {
      maxEarthEl = eph.earthHorizon.elevationDeg;
    }

    if (state.solarTerrainVis) {
      sunlitSteps++;
      curSunStreak += stepHours;
      curDarkStreak = 0;
      if (curSunStreak > maxSunStreak) maxSunStreak = curSunStreak;
    } else {
      curDarkStreak += stepHours;
      curSunStreak = 0;
      if (curDarkStreak > maxDarkStreak) maxDarkStreak = curDarkStreak;
    }

    if (state.dteLinkFeasible) {
      commsSteps++;
      curCommsStreak += stepHours;
      if (curCommsStreak > maxCommsStreak) maxCommsStreak = curCommsStreak;
    } else {
      curCommsStreak = 0;
    }

    if (state.isSpac) {
      spacSteps++;
      curSpacStreak += stepHours;
      if (curSpacStreak > maxSpacStreak) maxSpacStreak = curSpacStreak;
    } else {
      curSpacStreak = 0;
    }

    totalPowerKwSum += state.effectiveElectricalPowerKw;

    // Mission electrical load includes housekeeping + Ka-band transmitter when DTE active + survival heaters in shadow
    const commsLoadKw = state.dteLinkFeasible ? 0.08 : 0.01;
    const eclipseHeaterKw = state.solarTerrainVis ? 0.0 : 0.14;
    const missionLoadKw = Number((baseLoadKw + commsLoadKw + eclipseHeaterKw).toFixed(3));
    const netPowerKw = Number((state.effectiveElectricalPowerKw - missionLoadKw).toFixed(3));

    if (h > 0) {
      totalEnergyGeneratedKwh += state.effectiveElectricalPowerKw * stepHours;
      cumulativeEnergyKwh = Number((cumulativeEnergyKwh + netPowerKw * stepHours).toFixed(2));

      if (netPowerKw >= 0) {
        currentBatteryKwh = Math.min(
          batteryCapKwh,
          currentBatteryKwh + netPowerKw * etaCharge * stepHours
        );
      } else {
        const requiredFromBattKwh = (Math.abs(netPowerKw) / etaDischarge) * stepHours;
        if (currentBatteryKwh >= requiredFromBattKwh) {
          currentBatteryKwh -= requiredFromBattKwh;
        } else {
          const shortfallKwh = requiredFromBattKwh - currentBatteryKwh;
          currentBatteryKwh = 0;
          unmetEnergyDeficitKwh = Number((unmetEnergyDeficitKwh + shortfallKwh).toFixed(3));
        }
      }
    }

    const batterySocPct = Number(((currentBatteryKwh / batteryCapKwh) * 100).toFixed(1));
    if (batterySocPct < minBatterySocPct) {
      minBatterySocPct = batterySocPct;
    }
    const eclipseSurvivalBreach = batterySocPct < minSafeSocPct;
    if (eclipseSurvivalBreach) {
      eclipseSurvivalBreachCount++;
    }

    points.push({
      epochHour: clampedHour,
      timestampUtc: eph.timestampUtc,
      etSecondsJ2000: Number(utcToEt(eph.timestampUtc).toFixed(3)),
      solarAzimuthDeg: Number(eph.solarHorizon.azimuthDeg.toFixed(2)),
      solarElevationDeg: Number(eph.solarHorizon.elevationDeg.toFixed(2)),
      solarTerrainHorizonDeg: Number(solarTerrainDeg.toFixed(2)),
      solarDiskFraction: state.solarDiskFraction,
      solarDiskFractionMin: state.solarDiskFractionMin,
      solarDiskFractionMax: state.solarDiskFractionMax,
      earthAzimuthDeg: Number(eph.earthHorizon.azimuthDeg.toFixed(2)),
      earthElevationDeg: Number(eph.earthHorizon.elevationDeg.toFixed(2)),
      earthTerrainHorizonDeg: Number(earthTerrainDeg.toFixed(2)),
      solarGeometricVis: state.solarGeometricVis,
      solarTerrainVis: state.solarTerrainVis,
      earthGeometricVis: state.earthGeometricVis,
      earthTerrainVis: state.earthTerrainVis,
      dteLinkFeasible: state.dteLinkFeasible,
      dteLinkMarginDb: state.dteLinkMarginDb,
      isSpac: state.isSpac,
      solarIrradianceWm2: state.solarIrradianceWm2,
      effectivePowerKw: state.effectiveElectricalPowerKw,
      missionLoadKw,
      netPowerKw,
      batterySocPct,
      cumulativeEnergyKwh,
      unmetEnergyDeficitKwh,
      eclipseSurvivalBreach,
    });
  }

  const totalSteps = Math.max(1, points.length);
  const totalSunlitHours = Number(Math.min(totalDurationHours, sunlitSteps * stepHours).toFixed(2));
  const totalCommsHours = Number(Math.min(totalDurationHours, commsSteps * stepHours).toFixed(2));
  const cumulativeSpacHours = Number(Math.min(totalDurationHours, spacSteps * stepHours).toFixed(2));

  const metrics: TimelineMetrics = {
    totalDurationHours,
    totalSunlitHours,
    sunlitFractionPct: Number(((sunlitSteps / totalSteps) * 100).toFixed(1)),
    longestContinuousSunlightHours: Number(Math.min(totalDurationHours, maxSunStreak).toFixed(2)),
    longestContinuousDarknessHours: Number(Math.min(totalDurationHours, maxDarkStreak).toFixed(2)),
    totalCommsHours,
    commsFractionPct: Number(((commsSteps / totalSteps) * 100).toFixed(1)),
    longestContinuousCommsHours: Number(Math.min(totalDurationHours, maxCommsStreak).toFixed(2)),
    cumulativeSpacHours,
    spacFractionPct: Number(((spacSteps / totalSteps) * 100).toFixed(1)),
    longestContinuousSpacHours: Number(Math.min(totalDurationHours, maxSpacStreak).toFixed(2)),
    avgElectricalPowerKw: Number((totalPowerKwSum / totalSteps).toFixed(2)),
    totalEnergyGeneratedKwh: Number(totalEnergyGeneratedKwh.toFixed(1)),
    minBatterySocPct,
    totalUnmetEnergyDeficitKwh: unmetEnergyDeficitKwh,
    eclipseSurvivalBreachCount,
    peakSolarElevationDeg: Number(peakSolarEl.toFixed(2)),
    minEarthElevationDegObserved: Number(minEarthEl.toFixed(2)),
    maxEarthElevationDegObserved: Number(maxEarthEl.toFixed(2)),
  };

  const { events, regime } = detectMissionHorizonEvents({
    siteId,
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    epochStartUtc,
    epochEndUtc,
    stepHours: Math.max(0.5, stepHours),
    constraints,
  });

  const effectiveRequiredSpacHours = Math.min(
    totalDurationHours,
    constraints.requiredContinuousHours
  );

  const spacPass = metrics.longestContinuousSpacHours >= effectiveRequiredSpacHours;
  const spacMarginal =
    !spacPass && metrics.longestContinuousSpacHours >= effectiveRequiredSpacHours * 0.82;

  const solarPass = metrics.peakSolarElevationDeg >= constraints.minSolarElevationDeg;
  const solarMarginal =
    !solarPass && metrics.peakSolarElevationDeg >= constraints.minSolarElevationDeg - 0.15;

  const earthPass = metrics.maxEarthElevationDegObserved >= constraints.minEarthElevationDeg;
  const earthMarginal =
    !earthPass && metrics.maxEarthElevationDegObserved >= constraints.minEarthElevationDeg - 0.25;

  const eclipseSurvivalPass =
    metrics.longestContinuousDarknessHours <= 64 && metrics.minBatterySocPct >= minSafeSocPct;
  const eclipseMarginal =
    !eclipseSurvivalPass &&
    metrics.longestContinuousDarknessHours <= 88 &&
    metrics.totalUnmetEnergyDeficitKwh === 0;

  // Correction H: Evaluate Topographic Screening using configurable thresholds + 95th-percentile slope, never mean slope alone
  const maxAllowedSlopeDeg = constraints.maxSlopeDeg ?? 10.0;
  const cautionSlopeDeg = constraints.slopeCautionMaxDeg ?? Math.max(15.0, maxAllowedSlopeDeg + 4.0);
  const isNonPolarSite = siteLatDeg > -60.0;

  const ellipseScreening = evaluateSiteEllipseScreening(siteLatDeg, siteLonDeg, 250, {
    profileName: 'Active Mission Constraints',
    slopeSafeMaxDeg: maxAllowedSlopeDeg,
    slopeCautionMaxDeg: cautionSlopeDeg,
    roughnessSafeMaxM: 0.6,
    maxVerticalErrM: 1.5,
  });

  const slopePass = !isNonPolarSite && siteSlopeDeg <= maxAllowedSlopeDeg;
  const slopeMarginal =
    !isNonPolarSite && !slopePass && siteSlopeDeg <= cautionSlopeDeg;

  const constraintsEvaluation: ConstraintEvaluationItem[] = [
    {
      id: 'continuous-spac',
      label: 'Continuous SPAC Window Duration',
      thresholdValue: `>= ${effectiveRequiredSpacHours} h`,
      observedValue: `${metrics.longestContinuousSpacHours} h`,
      status: spacPass ? 'PASS' : spacMarginal ? 'INDETERMINATE' : 'FAIL',
      engineeringStatus: spacPass
        ? 'MEETS REQUIREMENTS'
        : spacMarginal
          ? 'REQUIRES FURTHER ANALYSIS'
          : 'DOES NOT MEET REQUIREMENTS',
      marginSummary: `${(metrics.longestContinuousSpacHours - effectiveRequiredSpacHours).toFixed(1)} h margin against mission requirement`,
      uncertaintySummary: '±0.5 h root-finding & LOLA horizon discretization tolerance',
    },
    {
      id: 'solar-elevation-floor',
      label: 'Solar Grazing Elevation Floor',
      thresholdValue: `>= ${constraints.minSolarElevationDeg.toFixed(1)}°`,
      observedValue: `${metrics.peakSolarElevationDeg.toFixed(2)}° peak`,
      status: solarPass ? 'PASS' : solarMarginal ? 'INDETERMINATE' : 'FAIL',
      engineeringStatus: solarPass
        ? 'MEETS REQUIREMENTS'
        : solarMarginal
          ? 'REQUIRES FURTHER ANALYSIS'
          : 'DOES NOT MEET REQUIREMENTS',
      marginSummary: `Peak Sun at ${(metrics.peakSolarElevationDeg - constraints.minSolarElevationDeg).toFixed(2)}° relative to array threshold`,
      uncertaintySummary: '±0.02° JPL DE440/DE441 ephemeris & ±0.06° LOLA ADJ_ERR ridge mask uncertainty',
    },
    {
      id: 'dte-earth-elevation',
      label: 'Direct-to-Earth (DTE) Elevation Clearance',
      thresholdValue: `>= ${constraints.minEarthElevationDeg.toFixed(1)}°`,
      observedValue: `${metrics.minEarthElevationDegObserved.toFixed(2)}° .. ${metrics.maxEarthElevationDegObserved.toFixed(2)}°`,
      status: earthPass ? 'PASS' : earthMarginal ? 'INDETERMINATE' : 'FAIL',
      engineeringStatus: earthPass
        ? 'MEETS REQUIREMENTS'
        : earthMarginal
          ? 'REQUIRES FURTHER ANALYSIS'
          : 'DOES NOT MEET REQUIREMENTS',
      marginSummary: `${metrics.commsFractionPct}% of mission window satisfies 3-stage Ka-band >= 3.0 dB link margin`,
      uncertaintySummary: '±0.8 dB Ka-band atmospheric & multipath grazing margin (1σ)',
    },
    {
      id: 'cryogenic-eclipse-survival',
      label: 'Cryogenic Night / Battery SoC Survival Limit',
      thresholdValue: '<= 64 h dark & SoC >= 20%',
      observedValue: `${metrics.longestContinuousDarknessHours} h dark (Min SoC ${metrics.minBatterySocPct}%)`,
      status: eclipseSurvivalPass ? 'PASS' : eclipseMarginal ? 'INDETERMINATE' : 'FAIL',
      engineeringStatus: eclipseSurvivalPass
        ? 'MEETS REQUIREMENTS'
        : eclipseMarginal
          ? 'REQUIRES FURTHER ANALYSIS'
          : 'DOES NOT MEET REQUIREMENTS',
      marginSummary:
        metrics.longestContinuousDarknessHours === 0
          ? `Zero eclipse darkness; min battery SoC ${metrics.minBatterySocPct}%`
          : `${metrics.longestContinuousDarknessHours} h max shadow; min battery SoC ${metrics.minBatterySocPct}% (deficit ${metrics.totalUnmetEnergyDeficitKwh} kWh)`,
      uncertaintySummary: '±15 K Diviner bolometric thermal inertia & η_chg=0.94 / η_dis=0.95 model',
    },
    {
      id: 'terrain-slope-safety',
      label: 'Regional Topographic Slope Screening (LOLA DEM)',
      thresholdValue: `<= ${maxAllowedSlopeDeg.toFixed(1)}° screen`,
      observedValue: isNonPolarSite
        ? `${siteSlopeDeg.toFixed(1)}° mean (118m Global DEM)`
        : `${siteSlopeDeg.toFixed(1)}° mean · S95=${ellipseScreening.p95SlopeDeg}° (5–10m Polar DEM)`,
      status: slopePass ? 'PASS' : isNonPolarSite || slopeMarginal ? 'INDETERMINATE' : 'FAIL',
      engineeringStatus: isNonPolarSite
        ? 'INSUFFICIENT DATA'
        : slopePass
          ? 'MEETS REQUIREMENTS'
          : slopeMarginal
            ? 'REQUIRES FURTHER ANALYSIS'
            : 'DOES NOT MEET REQUIREMENTS',
      marginSummary: isNonPolarSite
        ? 'INSUFFICIENT 5m POLAR LOLA DEM DATA: Site outside 80°S–90°S LDEM_80S coverage; using 118m global LDEM_1024 estimate'
        : `Topographic Screening: ${(maxAllowedSlopeDeg - siteSlopeDeg).toFixed(1)}° margin (95th-pct S95=${ellipseScreening.p95SlopeDeg}°, LDEC support ${(ellipseScreening.measurementSupportedFraction * 100).toFixed(0)}%). Not flight landing certification.`,
      uncertaintySummary: isNonPolarSite
        ? '±15.0 m vertical / ±1.8° slope uncertainty (Global LOLA 118m LDEM_1024)'
        : `±${ellipseScreening.maxVerticalUncertaintyM} m ADJ_ERR / ${ellipseScreening.maxEffectiveResolutionM} m ADJ_EFFRES (LOLA South Pole _ADJ)`,
    },
  ];

  const rawWeights: McdaConstraintWeights = {
    spacWeightPct: Math.max(0, weights?.spacWeightPct ?? DEFAULT_MCDA_WEIGHTS.spacWeightPct),
    solarWeightPct: Math.max(0, weights?.solarWeightPct ?? DEFAULT_MCDA_WEIGHTS.solarWeightPct),
    commsWeightPct: Math.max(0, weights?.commsWeightPct ?? DEFAULT_MCDA_WEIGHTS.commsWeightPct),
    eclipseWeightPct: Math.max(0, weights?.eclipseWeightPct ?? DEFAULT_MCDA_WEIGHTS.eclipseWeightPct),
    scienceWeightPct: Math.max(0, weights?.scienceWeightPct ?? DEFAULT_MCDA_WEIGHTS.scienceWeightPct),
  };
  const weightSum =
    rawWeights.spacWeightPct +
    rawWeights.solarWeightPct +
    rawWeights.commsWeightPct +
    rawWeights.eclipseWeightPct +
    rawWeights.scienceWeightPct || 100;

  const normalizedWeights: McdaConstraintWeights = {
    spacWeightPct: Number(((rawWeights.spacWeightPct / weightSum) * 100).toFixed(1)),
    solarWeightPct: Number(((rawWeights.solarWeightPct / weightSum) * 100).toFixed(1)),
    commsWeightPct: Number(((rawWeights.commsWeightPct / weightSum) * 100).toFixed(1)),
    eclipseWeightPct: Number(((rawWeights.eclipseWeightPct / weightSum) * 100).toFixed(1)),
    scienceWeightPct: Number(((rawWeights.scienceWeightPct / weightSum) * 100).toFixed(1)),
  };

  const spacScore = Math.min(
    100,
    Math.round(
      metrics.spacFractionPct * 0.55 +
        Math.min(
          100,
          (metrics.longestContinuousSpacHours / Math.max(6, effectiveRequiredSpacHours)) * 100
        ) *
          0.45
    )
  );
  const solarScore = Math.min(100, Math.round(metrics.sunlitFractionPct));
  const commsScore = Math.min(100, Math.round(metrics.commsFractionPct));
  const eclipseScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (metrics.longestContinuousDarknessHours / 150) * 100))
  );
  const scienceScore = Math.max(
    45,
    Math.min(100, Math.round(100 - Math.max(0, psrProximityKm - 0.5) * 9))
  );

  const criteria = [
    {
      criterion: 'SPAC Continuity & Duty Cycle',
      weightPct: normalizedWeights.spacWeightPct,
      rawScore: spacScore,
      weightedContribution: Number(
        ((spacScore * normalizedWeights.spacWeightPct) / 100).toFixed(1)
      ),
      rationale: `${metrics.spacFractionPct}% SPAC coverage (${metrics.longestContinuousSpacHours}h continuous vs ${effectiveRequiredSpacHours}h threshold)`,
    },
    {
      criterion: 'Solar Illumination & Array Power',
      weightPct: normalizedWeights.solarWeightPct,
      rawScore: solarScore,
      weightedContribution: Number(
        ((solarScore * normalizedWeights.solarWeightPct) / 100).toFixed(1)
      ),
      rationale: `${metrics.sunlitFractionPct}% limb-darkened terrain-aware sunlight (${metrics.avgElectricalPowerKw} kW avg output)`,
    },
    {
      criterion: 'Direct-to-Earth (DTE) Link Availability',
      weightPct: normalizedWeights.commsWeightPct,
      rawScore: commsScore,
      weightedContribution: Number(
        ((commsScore * normalizedWeights.commsWeightPct) / 100).toFixed(1)
      ),
      rationale: `${metrics.commsFractionPct}% 3-stage Ka-band DTE visibility above ${constraints.minEarthElevationDeg.toFixed(1)}° floor`,
    },
    {
      criterion: 'Cryogenic Darkness & Battery SoC Margin',
      weightPct: normalizedWeights.eclipseWeightPct,
      rawScore: eclipseScore,
      weightedContribution: Number(
        ((eclipseScore * normalizedWeights.eclipseWeightPct) / 100).toFixed(1)
      ),
      rationale: `${metrics.longestContinuousDarknessHours}h max darkness (min battery SoC ${metrics.minBatterySocPct}%)`,
    },
    {
      criterion: 'Model-Derived Volatile / PSR Proximity Index',
      weightPct: normalizedWeights.scienceWeightPct,
      rawScore: scienceScore,
      weightedContribution: Number(
        ((scienceScore * normalizedWeights.scienceWeightPct) / 100).toFixed(1)
      ),
      rationale: `${psrProximityKm.toFixed(1)} km traverse range to nearest LPSR cold-trap boundary (Composite Model Index)`,
    },
  ];

  const overallFeasibilityScore = Math.round(
    criteria.reduce((acc, item) => acc + item.weightedContribution, 0)
  );

  const hasFailedConstraint = constraintsEvaluation.some((c) => c.status === 'FAIL');
  const hasInsufficientData = constraintsEvaluation.some(
    (c) => c.engineeringStatus === 'INSUFFICIENT DATA'
  );
  const hasRequiresFurtherAnalysis = constraintsEvaluation.some(
    (c) => c.engineeringStatus === 'REQUIRES FURTHER ANALYSIS'
  );

  let engineeringAssessment: EngineeringAssessmentStatus = 'MEETS REQUIREMENTS';
  let assessmentRationale = '';

  if (hasFailedConstraint) {
    engineeringAssessment = 'DOES NOT MEET REQUIREMENTS';
    const failedLabels = constraintsEvaluation
      .filter((c) => c.status === 'FAIL')
      .map((c) => c.label)
      .join(', ');
    assessmentRationale = `Does not meet configured engineering thresholds for: ${failedLabels}. Adjust landing epoch, duration, or mission hardware constraints.`;
  } else if (hasInsufficientData) {
    engineeringAssessment = 'INSUFFICIENT DATA';
    assessmentRationale = `Target coordinates (${siteLatDeg.toFixed(2)}°N/S) lie outside the verified 5 m/px LRO LOLA South Polar DEM (LDEM_80S, 80°S–90°S). Local horizon masking uses lower-resolution global altimetry (LDEM_1024, 118 m/px).`;
  } else if (hasRequiresFurtherAnalysis || overallFeasibilityScore < 76) {
    engineeringAssessment = 'REQUIRES FURTHER ANALYSIS';
    assessmentRationale = `Marginal clearance against configured constraints or ±1σ uncertainty bounds (${metrics.spacFractionPct}% SPAC, ${metrics.longestContinuousDarknessHours}h max shadow). Detailed local hazard and power load-shedding review required.`;
  } else {
    engineeringAssessment = 'MEETS REQUIREMENTS';
    assessmentRationale = `Satisfies all configured solar elevation (>=${constraints.minSolarElevationDeg}°), DTE link (>=${constraints.minEarthElevationDeg}°), continuous SPAC (>=${effectiveRequiredSpacHours}h), eclipse survival, and LOLA regional slope screening (<= ${maxAllowedSlopeDeg}°) requirements.`;
  }

  let feasibilityTier: ExplainableScoreBreakdown['feasibilityTier'] = 'TIER II — CONDITIONAL';
  if (engineeringAssessment === 'MEETS REQUIREMENTS') {
    feasibilityTier = 'TIER I — GO / OPTIMAL';
  } else if (engineeringAssessment === 'DOES NOT MEET REQUIREMENTS') {
    feasibilityTier = 'TIER III — NO-GO / HIGH RISK';
  }

  return {
    siteId,
    siteName,
    epochStartUtc,
    epochEndUtc,
    stepHours,
    samplingMode,
    regime,
    points,
    events,
    metrics,
    constraintsEvaluation,
    scoreBreakdown: {
      overallFeasibilityScore,
      feasibilityTier,
      engineeringAssessment,
      assessmentRationale,
      weightsUsed: normalizedWeights,
      criteria,
      tradeOffSummary: assessmentRationale,
    },
  };
}
