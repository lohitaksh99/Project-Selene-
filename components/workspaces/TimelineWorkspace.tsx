'use client';

import React, { useMemo, useState } from 'react';
import type { LandingSiteRecord } from '@/server/db/database';
import { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import {
  MissionPlaybackSpeed,
  useSeleneStore,
} from '@/lib/store/useSeleneStore';
import {
  EngineeringStatusBadge,
  ExpandableTechnicalDrawer,
  SiteStatusBadge,
} from '../editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '../editorial/DatasetIntegrationSlot';
import ScientificRechartsDeck from '../charts/ScientificRechartsDeck';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FastForward,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface TimelineWorkspaceProps {
  site: LandingSiteRecord;
  timelineAnalysis: MissionTimelineAnalysis;
  missionStartDateUtc: string;
  onChangeStartDateUtc: (iso: string) => void;
  missionDurationDays: number;
  onChangeDurationDays: (days: number) => void;
  samplingStepHours?: number | 'AUTO';
  onChangeSamplingStepHours?: (step: number | 'AUTO') => void;
  onSelectEpochUtc: (iso: string) => void;
  onOpenDataHub?: () => void;
}

const DURATION_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: '24h (1d)' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 29.53, label: '~29.53d (1 Synodic)' },
];

const STEP_OPTIONS: { value: number | 'AUTO'; label: string }[] = [
  { value: 'AUTO', label: 'Adaptive Auto' },
  { value: 0.25, label: '0.25h (15m)' },
  { value: 0.5, label: '0.5h (30m)' },
  { value: 1, label: '1.0h' },
  { value: 2, label: '2.0h' },
  { value: 6, label: '6.0h' },
];

const SPEED_OPTIONS: MissionPlaybackSpeed[] = [1, 10, 60, 360];

