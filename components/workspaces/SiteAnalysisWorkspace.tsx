'use client';

import React, { useMemo } from 'react';
import HorizonPolarRadar from '../hud/HorizonPolarRadar';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  DecoupledPhysicalState,
  EngineeringConstraints,
  HorizonCoordinates,
  HorizonMaskSample,
  SolarPanelOrientation,
  getLolaHorizonElevationDeg,
} from '@/lib/astrodynamics/coordinateFrames';
import { computeRemainingHorizonCountdowns } from '@/lib/astrodynamics/eventDetection';
import { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import { TimeScaleRepresentation } from '@/lib/astrodynamics/timeScales';
import {
  EditorialMetricCard,
  EngineeringStatusBadge,
  ExpandableTechnicalDrawer,
  SiteStatusBadge,
} from '../editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '../editorial/DatasetIntegrationSlot';
import ScientificRechartsDeck, { ScientificChartTabId } from '../charts/ScientificRechartsDeck';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Compass,
  Sliders,
  Sun,
} from 'lucide-react';

interface SiteAnalysisWorkspaceProps {
  site: LandingSiteRecord;
  simulationEpochUtc: string;
  onChangeEpochUtc: (utcIso: string) => void;
  missionStartDateUtc: string;
  horizonProfile: HorizonMaskSample[];
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  physicalState: DecoupledPhysicalState;
  timeScales: TimeScaleRepresentation;
  constraints: EngineeringConstraints;
  onChangeConstraints: (partial: Partial<EngineeringConstraints>) => void;
  timelineAnalysis: MissionTimelineAnalysis;
  isEduMode?: boolean;
  activeSubsection?: string;
  onSelectSubsection?: (subId: string) => void;
}

const SUBSECTION_META: Record<
  string,
  { title: string; subtitle: string; deckTab: ScientificChartTabId }
> = {
  terrain: {
    title: 'Terrain Analysis & Topocentric Horizon Mask',
    subtitle: '360° LOLA LDEM skyline clearance, slope hazard screening & crater-rim transects.',
    deckTab: 'slope-distribution',
  },
  illumination: {
    title: 'Solar Illumination & Grazing Horizon Physics',
    subtitle: '29.53-day synodic cycle scrubbing, solar disk occlusion & shadow duration.',
    deckTab: 'solar-illumination',
  },
  communications: {
    title: 'Earth Direct-to-Earth (DTE) & Libration Link',
    subtitle: '3-stage Ka-band link margin, sub-Earth libration & elevation floor compliance.',
    deckTab: 'earth-dte',
  },
  power: {
    title: 'Photovoltaic Power Systems & Battery Sizing',
    subtitle: 'Configure array orientation architecture, active area, cell efficiency & eclipse deficits.',
    deckTab: 'solar-power',
  },
  science: {
    title: 'Scientific Assessment, PSR Proximity & Time Scales',
    subtitle: 'Cryogenic cold-trap access, LEND/Diviner context, JD(TT)/JD(TDB) & DEM provenance.',
    deckTab: 'elevation-profile',
  },
};

