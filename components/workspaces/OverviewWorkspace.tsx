'use client';

import React from 'react';
import LunarGlobe from '../three/LunarGlobe';
import type { LandingSiteRecord } from '@/server/db/database';
import { DecoupledPhysicalState, HorizonCoordinates } from '@/lib/astrodynamics/coordinateFrames';
import { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import { LunarShaderMode, SeleneWorkspaceTab } from '@/lib/store/useSeleneStore';
import { computeRemainingHorizonCountdowns } from '@/lib/astrodynamics/eventDetection';
import {
  EditorialMetricCard,
  EditorialWorkspaceHeader,
  EngineeringStatusBadge,
  ExpandableTechnicalDrawer,
} from '../editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '../editorial/DatasetIntegrationSlot';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ArrowRight, Clock, Radio, Sun } from 'lucide-react';

interface OverviewWorkspaceProps {
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  onSelectSite: (siteId: string) => void;
  shaderMode: LunarShaderMode;
  onChangeShaderMode: (mode: LunarShaderMode) => void;
  simulationEpochUtc: string;
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
  physicalState: DecoupledPhysicalState;
  timelineAnalysis: MissionTimelineAnalysis;
  onNavigateTab: (tab: SeleneWorkspaceTab) => void;
  isEduMode?: boolean;
}

export default function OverviewWorkspace({
  sites,
  activeSite,
  onSelectSite,
  shaderMode,
  onChangeShaderMode,
  simulationEpochUtc,
  solarHorizon,
  earthHorizon,
  subSolarLatDeg,
  subSolarLonDeg,
  physicalState,
  timelineAnalysis,
  onNavigateTab,
  isEduMode = false,
}: OverviewWorkspaceProps) {
  const { metrics, events, constraintsEvaluation, scoreBreakdown, points } = timelineAnalysis;

  const countdowns = computeRemainingHorizonCountdowns(
    events,
    simulationEpochUtc,
    physicalState.solarTerrainVis,
    physicalState.dteLinkFeasible
  );

  // Adaptive chart downsampling for clean visual rendering
  const stride = Math.max(1, Math.floor(points.length / 80));
  const chartData = points
    .filter((_, idx) => idx % stride === 0)
    .map((pt) => ({
      hour: `T+${pt.epochHour}h`,
      solarEl: pt.solarElevationDeg,
      earthEl: pt.earthElevationDeg,
      powerKw: pt.effectivePowerKw,
    }));

  const spacConstraint = constraintsEvaluation.find((c) => c.id === 'continuous-spac');
  const solarConstraint = constraintsEvaluation.find((c) => c.id === 'solar-elevation-floor');
  const earthConstraint = constraintsEvaluation.find((c) => c.id === 'dte-earth-elevation');
  const slopeConstraint = constraintsEvaluation.find((c) => c.id === 'terrain-slope-safety');

  return (
    <div className="space-y-8">
      {/* 1. Editorial Workspace Header & Transparent Engineering Assessment */}
      <EditorialWorkspaceHeader
        sectionIndex="01"
        eyebrow="EXECUTIVE MISSION BRIEFING & REQUIREMENT VERIFICATION"
        title={activeSite.name}
        description={scoreBreakdown.assessmentRationale}
        site={activeSite}
        rightSlot={
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2 min-w-[260px]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--selene-text-muted)]">
              CONFIGURED REQUIREMENT STATUS
            </div>
            <div>
              <EngineeringStatusBadge status={scoreBreakdown.engineeringAssessment} size="md" />
            </div>
            <div className="text-xs font-mono text-[var(--selene-text-secondary)] pt-1 flex items-center justify-between">
              <span>Weighted Index:</span>
              <span className="font-bold text-[var(--selene-text)]">
                {scoreBreakdown.overallFeasibilityScore} / 100
              </span>
            </div>
          </div>
        }
      />

      {/* 2. Hero Scientific Metric Cards (Plain-English Meaning + Why It Matters + Provenance) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <EditorialMetricCard
          label="Solar Illumination & Array Output"
          value={`${metrics.sunlitFractionPct}%`}
          unit={`(${metrics.avgElectricalPowerKw} kW avg)`}
          status={solarConstraint?.engineeringStatus}
          accentColor="solar"
          meaning={`Sun is currently at ${solarHorizon.elevationDeg.toFixed(2)}° elevation (${solarHorizon.azimuthDeg.toFixed(1)}° Az) with ${physicalState.solarIrradianceWm2} W/m² incident flux.`}
          whyItMatters="Determines continuous photovoltaic power generation and prevents battery depletion during cryogenic shadow intervals."
          provenance="JPL DE441-MOON_ME + LOLA Horizon Mask"
        />

        <EditorialMetricCard
          label="Direct-to-Earth (DTE) Link"
          value={`${metrics.commsFractionPct}%`}
          unit={`(${physicalState.dteLinkMarginDb} dB margin)`}
          status={earthConstraint?.engineeringStatus}
          accentColor="earth"
          meaning={`Earth stands at ${earthHorizon.elevationDeg.toFixed(2)}° elevation (${earthHorizon.azimuthDeg.toFixed(1)}° Az) across the ${metrics.totalDurationHours}h window.`}
          whyItMatters="Direct line-of-sight above local terrain ridges is required for high-rate Ka-band telemetry without a lunar relay satellite."
          provenance="NAIF SPICE moon_pa_de440 + Topocentric ENU"
        />

        <EditorialMetricCard
          label="Longest Continuous Co-Visibility"
          value={metrics.longestContinuousSpacHours}
          unit="Hours SPAC"
          status={spacConstraint?.engineeringStatus}
          accentColor="spac"
          meaning={`Simultaneous Power and Communication (SPAC) holds for ${metrics.spacFractionPct}% of the mission (${metrics.cumulativeSpacHours}h cumulative).`}
          whyItMatters="Crew EVA and high-power surface drilling require uninterrupted simultaneous solar array charging and Earth telemetry."
          provenance="Brent-Dekker Horizon Root-Finder (Δt ≤ 5s)"
        />

        <EditorialMetricCard
          label="Surface Slope & Polar DEM Datum"
          value={`${activeSite.slope_deg.toFixed(1)}°`}
          unit={`${activeSite.elevation_km >= 0 ? '+' : ''}${activeSite.elevation_km.toFixed(2)} km`}
          status={slopeConstraint?.engineeringStatus}
          accentColor="yellow"
          meaning={
            activeSite.latitude <= -60
              ? `Mean slope of ${activeSite.slope_deg.toFixed(1)}° verified inside 5 m/px South Polar LOLA laser altimetry coverage.`
              : `Site at ${activeSite.latitude.toFixed(2)}° lies outside 80°S–90°S 5m polar DEM; evaluated with 118m global altimetry.`
          }
          whyItMatters="Lander touchdown stability requires gentle slopes below the configured tip-over safety threshold."
          provenance={
            activeSite.latitude <= -60
              ? 'LRO LOLA LDEM_80S v1.4 GDS (5 m/px)'
              : 'LRO LOLA LDEM_1024 v1.8 GDR (118 m/px)'
          }
        />
      </div>

      {/* 3. Spacious Main Visualization Stage: 3D Lunar Globe + Requirement Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <LunarGlobe
            sites={sites}
            activeSiteId={activeSite.id}
            onSelectSite={onSelectSite}
            shaderMode={shaderMode}
            onChangeShaderMode={onChangeShaderMode}
            subSolarLatDeg={subSolarLatDeg}
            subSolarLonDeg={subSolarLonDeg}
            compact
          />
        </div>

        {/* Right Editorial Requirement & Horizon Panel */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-[var(--selene-surface)] border border-[var(--selene-border)] p-6 space-y-6">
          <div className="space-y-5">
            <div className="pb-3 border-b border-[var(--selene-border)] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--selene-accent-solar)] font-bold">
                  HORIZON & CONSTRAINT AUDIT
                </div>
                <h2 className="text-base font-bold text-[var(--selene-text)] mt-0.5">
                  Countdowns & Threshold Checks
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[var(--selene-accent-earth)]">
                {isEduMode ? 'GUIDED VIEW' : `STEP ${timelineAnalysis.stepHours}h`}
              </span>
            </div>

            {/* Horizon Countdowns */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[var(--selene-accent-solar)] font-bold">
                    <Sun className="w-3.5 h-3.5" />
                    <span>SOLAR HORIZON TRANSITION</span>
                  </span>
                  <span className="text-[var(--selene-text)] font-bold tabular-nums">
                    {countdowns.sunsetCountdownLabel}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--selene-text-muted)] font-mono tabular-nums">
                  Next Sunrise:{' '}
                  {countdowns.nextSunriseUtc
                    ? countdowns.nextSunriseUtc.slice(0, 16) + 'Z'
                    : 'Continuous'}{' '}
                  · Sunset:{' '}
                  {countdowns.nextSunsetUtc
                    ? countdowns.nextSunsetUtc.slice(0, 16) + 'Z'
                    : 'None in Window'}
                </div>
              </div>

              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[var(--selene-accent-earth)] font-bold">
                    <Radio className="w-3.5 h-3.5" />
                    <span>EARTH DTE TRANSITION</span>
                  </span>
                  <span className="text-[var(--selene-text)] font-bold tabular-nums">
                    {countdowns.earthsetCountdownLabel}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--selene-text-muted)] font-mono tabular-nums">
                  Next Earthrise:{' '}
                  {countdowns.nextEarthriseUtc
                    ? countdowns.nextEarthriseUtc.slice(0, 16) + 'Z'
                    : 'Continuous'}{' '}
                  · Earthset:{' '}
                  {countdowns.nextEarthsetUtc
                    ? countdowns.nextEarthsetUtc.slice(0, 16) + 'Z'
                    : 'None in Window'}
                </div>
              </div>
            </div>

            {/* Explicit Four-Tier Constraint Checks */}
            <div className="space-y-2.5 pt-2 border-t border-[var(--selene-border)]">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--selene-text-muted)]">
                Requirement Threshold Evaluations
              </div>
              {constraintsEvaluation.map((c) => (
                <div
                  key={c.id}
                  className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--selene-text)]">{c.label}</span>
                    <EngineeringStatusBadge status={c.engineeringStatus} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--selene-text-secondary)] tabular-nums">
                    <span>Required: {c.thresholdValue}</span>
                    <span>Observed: {c.observedValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Workspace Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--selene-border)]">
            <button
              type="button"
              onClick={() => onNavigateTab('simulator')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider bg-[var(--selene-accent-solar)] text-white hover:opacity-90 transition-opacity"
            >
              <span>3D Horizon Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('comparison')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors"
            >
              <span>Trade Matrix</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--selene-accent-earth)]" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Synchronized Time-Series Curves */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-[var(--selene-text)]">
              SOLAR ELEVATION PROFILE (h☉ DEG)
            </span>
            <span className="text-xs font-mono font-bold text-[var(--selene-accent-solar)] tabular-nums">
              PEAK +{metrics.peakSolarElevationDeg}°
            </span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="hour" hide />
                <YAxis
                  domain={[-6, 6]}
                  tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--selene-chart-tooltip-bg)',
                    borderColor: 'var(--selene-chart-tooltip-border)',
                    color: 'var(--selene-text)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine y={0} stroke="var(--selene-chart-tick)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="solarEl"
                  stroke="var(--selene-accent-solar)"
                  fill="var(--selene-accent-solar)"
                  fillOpacity={0.2}
                  name="Solar El (°)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-[var(--selene-text)]">
              EARTH DTE ELEVATION (h⊕ DEG)
            </span>
            <span className="text-xs font-mono font-bold text-[var(--selene-accent-earth)] tabular-nums">
              MAX +{metrics.maxEarthElevationDegObserved}°
            </span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="hour" hide />
                <YAxis
                  domain={[-8, 10]}
                  tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--selene-chart-tooltip-bg)',
                    borderColor: 'var(--selene-chart-tooltip-border)',
                    color: 'var(--selene-text)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine y={0} stroke="var(--selene-chart-tick)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="earthEl"
                  stroke="var(--selene-accent-earth)"
                  fill="var(--selene-accent-earth)"
                  fillOpacity={0.2}
                  name="Earth El (°)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-[var(--selene-text)]">
              ELECTRICAL POWER OUTPUT (kW)
            </span>
            <span className="text-xs font-mono font-bold text-[var(--selene-accent-green)] tabular-nums">
              {metrics.spacFractionPct}% SPAC
            </span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="hour" hide />
                <YAxis
                  domain={[0, 12]}
                  tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--selene-chart-tooltip-bg)',
                    borderColor: 'var(--selene-chart-tooltip-border)',
                    color: 'var(--selene-text)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="powerKw"
                  stroke="var(--selene-accent-green)"
                  fill="var(--selene-accent-green)"
                  fillOpacity={0.22}
                  name="Power (kW)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Progressive Disclosure: Configured MCDA Weight Breakdown */}
      <ExpandableTechnicalDrawer
        title="Configured Multi-Criteria Decision Analysis (MCDA) Weight Breakdown"
        subtitle="Inspect explicit criterion weights, raw sub-scores, and uncertainty tolerances used to compute the requirement evaluation."
        badgeText={`SCORE: ${scoreBreakdown.overallFeasibilityScore}/100`}
        toggleLabelClassName="text-[17px] text-[#000000] bg-[#f3ff00]"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {scoreBreakdown.criteria.map((item) => (
            <div
              key={item.criterion}
              className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--selene-accent-earth)] font-bold">WEIGHT {item.weightPct}%</span>
                <span className="text-[var(--selene-text)] font-bold tabular-nums">
                  +{item.weightedContribution} pts
                </span>
              </div>
              <div className="text-xs font-bold text-[var(--selene-text)]">{item.criterion}</div>
              <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">{item.rationale}</p>
            </div>
          ))}
        </div>
      </ExpandableTechnicalDrawer>

      {/* 6. Contextual Scientific Dataset Integration Slot */}
      <DatasetIntegrationSlot
        domain="SPICE_EPHEMERIS_KERNEL"
        activeDatabaseCount={sites.length}
        activeSourceLabel="JPL DE441-MOON_ME + NAIF SPICE moon_pa_de440_200625.bpc"
        onOpenDataHub={() => onNavigateTab('reports')}
      />
    </div>
  );
}