export default function TimelineWorkspace({
  site,
  timelineAnalysis,
  missionStartDateUtc,
  onChangeStartDateUtc,
  missionDurationDays,
  onChangeDurationDays,
  samplingStepHours = 'AUTO',
  onChangeSamplingStepHours,
  onSelectEpochUtc,
  onOpenDataHub,
}: TimelineWorkspaceProps) {
  const { points, events, metrics, scoreBreakdown } = timelineAnalysis;
  const {
    simulationEpochET,
    simulationStartET,
    simulationEndET,
    simulationEpochUtc,
    setSimulationEpochET,
    isPlayingMissionClock,
    setIsPlayingMissionClock,
    missionPlaybackSpeed,
    setMissionPlaybackSpeed,
  } = useSeleneStore();

  const [zoomSpanPct, setZoomSpanPct] = useState<number>(100);
  const [customDaysInput, setCustomDaysInput] = useState<string>(String(missionDurationDays));

  // Pagination state for Adaptive Technical Telemetry Table
  const [tablePage, setTablePage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const visibleCount = Math.max(8, Math.floor((points.length * zoomSpanPct) / 100));
  const visiblePoints = useMemo(
    () => points.slice(0, visibleCount),
    [points, visibleCount]
  );

  // Downsample Gantt bars if visiblePoints exceeds 180 so layout remains crisp and fast
  const ganttStride = Math.max(1, Math.ceil(visiblePoints.length / 180));
  const ganttPoints = useMemo(
    () =>
      visiblePoints
        .map((pt, originalIdx) => ({ pt, originalIdx }))
        .filter((_, idx) => idx % ganttStride === 0),
    [visiblePoints, ganttStride]
  );

  // Derive cursor position purely from authoritative simulationEpochET (never setState during render)
  const safeCursor = useMemo(() => {
    if (visiblePoints.length === 0) return 0;
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < visiblePoints.length; i++) {
      const diff = Math.abs(visiblePoints[i]!.etSecondsJ2000 - simulationEpochET);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [visiblePoints, simulationEpochET]);

  const inspectedPoint = visiblePoints[safeCursor] ?? points[0]!;

  const visibleStartET =
    zoomSpanPct < 100 ? (visiblePoints[0]?.etSecondsJ2000 ?? simulationStartET) : simulationStartET;
  const visibleEndET =
    zoomSpanPct < 100
      ? (visiblePoints[visiblePoints.length - 1]?.etSecondsJ2000 ?? simulationEndET)
      : simulationEndET;
  const safeSliderMaxET = Math.max(visibleStartET + 3600, visibleEndET);
  const clampedSliderET = Math.max(visibleStartET, Math.min(safeSliderMaxET, simulationEpochET));

  const elapsedHours = Number(
    (Math.max(0, simulationEpochET - simulationStartET) / 3600.0).toFixed(2)
  );

  const handleStep = (deltaSteps: number) => {
    setIsPlayingMissionClock(false);
    const maxIdx = Math.max(0, visiblePoints.length - 1);
    const nextIdx = Math.max(0, Math.min(maxIdx, safeCursor + deltaSteps));
    const pt = visiblePoints[nextIdx];
    if (pt) {
      setSimulationEpochET(pt.etSecondsJ2000);
    }
  };

  const handleShiftLunarDay = (deltaDays: number) => {
    setIsPlayingMissionClock(false);
    const curStartMs = new Date(missionStartDateUtc).getTime();
    const nextStartIso = new Date(curStartMs + deltaDays * 86400000).toISOString();
    onChangeStartDateUtc(nextStartIso);
    onSelectEpochUtc(nextStartIso);
  };

  const handleCustomDurationApply = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(customDaysInput);
    if (Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 90) {
      onChangeDurationDays(Number(parsed.toFixed(2)));
    }
  };

  const totalPages = Math.max(1, Math.ceil(points.length / pageSize));
  const safeTablePage = Math.min(tablePage, totalPages);
  const paginatedPoints = points.slice(
    (safeTablePage - 1) * pageSize,
    safeTablePage * pageSize
  );

  return (
    <div className="space-y-5 min-w-0">
      {/* 1. Compact Mission Timeline Briefing Strip */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-[var(--selene-accent-earth)]">{site.designation}</span>
            <SiteStatusBadge site={site} />
            <span className="text-[var(--selene-text-muted)] tabular-nums">
              {points.length} samples @ {timelineAnalysis.stepHours}h (
              {timelineAnalysis.samplingMode === 'ADAPTIVE_AUTO' ? 'Adaptive Auto' : 'Manual'})
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[var(--selene-text)] tracking-tight">
            Mission Illumination &amp; DTE Timeline — {site.name}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <EngineeringStatusBadge status={scoreBreakdown.engineeringAssessment} size="md" />
        </div>
      </section>

      {/* 2. Configurable Duration, Sampling Resolution & Epoch Controls */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 lg:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Start Date & Lunar Phase Stepper */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono min-w-0">
            <Calendar className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
            <label htmlFor="timeline-start-date" className="text-[var(--selene-text-secondary)] font-semibold">
              START UTC:
            </label>
            <input
              id="timeline-start-date"
              type="date"
              value={missionStartDateUtc.slice(0, 10)}
              onChange={(e) =>
                e.target.value && onChangeStartDateUtc(`${e.target.value}T00:00:00Z`)
              }
              className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] max-w-full"
            />
            <button
              type="button"
              onClick={() => handleShiftLunarDay(-1)}
              className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:border-[var(--selene-accent-earth)]"
            >
              -24h
            </button>
            <button
              type="button"
              onClick={() => handleShiftLunarDay(1)}
              className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:border-[var(--selene-accent-earth)]"
            >
              +24h
            </button>
            <button
              type="button"
              onClick={() => handleShiftLunarDay(14)}
              className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-solar)] hover:border-[var(--selene-accent-solar)] font-semibold"
            >
              +14d Opposite Phase
            </button>
          </div>

          {/* Preset Duration Buttons + Custom Duration Input */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono min-w-0">
            <span className="text-[var(--selene-text-muted)] font-semibold">DURATION:</span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
              {DURATION_PRESETS.map((preset) => {
                const active = Math.abs(missionDurationDays - preset.days) < 0.05;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      setCustomDaysInput(String(preset.days));
                      onChangeDurationDays(preset.days);
                    }}
                    className={`px-2.5 py-1 transition-colors ${
                      active
                        ? 'bg-[var(--selene-accent-solar)] text-white font-bold'
                        : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCustomDurationApply} className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="90"
                aria-label="Custom Mission Duration in Days"
                value={customDaysInput}
                onChange={(e) => setCustomDaysInput(e.target.value)}
                className="w-16 px-2 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] tabular-nums"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)] font-semibold"
              >
                Set Days
              </button>
            </form>
          </div>

          {/* Configurable & Adaptive Sampling Resolution */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono min-w-0">
            <label htmlFor="timeline-step-select" className="text-[var(--selene-text-muted)] font-semibold">
              RESOLUTION:
            </label>
            <select
              id="timeline-step-select"
              value={String(samplingStepHours)}
              onChange={(e) => {
                if (!onChangeSamplingStepHours) return;
                const val = e.target.value;
                onChangeSamplingStepHours(val === 'AUTO' ? 'AUTO' : Number(val));
              }}
              className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] font-semibold max-w-full"
            >
              {STEP_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-label="Zoom In Timeline"
              onClick={() => setZoomSpanPct((z) => Math.max(25, z - 25))}
              className="p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom Out Timeline"
              onClick={() => setZoomSpanPct((z) => Math.min(100, z + 25))}
              className="p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Operational Gantt Tracks Container */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 space-y-6">
        <div className="space-y-3 pb-4 border-b border-[var(--selene-border)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlayingMissionClock(!isPlayingMissionClock)}
                className={`cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                  isPlayingMissionClock
                    ? 'bg-[var(--selene-accent-green)] text-white'
                    : 'bg-[var(--selene-accent-solar)] text-white hover:opacity-90'
                }`}
              >
                {isPlayingMissionClock ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingMissionClock ? 'Pause Playback' : 'Play Timeline'}</span>
              </button>

              <button
                type="button"
                aria-label="Step Backward 6 Samples"
                onClick={() => handleStep(-6)}
                title="Step Backward 6 Samples"
                className="cursor-pointer p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-accent-earth)]"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Step Backward 1 Sample"
                onClick={() => handleStep(-1)}
                title="Step Backward 1 Sample"
                className="cursor-pointer p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-accent-earth)]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Step Forward 1 Sample"
                onClick={() => handleStep(1)}
                title="Step Forward 1 Sample"
                className="cursor-pointer p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-accent-earth)]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Step Forward 6 Samples"
                onClick={() => handleStep(6)}
                title="Step Forward 6 Samples"
                className="cursor-pointer p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-accent-earth)]"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[11px] font-mono">
                <FastForward className="w-3 h-3 text-[var(--selene-accent-earth)] mx-1" />
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setMissionPlaybackSpeed(spd)}
                    className={`cursor-pointer px-2 py-0.5 transition-colors ${
                      missionPlaybackSpeed === spd
                        ? 'bg-[var(--selene-accent-earth)] text-[var(--selene-bg)] font-bold'
                        : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[var(--selene-accent-earth)] shrink-0" />
              <span className="text-[var(--selene-text)]">
                T+{elapsedHours}h (Day {(elapsedHours / 24).toFixed(1)}) ·{' '}
                <strong className="text-[var(--selene-accent-earth)]">
                  {simulationEpochUtc.replace('T', ' ').slice(0, 19)}Z
                </strong>
              </span>
            </div>
          </div>

          <input
            type="range"
            aria-label="Timeline Cursor Inspection"
            min={visibleStartET}
            max={safeSliderMaxET}
            step={300}
            value={clampedSliderET}
            onChange={(e) => {
              setIsPlayingMissionClock(false);
              setSimulationEpochET(Number(e.target.value));
            }}
            className="w-full accent-[var(--selene-accent-earth)] cursor-pointer h-2 bg-[var(--selene-surface-alt)]"
          />
        </div>

        {/* 3 Operational Gantt Tracks */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-[var(--selene-accent-amber)] font-bold">
                01. TERRAIN-AWARE SOLAR ILLUMINATION vs. SHADOW
              </span>
              <span className="text-[var(--selene-text-secondary)] tabular-nums">
                {metrics.totalSunlitHours}h Sunlit ({metrics.sunlitFractionPct}%) · Max Shadow:{' '}
                {metrics.longestContinuousDarknessHours}h
              </span>
            </div>
            <div className="relative flex w-full h-8 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] overflow-hidden">
              {ganttPoints.map(({ pt, originalIdx }) => (
                <button
                  key={`sun-${pt.epochHour}`}
                  type="button"
                  aria-label={`Solar state at T+${pt.epochHour}h`}
                  onClick={() => {
                    setIsPlayingMissionClock(false);
                    setSimulationEpochET(pt.etSecondsJ2000);
                  }}
                  className="flex-1 h-full transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: pt.solarTerrainVis ? '#F59E0B' : 'var(--selene-surface-elevated)',
                    borderRight:
                      Math.abs(originalIdx - safeCursor) < ganttStride
                        ? '2px solid var(--selene-accent-earth)'
                        : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-[var(--selene-accent-green)] font-bold">
                02. DIRECT-TO-EARTH (DTE) KA-BAND COMMUNICATION LINK
              </span>
              <span className="text-[var(--selene-text-secondary)] tabular-nums">
                {metrics.totalCommsHours}h Active ({metrics.commsFractionPct}%) · Max Window:{' '}
                {metrics.longestContinuousCommsHours}h
              </span>
            </div>
            <div className="relative flex w-full h-8 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] overflow-hidden">
              {ganttPoints.map(({ pt, originalIdx }) => (
                <button
                  key={`dte-${pt.epochHour}`}
                  type="button"
                  aria-label={`DTE state at T+${pt.epochHour}h`}
                  onClick={() => {
                    setIsPlayingMissionClock(false);
                    setSimulationEpochET(pt.etSecondsJ2000);
                  }}
                  className="flex-1 h-full transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: pt.dteLinkFeasible ? '#188038' : 'var(--selene-surface-elevated)',
                    borderRight:
                      Math.abs(originalIdx - safeCursor) < ganttStride
                        ? '2px solid var(--selene-accent-earth)'
                        : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-[var(--selene-accent-solar)] font-bold">
                03. OVERLAPPING SPAC (SIMULTANEOUS POWER &amp; COMMUNICATION) WINDOWS
              </span>
              <span className="text-[var(--selene-text-secondary)] tabular-nums">
                {metrics.cumulativeSpacHours}h Cumulative ({metrics.spacFractionPct}%) · Longest:{' '}
                {metrics.longestContinuousSpacHours}h
              </span>
            </div>
            <div className="relative flex w-full h-8 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] overflow-hidden">
              {ganttPoints.map(({ pt, originalIdx }) => (
                <button
                  key={`spac-${pt.epochHour}`}
                  type="button"
                  aria-label={`SPAC state at T+${pt.epochHour}h`}
                  onClick={() => {
                    setIsPlayingMissionClock(false);
                    setSimulationEpochET(pt.etSecondsJ2000);
                  }}
                  className="flex-1 h-full transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: pt.isSpac ? '#D9541E' : 'var(--selene-surface-elevated)',
                    borderRight:
                      Math.abs(originalIdx - safeCursor) < ganttStride
                        ? '2px solid var(--selene-accent-earth)'
                        : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Cursor Telemetry Readout Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-[var(--selene-border)] font-mono text-xs tabular-nums">
          <div className="bg-[var(--selene-surface-alt)] p-3 border border-[var(--selene-border)]">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">INSPECTED EPOCH</div>
            <div className="font-bold text-[var(--selene-accent-earth)] mt-1">
              T+{inspectedPoint.epochHour}h ({inspectedPoint.timestampUtc.slice(5, 16)}Z)
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] p-3 border border-[var(--selene-border)]">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">SOLAR VECTOR</div>
            <div className="font-bold text-[var(--selene-accent-amber)] mt-1">
              El {inspectedPoint.solarElevationDeg.toFixed(2)}° · Az{' '}
              {inspectedPoint.solarAzimuthDeg.toFixed(1)}°
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] p-3 border border-[var(--selene-border)]">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">EARTH VECTOR</div>
            <div className="font-bold text-[var(--selene-accent-green)] mt-1">
              El {inspectedPoint.earthElevationDeg.toFixed(2)}° · Az{' '}
              {inspectedPoint.earthAzimuthDeg.toFixed(1)}°
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] p-3 border border-[var(--selene-border)]">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">ARRAY POWER / IRRAD</div>
            <div className="font-bold text-[var(--selene-text)] mt-1">
              {inspectedPoint.effectivePowerKw.toFixed(2)} kW ({inspectedPoint.solarIrradianceWm2}{' '}
              W/m²)
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] p-3 border border-[var(--selene-border)] col-span-2 sm:col-span-1">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">SPAC STATUS</div>
            <div
              className={`font-bold mt-1 ${
                inspectedPoint.isSpac
                  ? 'text-[var(--selene-accent-green)]'
                  : 'text-[var(--selene-accent-red)]'
              }`}
            >
              {inspectedPoint.isSpac ? 'SPAC ACTIVE' : 'NON-SPAC'}
            </div>
          </div>
        </div>
      </div>

      {/* 3B. Synchronized Interactive Scientific Recharts Deck */}
      <ScientificRechartsDeck
        siteLatDeg={site.latitude}
        siteLonDeg={site.longitude}
        timelineAnalysis={timelineAnalysis}
        defaultTab="solar-illumination"
      />

      {/* 4. Exact Brent-Dekker Horizon Crossing Event Log */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[var(--selene-text)]">
            Bracketed Root-Finding (Brent-Dekker) Horizon Transition Log
          </h3>
          <span className="text-xs font-mono font-bold text-[var(--selene-accent-earth)] tabular-nums">
            {events.length} DETECTED TRANSITIONS
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-4 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-accent-green)]">
            CONTINUOUS POLAR REGIME ({timelineAnalysis.regime.replace(/_/g, ' ')}): Sun and Earth
            remain continuously on their respective sides of the local LOLA horizon mask throughout
            this {metrics.totalDurationHours}-hour mission window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[680px]">
              <thead>
                <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)] text-[11px]">
                  <th className="py-2.5 pr-4">EVENT TYPE</th>
                  <th className="py-2.5 pr-4">UTC TIMESTAMP (&Delta;t &le; 5s)</th>
                  <th className="py-2.5 pr-4">AZIMUTH (°)</th>
                  <th className="py-2.5 pr-4">ELEVATION (°)</th>
                  <th className="py-2.5">ENGINEERING DESCRIPTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--selene-border)]">
                {events.slice(0, 24).map((ev, idx) => (
                  <tr key={`${ev.type}-${ev.unixMs}-${idx}`} className="hover:bg-[var(--selene-surface-alt)]">
                    <td className="py-2.5 pr-4 font-bold text-[var(--selene-accent-solar)]">{ev.type}</td>
                    <td className="py-2.5 pr-4 text-[var(--selene-accent-earth)]">
                      {ev.timestampUtc.replace('T', ' ').slice(0, 19)}Z
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--selene-text)]">{ev.azimuthDeg.toFixed(2)}°</td>
                    <td className="py-2.5 pr-4 text-[var(--selene-text)]">{ev.elevationDeg.toFixed(2)}°</td>
                    <td className="py-2.5 text-[var(--selene-text-secondary)]">{ev.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Progressive Disclosure: Paginated Adaptive Time-Series Telemetry Table */}
      <ExpandableTechnicalDrawer
        title="Paginated Adaptive Time-Series Ephemeris & Power Telemetry Log"
        subtitle={`Inspect all ${points.length} computed samples across the ${metrics.totalDurationHours}h window (${timelineAnalysis.stepHours}h step).`}
        badgeText={`${points.length} SAMPLES`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[var(--selene-text-muted)]">ROWS PER PAGE:</span>
              {[25, 50, 100].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setPageSize(sz);
                    setTablePage(1);
                  }}
                  className={`px-2.5 py-1 border ${
                    pageSize === sz
                      ? 'bg-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] text-[var(--selene-bg)] font-bold'
                      : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--selene-text-secondary)]">
                Page {safeTablePage} of {totalPages} ({points.length} total samples)
              </span>
              <button
                type="button"
                disabled={safeTablePage <= 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={safeTablePage >= totalPages}
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[740px]">
              <thead>
                <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)] text-[11px]">
                  <th className="py-2 pr-3">T+HOUR</th>
                  <th className="py-2 pr-3">UTC TIMESTAMP</th>
                  <th className="py-2 pr-3">SUN EL / AZ</th>
                  <th className="py-2 pr-3">SUN MASK</th>
                  <th className="py-2 pr-3">EARTH EL / AZ</th>
                  <th className="py-2 pr-3">DTE MARGIN</th>
                  <th className="py-2 pr-3">POWER (kW)</th>
                  <th className="py-2">SPAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--selene-border)]">
                {paginatedPoints.map((pt) => (
                  <tr key={pt.epochHour} className="hover:bg-[var(--selene-surface-alt)]">
                    <td className="py-2 pr-3 font-bold text-[var(--selene-text)]">T+{pt.epochHour}h</td>
                    <td className="py-2 pr-3 text-[var(--selene-accent-earth)]">
                      {pt.timestampUtc.replace('T', ' ').slice(0, 16)}Z
                    </td>
                    <td className="py-2 pr-3 text-[var(--selene-text-secondary)]">
                      {pt.solarElevationDeg.toFixed(2)}° / {pt.solarAzimuthDeg.toFixed(1)}°
                    </td>
                    <td className="py-2 pr-3 text-[var(--selene-text-secondary)]">{pt.solarTerrainHorizonDeg.toFixed(2)}°</td>
                    <td className="py-2 pr-3 text-[var(--selene-text-secondary)]">
                      {pt.earthElevationDeg.toFixed(2)}° / {pt.earthAzimuthDeg.toFixed(1)}°
                    </td>
                    <td className="py-2 pr-3 text-[var(--selene-text-secondary)]">{pt.dteLinkMarginDb.toFixed(1)} dB</td>
                    <td className="py-2 pr-3 font-bold text-[var(--selene-accent-green)]">
                      {pt.effectivePowerKw.toFixed(2)} kW
                    </td>
                    <td
                      className={`py-2 font-bold ${
                        pt.isSpac ? 'text-[var(--selene-accent-green)]' : 'text-[var(--selene-text-muted)]'
                      }`}
                    >
                      {pt.isSpac ? 'SPAC' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ExpandableTechnicalDrawer>

      {/* 6. Contextual Dataset Integration Slot */}
      <DatasetIntegrationSlot
        domain="ILLUMINATION_HORIZON_MASK"
        activeDatabaseCount={points.length}
        activeSourceLabel={`DE441-MOON_ME + LOLA Horizon Mask (${timelineAnalysis.stepHours}h step)`}
        onOpenDataHub={onOpenDataHub}
      />
    </div>
  );
}