export default function SiteAnalysisWorkspace({
  site,
  simulationEpochUtc,
  onChangeEpochUtc,
  missionStartDateUtc,
  horizonProfile,
  solarHorizon,
  earthHorizon,
  physicalState,
  timeScales,
  constraints,
  onChangeConstraints,
  timelineAnalysis,
  isEduMode = false,
  activeSubsection = 'terrain',
  onSelectSubsection,
}: SiteAnalysisWorkspaceProps) {
  const startMs = new Date(missionStartDateUtc).getTime();
  const currentMs = new Date(simulationEpochUtc).getTime();

  const synodicOffsetHours = Math.max(
    0,
    Math.min(708, Math.round((currentMs - startMs) / 3600000))
  );

  const handleScrubHours = (hoursFromStart: number) => {
    const nextMs = startMs + hoursFromStart * 3600000;
    onChangeEpochUtc(new Date(nextMs).toISOString());
  };

  const solarTerrainAtAz = useMemo(
    () =>
      getLolaHorizonElevationDeg(
        site.id,
        solarHorizon.azimuthDeg,
        site.latitude,
        site.longitude,
        site.elevation_km
      ),
    [site, solarHorizon.azimuthDeg]
  );

  const earthTerrainAtAz = useMemo(
    () =>
      getLolaHorizonElevationDeg(
        site.id,
        earthHorizon.azimuthDeg,
        site.latitude,
        site.longitude,
        site.elevation_km
      ),
    [site, earthHorizon.azimuthDeg]
  );

  const countdowns = useMemo(
    () =>
      computeRemainingHorizonCountdowns(
        timelineAnalysis.events,
        simulationEpochUtc,
        physicalState.solarTerrainVis,
        physicalState.dteLinkFeasible
      ),
    [
      timelineAnalysis.events,
      simulationEpochUtc,
      physicalState.solarTerrainVis,
      physicalState.dteLinkFeasible,
    ]
  );

  const timeSeriesChartData = useMemo(() => {
    const stride = Math.max(1, Math.floor(timelineAnalysis.points.length / 90));
    return timelineAnalysis.points
      .filter((_, idx) => idx % stride === 0)
      .map((pt) => ({
        hour: `T+${pt.epochHour}h`,
        solarEl: pt.solarElevationDeg,
        earthEl: pt.earthElevationDeg,
        powerKw: pt.effectivePowerKw,
        irradianceWm2: pt.solarIrradianceWm2,
      }));
  }, [timelineAnalysis.points]);

  const panelAreaM2 = constraints.solarArrayAreaM2 ?? 18.0;
  const pvEfficiencyPct = Math.round((constraints.pvEfficiency ?? 0.32) * 100);
  const orientation: SolarPanelOrientation =
    constraints.solarPanelOrientation ?? 'VERTICAL_MAST';

  const solarConstraint = timelineAnalysis.constraintsEvaluation.find(
    (c) => c.id === 'solar-elevation-floor'
  );
  const earthConstraint = timelineAnalysis.constraintsEvaluation.find(
    (c) => c.id === 'dte-earth-elevation'
  );
  const eclipseConstraint = timelineAnalysis.constraintsEvaluation.find(
    (c) => c.id === 'cryogenic-eclipse-survival'
  );
  const slopeConstraint = timelineAnalysis.constraintsEvaluation.find(
    (c) => c.id === 'terrain-slope-safety'
  );

  const shortSunsetHeadline =
    countdowns.sunsetCountdownLabel.length <= 14
      ? countdowns.sunsetCountdownLabel
      : countdowns.nextSunsetUtc
        ? `T+${Math.max(0, Math.round((new Date(countdowns.nextSunsetUtc).getTime() - currentMs) / 3600000))}h Set`
        : countdowns.nextSunriseUtc
          ? `T+${Math.max(0, Math.round((new Date(countdowns.nextSunriseUtc).getTime() - currentMs) / 3600000))}h Rise`
          : 'Continuous';

  const shortEarthsetHeadline =
    countdowns.earthsetCountdownLabel.length <= 14
      ? countdowns.earthsetCountdownLabel
      : countdowns.nextEarthsetUtc
        ? `T+${Math.max(0, Math.round((new Date(countdowns.nextEarthsetUtc).getTime() - currentMs) / 3600000))}h Set`
        : countdowns.nextEarthriseUtc
          ? `T+${Math.max(0, Math.round((new Date(countdowns.nextEarthriseUtc).getTime() - currentMs) / 3600000))}h Rise`
          : 'Continuous';

  const normalizedSub = SUBSECTION_META[activeSubsection] ? activeSubsection : 'terrain';
  const activeMeta = SUBSECTION_META[normalizedSub]!;

  // Reusable domain blocks composed cleanly per subsection
  const polarRadarBlock = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4">
      <HorizonPolarRadar
        horizonProfile={horizonProfile}
        solarHorizon={solarHorizon}
        earthHorizon={earthHorizon}
        minSolarElevationDeg={constraints.minSolarElevationDeg}
        minEarthElevationDeg={constraints.minEarthElevationDeg}
      />
    </div>
  );

  const unwrappedHorizonBlock = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--selene-text)]">
            360° Unwrapped LOLA Topographic Horizon Mask h_terrain(&alpha;)
          </h3>
          <p className="text-xs font-mono text-[var(--selene-text-muted)] mt-0.5">
            Local East-North-Up (ENU) Horizon Profile vs. Instantaneous Sun &amp; Earth Vectors
          </p>
        </div>
        <Compass className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={horizonProfile}>
            <XAxis
              dataKey="azimuthDeg"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="°"
            />
            <YAxis
              domain={[-4, 8]}
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="°"
              width={34}
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
              dataKey="terrainElevationDeg"
              stroke="var(--selene-accent-solar)"
              fill="var(--selene-accent-solar)"
              fillOpacity={0.28}
              name="LOLA Horizon Mask (°)"
            />
            <ReferenceDot
              x={Math.round(solarHorizon.azimuthDeg / 5) * 5}
              y={solarHorizon.elevationDeg}
              r={6}
              fill="#F59E0B"
              stroke="var(--selene-text)"
            />
            <ReferenceDot
              x={Math.round(earthHorizon.azimuthDeg / 5) * 5}
              y={earthHorizon.elevationDeg}
              r={6}
              fill="#00E5FF"
              stroke="var(--selene-text)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const timeSeriesBlock = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--selene-text)]">
            Solar Elevation, Earth Elevation &amp; Electrical Power Over Mission Window
          </h3>
          <p className="text-xs font-mono text-[var(--selene-text-muted)] mt-0.5">
            {panelAreaM2} m² {orientation.replace(/_/g, ' ')} array @ {pvEfficiencyPct}% efficiency (
            {timelineAnalysis.metrics.totalDurationHours}h span)
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[var(--selene-accent-green)] tabular-nums">
          AVG {timelineAnalysis.metrics.avgElectricalPowerKw} kW
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeriesChartData}>
            <XAxis
              dataKey="hour"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
            />
            <YAxis
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              width={34}
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
              stroke="var(--selene-accent-amber)"
              fill="var(--selene-accent-amber)"
              fillOpacity={0.18}
              name="Solar Elevation (°)"
            />
            <Area
              type="monotone"
              dataKey="earthEl"
              stroke="var(--selene-accent-earth)"
              fill="var(--selene-accent-earth)"
              fillOpacity={0.12}
              name="Earth Elevation (°)"
            />
            <Area
              type="monotone"
              dataKey="powerKw"
              stroke="var(--selene-accent-green)"
              fill="var(--selene-accent-green)"
              fillOpacity={0.22}
              name="Electrical Power (kW)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const solarDiagnosticCard = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 text-[var(--selene-accent-solar)] font-bold">
          <Sun className="w-4 h-4" />
          <span>SOLAR GRAZING DIAGNOSTIC</span>
        </span>
        <span
          className={
            physicalState.solarTerrainVis
              ? 'text-[var(--selene-accent-green)] font-bold'
              : 'text-[var(--selene-accent-red)] font-bold'
          }
        >
          {physicalState.solarTerrainVis ? 'LINE OF SIGHT CLEAR' : 'RIDGE OCCLUDED'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">SUN AZ / EL</div>
          <div className="text-[var(--selene-text)] font-bold mt-0.5">
            {solarHorizon.azimuthDeg.toFixed(1)}° / {solarHorizon.elevationDeg.toFixed(2)}°
          </div>
        </div>
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">LOLA MASK</div>
          <div className="text-[var(--selene-accent-solar)] font-bold mt-0.5">
            {solarTerrainAtAz >= 0 ? '+' : ''}
            {solarTerrainAtAz.toFixed(2)}°
          </div>
        </div>
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">NEXT EVENT</div>
          <div className="text-[var(--selene-text)] font-bold mt-0.5 truncate">
            {shortSunsetHeadline}
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-[var(--selene-text-secondary)] leading-relaxed">
        {physicalState.solarTerrainVis
          ? `Solar center stands ${physicalState.solarHorizonMarginDeg.toFixed(2)}° above the local LOLA horizon (${(physicalState.solarDiskFraction * 100).toFixed(0)}% solar disk unoccluded, G = ${physicalState.solarIrradianceWm2} W/m²).`
          : `Solar disk is occluded by a ${solarTerrainAtAz.toFixed(2)}° topographic ridge along azimuth ${solarHorizon.azimuthDeg.toFixed(1)}°. Lander operates on battery reserve.`}
      </p>
    </div>
  );

  const earthDiagnosticCard = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[var(--selene-accent-earth)] font-bold">EARTH DTE &amp; LIBRATION STATE</span>
        <span
          className={
            physicalState.dteLinkFeasible
              ? 'text-[var(--selene-accent-green)] font-bold'
              : 'text-[var(--selene-accent-red)] font-bold'
          }
        >
          {physicalState.dteLinkFeasible ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>LINK FEASIBLE</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>LINK VIOLATION</span>
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">EARTH AZ / EL</div>
          <div className="text-[var(--selene-accent-earth)] font-bold mt-0.5">
            {earthHorizon.azimuthDeg.toFixed(1)}° / {earthHorizon.elevationDeg.toFixed(2)}°
          </div>
        </div>
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">MASK / MARGIN</div>
          <div className="text-[var(--selene-accent-green)] font-bold mt-0.5">
            {earthTerrainAtAz.toFixed(1)}° ({physicalState.dteLinkMarginDb.toFixed(1)} dB)
          </div>
        </div>
        <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
          <div className="text-[10.5px] text-[var(--selene-text-muted)]">NEXT EVENT</div>
          <div className="text-[var(--selene-text)] font-bold mt-0.5 truncate">
            {shortEarthsetHeadline}
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-[var(--selene-text-secondary)] leading-relaxed">
        Earth optical and physical libration places the sub-Earth vector at azimuth{' '}
        {earthHorizon.azimuthDeg.toFixed(1)}°, range {earthHorizon.rangeKm.toFixed(0)} km.
        Ka-band link margin is {physicalState.dteLinkMarginDb.toFixed(2)} dB (threshold floor: 3.00 dB).
      </p>
    </div>
  );

  const pvConfiguratorBlock = (
    <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4">
      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--selene-border)]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--selene-accent-solar)]" />
          <h3 className="text-sm font-bold text-[var(--selene-text)]">
            Solar Array &amp; DTE Link Hardware Parameters
          </h3>
        </div>
        <BatteryCharging className="w-4 h-4 text-[var(--selene-accent-green)]" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-mono text-[var(--selene-text-secondary)]">
          SOLAR ARRAY ORIENTATION ARCHITECTURE
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'VERTICAL_MAST', label: 'Vertical Mast' },
              { id: 'HORIZONTAL_DECK', label: 'Horizontal Deck' },
              { id: 'DUAL_AXIS_TRACKING', label: '2-Axis Gimbal' },
            ] as { id: SolarPanelOrientation; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeConstraints({ solarPanelOrientation: opt.id })}
              className={`px-2.5 py-2 text-xs font-mono border transition-colors ${
                orientation === opt.id
                  ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-bold'
                  : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <label htmlFor="sa-area-slider" className="text-[var(--selene-text-secondary)]">
            DEPLOYABLE SOLAR PANEL AREA (m²)
          </label>
          <span className="text-[var(--selene-accent-amber)] font-bold tabular-nums">
            {panelAreaM2.toFixed(0)} m²
          </span>
        </div>
        <input
          id="sa-area-slider"
          type="range"
          min={4}
          max={60}
          step={2}
          value={panelAreaM2}
          onChange={(e) => onChangeConstraints({ solarArrayAreaM2: Number(e.target.value) })}
          className="w-full accent-[var(--selene-accent-amber)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <label htmlFor="sa-eff-slider" className="text-[var(--selene-text-secondary)]">
            PHOTOVOLTAIC CELL EFFICIENCY (&eta;)
          </label>
          <span className="text-[var(--selene-accent-green)] font-bold tabular-nums">{pvEfficiencyPct}%</span>
        </div>
        <input
          id="sa-eff-slider"
          type="range"
          min={18}
          max={42}
          step={1}
          value={pvEfficiencyPct}
          onChange={(e) =>
            onChangeConstraints({ pvEfficiency: Number(e.target.value) / 100 })
          }
          className="w-full accent-[var(--selene-accent-green)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
        />
      </div>

      <div className="space-y-1.5 pt-2.5 border-t border-[var(--selene-border)]">
        <div className="flex items-center justify-between text-xs font-mono">
          <label htmlFor="sa-earth-el-slider" className="text-[var(--selene-text-secondary)]">
            MIN EARTH ELEVATION REQUIREMENT (DTE FLOOR)
          </label>
          <span className="text-[var(--selene-accent-earth)] font-bold tabular-nums">
            {constraints.minEarthElevationDeg.toFixed(1)}°
          </span>
        </div>
        <input
          id="sa-earth-el-slider"
          type="range"
          min={0}
          max={6}
          step={0.2}
          value={constraints.minEarthElevationDeg}
          onChange={(e) =>
            onChangeConstraints({ minEarthElevationDeg: Number(e.target.value) })
          }
          className="w-full accent-[var(--selene-accent-earth)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5 min-w-0">
      {/* 1. Compact Subsection Header & Switcher Strip (No Cloned Hero Header) */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-[var(--selene-accent-earth)]">{site.name}</span>
            <SiteStatusBadge site={site} />
            <EngineeringStatusBadge status={timelineAnalysis.scoreBreakdown.engineeringAssessment} />
            <span className="text-[11px] text-[var(--selene-text-muted)] tabular-nums">
              {isEduMode
                ? 'Explorer Mode'
                : `JD(TT) ${timeScales.jdTt.toFixed(4)} · JD(TDB) ${timeScales.jdTdb.toFixed(4)}`}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[var(--selene-text)] tracking-tight">
            {activeMeta.title}
          </h1>
          <p className="text-xs text-[var(--selene-text-secondary)]">{activeMeta.subtitle}</p>
        </div>

        {onSelectSubsection && (
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] shrink-0">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'terrain', label: 'Terrain' },
              { id: 'illumination', label: 'Illumination' },
              { id: 'communications', label: 'Comms' },
              { id: 'power', label: 'Power' },
              { id: 'science', label: 'Science' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSubsection(tab.id)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                  normalizedSub === tab.id
                    ? 'bg-[var(--selene-accent-yellow)] text-[#111111] font-bold'
                    : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Synodic Lunar Cycle Time Scrubber Bar */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--selene-accent-solar)]" />
            <h2 className="text-xs sm:text-sm font-bold text-[var(--selene-text)]">
              Synodic Cycle Time Scrubber (29.53-Day Sweep · 708.7h)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-[var(--selene-text-secondary)]">
              OFFSET: <strong className="text-[var(--selene-accent-earth)]">T+{synodicOffsetHours}h</strong> (Day{' '}
              {(synodicOffsetHours / 24).toFixed(1)})
            </span>
            <span className="text-[var(--selene-accent-solar)] font-bold">
              {simulationEpochUtc.replace('T', ' ').slice(0, 19)}Z
            </span>
          </div>
        </div>

        <input
          type="range"
          aria-label="Synodic Cycle Time Scrubber Hours"
          min={0}
          max={708}
          step={2}
          value={synodicOffsetHours}
          onChange={(e) => handleScrubHours(Number(e.target.value))}
          className="w-full accent-[var(--selene-accent-solar)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[var(--selene-text-muted)]">
          <div className="flex flex-wrap items-center gap-1">
            {[0, 24, 72, 168, 336, 504, 708].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleScrubHours(h)}
                className={`px-2 py-0.5 border transition-colors ${
                  Math.abs(synodicOffsetHours - h) < 10
                    ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-bold'
                    : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                }`}
              >
                T+{h}h
              </button>
            ))}
          </div>
          <span className="tabular-nums text-[11px]">
            Sun {solarHorizon.elevationDeg.toFixed(2)}° · Earth {earthHorizon.elevationDeg.toFixed(2)}° · Array{' '}
            {physicalState.effectiveElectricalPowerKw.toFixed(2)} kW
          </span>
        </div>
      </div>

      {/* 3. Subsection-Specific Focused Analytical Stage */}
      {normalizedSub === 'terrain' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5">{polarRadarBlock}</div>
          <div className="lg:col-span-7 space-y-5">
            {unwrappedHorizonBlock}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditorialMetricCard
                label="Site Mean Slope & Elevation"
                value={`${site.slope_deg.toFixed(1)}°`}
                unit={`${site.elevation_km >= 0 ? '+' : ''}${site.elevation_km.toFixed(2)} km LDEM`}
                status={slopeConstraint?.engineeringStatus}
                accentColor="yellow"
                meaning={`3x3 terrain slope evaluated against lander tip-over safety floor (≤${constraints.maxSlopeDeg ?? 10}°).`}
                provenance={site.latitude <= -60 ? 'LOLA LDEM_80S v1.4 (5 m/px)' : 'LOLA LDEM_1024 (118 m/px)'}
              />
              <EditorialMetricCard
                label="PSR Cold-Trap Proximity"
                value={`${site.psr_proximity_km.toFixed(1)} km`}
                unit="from PSR margin"
                accentColor="earth"
                meaning={site.crater_name}
                provenance="LRO Diviner + Mazarico LPSR Atlas"
              />
            </div>
          </div>
        </div>
      )}

      {normalizedSub === 'illumination' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-5">
            {solarDiagnosticCard}
            <EditorialMetricCard
              label="Daylight vs. Shadow Balance"
              value={`${timelineAnalysis.metrics.totalSunlitHours}h`}
              unit={`Sun / ${Number((timelineAnalysis.metrics.totalDurationHours - timelineAnalysis.metrics.totalSunlitHours).toFixed(1))}h Dark`}
              status={eclipseConstraint?.engineeringStatus}
              accentColor="solar"
              meaning={`Longest continuous daylight: ${timelineAnalysis.metrics.longestContinuousSunlightHours}h; max continuous shadow: ${timelineAnalysis.metrics.longestContinuousDarknessHours}h.`}
              whyItMatters="Cryogenic eclipse survival batteries are sized to the longest continuous darkness interval."
              provenance="DE441-MOON_ME + LOLA 360° Mask"
            />
          </div>
          <div className="lg:col-span-7 space-y-5">
            {timeSeriesBlock}
            {unwrappedHorizonBlock}
          </div>
        </div>
      )}

      {normalizedSub === 'communications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-5">
            {earthDiagnosticCard}
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <label htmlFor="sa-earth-el-slider-comms" className="text-[var(--selene-text-secondary)]">
                  MIN EARTH ELEVATION REQUIREMENT (DTE FLOOR)
                </label>
                <span className="text-[var(--selene-accent-earth)] font-bold tabular-nums">
                  {constraints.minEarthElevationDeg.toFixed(1)}°
                </span>
              </div>
              <input
                id="sa-earth-el-slider-comms"
                type="range"
                min={0}
                max={6}
                step={0.2}
                value={constraints.minEarthElevationDeg}
                onChange={(e) =>
                  onChangeConstraints({ minEarthElevationDeg: Number(e.target.value) })
                }
                className="w-full accent-[var(--selene-accent-earth)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
              />
              <EditorialMetricCard
                label="Earth DTE Availability"
                value={`${timelineAnalysis.metrics.commsFractionPct}%`}
                unit={`(${physicalState.dteLinkMarginDb.toFixed(1)} dB now)`}
                status={earthConstraint?.engineeringStatus}
                accentColor="earth"
                meaning={`${countdowns.earthsetCountdownLabel}. Continuous DTE max: ${timelineAnalysis.metrics.longestContinuousCommsHours}h.`}
                provenance="NAIF SPICE moon_pa_de440 + Ka-Band"
              />
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            {polarRadarBlock}
            {timeSeriesBlock}
          </div>
        </div>
      )}

      {normalizedSub === 'power' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-5">
            {pvConfiguratorBlock}
            <EditorialMetricCard
              label="Instantaneous & Mean Array Power"
              value={`${physicalState.effectiveElectricalPowerKw.toFixed(2)} kW`}
              unit={`(${timelineAnalysis.metrics.avgElectricalPowerKw} kW avg)`}
              status={solarConstraint?.engineeringStatus}
              accentColor="spac"
              meaning={`${physicalState.solarIrradianceWm2} W/m² flux on ${panelAreaM2} m² ${orientation.replace(/_/g, ' ')} @ ${pvEfficiencyPct}% eff.`}
              provenance="Cosine Incidence + Fractional Solar Disk"
            />
          </div>
          <div className="lg:col-span-7 space-y-5">
            {timeSeriesBlock}
            {solarDiagnosticCard}
          </div>
        </div>
      )}

      {normalizedSub === 'science' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <EditorialMetricCard
              label="PSR Volatile Access"
              value={`${site.psr_proximity_km.toFixed(1)} km`}
              unit="to nearest cold trap"
              accentColor="earth"
              meaning={site.scientific_value}
              provenance="LEND / Diviner / LCROSS Regional Context"
            />
            <EditorialMetricCard
              label="Solar Grazing & Illumination"
              value={`${timelineAnalysis.metrics.sunlitFractionPct}%`}
              unit={`${timelineAnalysis.metrics.longestContinuousDarknessHours}h max eclipse`}
              status={eclipseConstraint?.engineeringStatus}
              accentColor="solar"
              meaning={`${countdowns.sunsetCountdownLabel}. Peak solar elevation +${timelineAnalysis.metrics.peakSolarElevationDeg}°.`}
              provenance="DE441-MOON_ME + LOLA Mask"
            />
            <EditorialMetricCard
              label="SPAC Co-Visibility"
              value={`${timelineAnalysis.metrics.spacFractionPct}%`}
              unit={`${timelineAnalysis.metrics.longestContinuousSpacHours}h max window`}
              accentColor="spac"
              meaning={timelineAnalysis.scoreBreakdown.assessmentRationale}
              provenance="Brent-Dekker Horizon Root-Finder"
            />
          </div>
          {solarDiagnosticCard}
        </div>
      )}

      {/* 4. Interactive Recharts Scientific Visualization Deck (Synced to Active Subsection) */}
      <ScientificRechartsDeck
        key={normalizedSub}
        siteLatDeg={site.latitude}
        siteLonDeg={site.longitude}
        timelineAnalysis={timelineAnalysis}
        defaultTab={activeMeta.deckTab}
      />

      {/* 5. Progressive Disclosure: Frame Transformations & Time Scales */}
      <ExpandableTechnicalDrawer
        title="Astronomical Time Scales & Reference Frame Transformations (IAU MOON_ME / ENU)"
        subtitle="Inspect exact Julian Ephemeris Dates (UTC, TT, TDB) and topocentric horizon elevation margins."
        badgeText={`JD(TDB) ${timeScales.jdTdb.toFixed(4)}`}
        defaultOpen={normalizedSub === 'science'}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">UTC EPOCH</div>
            <div className="font-bold text-[var(--selene-text)] mt-1">{timeScales.utcIso}</div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">JULIAN DATE JD(UTC)</div>
            <div className="font-bold text-[var(--selene-accent-earth)] mt-1 tabular-nums">
              {timeScales.jdUtc.toFixed(6)}
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">TERRESTRIAL TIME JD(TT)</div>
            <div className="font-bold text-[var(--selene-accent-green)] mt-1 tabular-nums">
              {timeScales.jdTt.toFixed(6)} (&Delta;T={timeScales.deltaTtSeconds}s)
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">BARYCENTRIC JD(TDB)</div>
            <div className="font-bold text-[var(--selene-accent-solar)] mt-1 tabular-nums">
              {timeScales.jdTdb.toFixed(6)}
            </div>
          </div>
        </div>
      </ExpandableTechnicalDrawer>

      {/* 6. Contextual Dataset Integration Slot */}
      <DatasetIntegrationSlot
        domain="TERRAIN_ELEVATION_DEM"
        activeSourceLabel={
          site.latitude <= -60
            ? 'LRO LOLA LDEM_80S v1.4 GDS (5 m/px Polar Stereographic)'
            : 'LRO LOLA LDEM_1024 v1.8 GDR (118 m/px Global Cylindrical)'
        }
      />
    </div>
  );
}
