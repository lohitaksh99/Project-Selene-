'use client';

import React from 'react';
import type { LandingSiteRecord } from '@/server/db/database';
import { DecoupledPhysicalState, HorizonCoordinates } from '@/lib/astrodynamics/coordinateFrames';
import { TimelineMetrics, ExplainableScoreBreakdown } from '@/lib/astrodynamics/missionAnalyzer';

interface MissionStatusCardProps {
  site: LandingSiteRecord;
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  physicalState: DecoupledPhysicalState;
  metrics: TimelineMetrics;
  scoreBreakdown: ExplainableScoreBreakdown;
  simulationEpochUtc: string;
}

export default function MissionStatusCard({
  site,
  solarHorizon,
  earthHorizon,
  physicalState,
  metrics,
  scoreBreakdown,
  simulationEpochUtc,
}: MissionStatusCardProps) {
  const tierColor =
    scoreBreakdown.feasibilityTier === 'TIER I — GO / OPTIMAL'
      ? 'text-[var(--selene-accent-green)]'
      : scoreBreakdown.feasibilityTier === 'TIER II — CONDITIONAL'
        ? 'text-[var(--selene-accent-amber)]'
        : 'text-[var(--selene-accent-red)]';

  return (
    <section
      aria-label="Mission Telemetry Header"
      className="relative bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 sm:p-5"
    >
      {/* Top Row: Site Identity, Coordinates & NASA Feasibility Tier */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--selene-border)]">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--selene-text-muted)] tabular-nums">
            <span className="text-[var(--selene-accent-solar)] font-semibold">{site.designation}</span>
            <span aria-hidden="true">·</span>
            <span>
              {site.latitude < 0 ? `${Math.abs(site.latitude).toFixed(2)}°S` : `${site.latitude.toFixed(2)}°N`},{' '}
              {site.longitude.toFixed(2)}°E
            </span>
            <span aria-hidden="true">·</span>
            <span>LOLA DATUM {site.elevation_km >= 0 ? `+${site.elevation_km.toFixed(2)}` : site.elevation_km.toFixed(2)} km</span>
            <span aria-hidden="true">·</span>
            <span>{site.crater_name}</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--selene-text)] tracking-tight">
            {site.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:gap-6 sm:text-right">
          <div>
            <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
              EVALUATION EPOCH (UTC)
            </div>
            <div className="text-xs font-mono font-semibold text-[var(--selene-accent-earth)] tabular-nums">
              {simulationEpochUtc.replace('T', ' ').slice(0, 19)}Z
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
              MISSION FEASIBILITY TIER
            </div>
            <div className={`text-sm font-mono font-bold tabular-nums ${tierColor}`}>
              {scoreBreakdown.feasibilityTier} ({scoreBreakdown.overallFeasibilityScore}/100)
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: 6 Precision Telemetry Readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-3">
        {/* 1. Solar Elevation Angle */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            SOLAR ELEVATION (h☉)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-bold text-[var(--selene-text)] tabular-nums">
              {solarHorizon.elevationDeg >= 0 ? '+' : ''}
              {solarHorizon.elevationDeg.toFixed(2)}°
            </span>
            <span className="text-[11px] font-mono text-[var(--selene-text-muted)] tabular-nums">
              AZ {solarHorizon.azimuthDeg.toFixed(1)}°
            </span>
          </div>
          <div
            className={`mt-1 text-[11px] font-mono tabular-nums ${
              physicalState.solarTerrainVis ? 'text-[var(--selene-accent-green)]' : 'text-[var(--selene-accent-red)]'
            }`}
          >
            {physicalState.solarTerrainVis
              ? `SUNLIT (+${physicalState.solarHorizonMarginDeg.toFixed(2)}° vs LOLA)`
              : `OCCLUDED (${physicalState.solarHorizonMarginDeg.toFixed(2)}° vs LOLA)`}
          </div>
        </div>

        {/* 2. Earth Elevation Angle */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            EARTH ELEVATION (h⊕)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-bold text-[var(--selene-accent-earth)] tabular-nums">
              {earthHorizon.elevationDeg >= 0 ? '+' : ''}
              {earthHorizon.elevationDeg.toFixed(2)}°
            </span>
            <span className="text-[11px] font-mono text-[var(--selene-text-muted)] tabular-nums">
              AZ {earthHorizon.azimuthDeg.toFixed(1)}°
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--selene-text-secondary)] tabular-nums">
            RANGE: {Math.round(earthHorizon.rangeKm).toLocaleString()} km
          </div>
        </div>

        {/* 3. Sunlight Duration */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            SUNLIGHT DURATION
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-bold text-[var(--selene-text)] tabular-nums">
              {metrics.totalSunlitHours}
            </span>
            <span className="text-xs font-mono text-[var(--selene-text-muted)]">
              / {metrics.totalDurationHours} h ({metrics.sunlitFractionPct}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--selene-accent-solar)] tabular-nums">
            MAX CONT: {metrics.longestContinuousSunlightHours} h
          </div>
        </div>

        {/* 4. Direct-to-Earth (DTE) Link State */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            EARTH DTE LINK STATE
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-mono font-bold tabular-nums ${
                physicalState.dteLinkFeasible ? 'text-[var(--selene-accent-green)]' : 'text-[var(--selene-accent-red)]'
              }`}
            >
              {physicalState.dteLinkFeasible ? 'GO / ACTIVE' : 'NO-GO / MASK'}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--selene-text-secondary)] tabular-nums">
            MARGIN: {physicalState.dteLinkMarginDb.toFixed(2)} dB (Ka-Band)
          </div>
        </div>

        {/* 5. Effective Electrical Power */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            ELECTRICAL POWER P(t)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-bold text-[var(--selene-text)] tabular-nums">
              {physicalState.effectiveElectricalPowerKw.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-[var(--selene-text-muted)]">kW</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--selene-text-secondary)] tabular-nums">
            G☉: {physicalState.solarIrradianceWm2.toFixed(0)} W/m² (Disk {(physicalState.solarDiskFraction * 100).toFixed(0)}%)
          </div>
        </div>

        {/* 6. SPAC Operational State */}
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
          <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
            SPAC CO-VISIBILITY
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-mono font-bold tabular-nums ${
                physicalState.isSpac ? 'text-[var(--selene-accent-green)]' : 'text-[var(--selene-accent-amber)]'
              }`}
            >
              {physicalState.isSpac ? 'SPAC ACTIVE' : 'STANDBY'}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--selene-text-secondary)] tabular-nums">
            CUMULATIVE: {metrics.cumulativeSpacHours} h ({metrics.spacFractionPct}%)
          </div>
        </div>
      </div>
    </section>
  );
}
