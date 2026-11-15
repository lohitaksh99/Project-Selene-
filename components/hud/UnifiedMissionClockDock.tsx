'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MissionPlaybackSpeed,
  useSeleneStore,
} from '@/lib/store/useSeleneStore';
import {
  computeTimeScales,
  etToUtc,
  utcToEt,
} from '@/lib/astrodynamics/timeScales';
import type { HorizonEvent } from '@/lib/astrodynamics/eventDetection';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  Flag,
  Pause,
  Play,
  Radio,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
} from 'lucide-react';

interface UnifiedMissionClockDockProps {
  solarElevationDeg: number;
  solarAzimuthDeg: number;
  solarTerrainVis: boolean;
  earthElevationDeg: number;
  dteLinkMarginDb: number;
  dteLinkFeasible: boolean;
  effectivePowerKw: number;
  events?: HorizonEvent[];
}

const SPEED_OPTIONS: MissionPlaybackSpeed[] = [1, 10, 60, 360];

export default function UnifiedMissionClockDock({
  solarElevationDeg,
  solarAzimuthDeg,
  solarTerrainVis,
  earthElevationDeg,
  dteLinkMarginDb,
  dteLinkFeasible,
  effectivePowerKw,
  events = [],
}: UnifiedMissionClockDockProps) {
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

  const [scrubberOpen, setScrubberOpen] = useState(true);

  const etRef = useRef<number>(simulationEpochET);
  useEffect(() => {
    etRef.current = simulationEpochET;
  }, [simulationEpochET]);

  useEffect(() => {
    if (!isPlayingMissionClock) return;

    let cancelled = false;
    let rafId = 0;
    etRef.current = useSeleneStore.getState().simulationEpochET;
    let lastPerfMs = performance.now();
    let lastStoreSyncMs = performance.now();

    const stepClock = (nowMs: number) => {
      if (cancelled) return;
      const dtWallSec = Math.min(0.1, Math.max(0.0, (nowMs - lastPerfMs) / 1000.0));
      lastPerfMs = nowMs;

      const simDeltaSec = dtWallSec * 60.0 * missionPlaybackSpeed;
      let nextEt = etRef.current + simDeltaSec;
      const spanSec = Math.max(3600, simulationEndET - simulationStartET);
      if (nextEt > simulationEndET) {
        nextEt = simulationStartET + ((nextEt - simulationStartET) % spanSec);
      }
      etRef.current = nextEt;

      if (nowMs - lastStoreSyncMs >= 80) {
        lastStoreSyncMs = nowMs;
        setSimulationEpochET(nextEt);
      }

      if (!cancelled) {
        rafId = requestAnimationFrame(stepClock);
      }
    };

    rafId = requestAnimationFrame(stepClock);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    isPlayingMissionClock,
    missionPlaybackSpeed,
    simulationStartET,
    simulationEndET,
    setSimulationEpochET,
  ]);

  const timeScales = computeTimeScales(simulationEpochUtc);
  const totalWindowSec = Math.max(3600, simulationEndET - simulationStartET);
  const elapsedSec = Math.max(0, Math.min(totalWindowSec, simulationEpochET - simulationStartET));
  const elapsedHours = Number((elapsedSec / 3600.0).toFixed(2));
  const totalHours = Number((totalWindowSec / 3600.0).toFixed(1));

  const timelineMarkers = useMemo(() => {
    const labelMap: Record<HorizonEvent['type'], string> = {
      SUNRISE: 'Sunrise',
      SUNSET: 'Sunset',
      EARTHRISE: 'Earthrise',
      EARTHSET: 'Earthset',
      SPAC_START: 'SPAC Start',
      SPAC_END: 'SPAC End',
      SOLAR_APEX: 'Solar Apex',
      GRAZING_DIP: 'Grazing Dip',
    };
    return events
      .map((ev) => {
        const et = utcToEt(ev.timestampUtc);
        const pct = ((et - simulationStartET) / totalWindowSec) * 100;
        return {
          ...ev,
          label: labelMap[ev.type] ?? ev.type,
          et,
          pct,
        };
      })
      .filter((m) => m.pct >= 0 && m.pct <= 100)
      .slice(0, 10);
  }, [events, simulationStartET, totalWindowSec]);

  const handleStepHours = (deltaHours: number) => {
    setIsPlayingMissionClock(false);
    const nextEt = Math.max(
      simulationStartET,
      Math.min(simulationEndET, simulationEpochET + deltaHours * 3600.0)
    );
    setSimulationEpochET(nextEt);
  };

  const handleJumpToMarker = (et: number) => {
    setIsPlayingMissionClock(false);
    setSimulationEpochET(Math.max(simulationStartET, Math.min(simulationEndET, et)));
  };

  return (
    <div
      className="sticky top-14 z-40 shrink-0 w-full bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3 sm:px-4 lg:px-6 py-2 text-xs font-mono text-[var(--selene-text)] shadow-sm"
      data-testid="unified-mission-clock-dock"
      aria-label="Persistent Mission Timeline Toolbar"
    >
      <div className="max-w-[1680px] mx-auto flex flex-col gap-1.5">
        {/* Top Row: Horizontally scrollable on narrow viewports so all timeline controls stay accessible */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
          {/* Left: Transport Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setIsPlayingMissionClock(!isPlayingMissionClock)}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-bold uppercase tracking-wider border transition-colors shrink-0 ${
                isPlayingMissionClock
                  ? 'bg-[var(--selene-accent-green)] border-[var(--selene-accent-green)] text-white'
                  : 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] hover:opacity-90'
              }`}
            >
              {isPlayingMissionClock ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause ET</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Sync Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleStepHours(-24)}
              title="Step Backward 24 Hours"
              className="cursor-pointer inline-flex items-center px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)] shrink-0"
            >
              <SkipBack className="w-3.5 h-3.5 mr-0.5" />
              24h
            </button>
            <button
              type="button"
              onClick={() => handleStepHours(-1)}
              title="Step Backward 1 Hour"
              className="cursor-pointer px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)] shrink-0"
            >
              -1h
            </button>
            <button
              type="button"
              onClick={() => handleStepHours(1)}
              title="Step Forward 1 Hour"
              className="cursor-pointer px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)] shrink-0"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => handleStepHours(24)}
              title="Step Forward 24 Hours"
              className="cursor-pointer inline-flex items-center px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)] shrink-0"
            >
              24h
              <SkipForward className="w-3.5 h-3.5 ml-0.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlayingMissionClock(false);
                setSimulationEpochET(simulationStartET);
              }}
              title="Reset to Mission Window Start"
              className="cursor-pointer p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)] shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Playback Speed Multipliers */}
            <div className="inline-flex items-center bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-0.5 ml-1 shrink-0">
              <FastForward className="w-3 h-3 text-[var(--selene-accent-gold)] mx-1.5" />
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setMissionPlaybackSpeed(spd)}
                  className={`cursor-pointer px-2 py-0.5 text-[11px] transition-colors ${
                    missionPlaybackSpeed === spd
                      ? 'bg-[var(--selene-accent-yellow)] text-[#111111] font-bold'
                      : 'text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Center: Authoritative SPICE ET/TDB & Validated LSK UTC Readout */}
          <div className="flex items-center gap-2 tabular-nums shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
              <Clock className="w-3.5 h-3.5 text-[var(--selene-accent-gold)] shrink-0" />
              <span className="text-[var(--selene-text-muted)]">UTC:</span>
              <strong className="text-[var(--selene-text)] text-[11px] sm:text-xs">
                {etToUtc(simulationEpochET).replace('T', ' ').slice(0, 16)}Z
              </strong>
            </div>
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[11px]">
              <span className="text-[var(--selene-text-muted)]">SPICE ET(TDB):</span>
              <span className="text-[var(--selene-accent-gold)] font-semibold">
                {simulationEpochET.toFixed(2)} s
              </span>
              <span className="text-[var(--selene-text-muted)]">|</span>
              <span className="text-[var(--selene-text-muted)]">
                LSK &Delta;AT={timeScales.taiMinusUtcSeconds}s
              </span>
            </div>
          </div>

          {/* Right: Synchronized Illumination & DTE Telemetry Strip + Collapse Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 tabular-nums shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
              <Sun
                className={`w-3.5 h-3.5 ${
                  solarTerrainVis ? 'text-[var(--selene-accent-amber)]' : 'text-[var(--selene-accent-red)]'
                }`}
              />
              <span>
                El {solarElevationDeg.toFixed(2)}° / Az {solarAzimuthDeg.toFixed(0)}°
              </span>
              <span className="text-[var(--selene-accent-green)] font-bold ml-1">
                {effectivePowerKw.toFixed(2)} kW
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
              <Radio
                className={`w-3.5 h-3.5 ${
                  dteLinkFeasible ? 'text-[var(--selene-accent-earth)]' : 'text-[var(--selene-accent-red)]'
                }`}
              />
              <span>
                DTE {earthElevationDeg.toFixed(2)}° ({dteLinkMarginDb.toFixed(1)} dB)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setScrubberOpen((v) => !v)}
              aria-expanded={scrubberOpen}
              title={scrubberOpen ? 'Collapse Mission Timeline Scrubber' : 'Expand Mission Timeline Scrubber'}
              className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-accent-earth)]/50 text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)]"
            >
              <span className="text-[10.5px] font-bold uppercase">
                {scrubberOpen ? 'Compact' : 'Scrubber'}
              </span>
              {scrubberOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Scrubber Track + Interactive Event Markers */}
        {scrubberOpen && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--selene-text-muted)] tabular-nums whitespace-nowrap">
                T+{elapsedHours}h / {totalHours}h
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  aria-label="Unified SPICE Mission Clock Scrubber"
                  min={simulationStartET}
                  max={simulationEndET}
                  step={300}
                  value={Math.max(simulationStartET, Math.min(simulationEndET, simulationEpochET))}
                  onChange={(e) => {
                    setIsPlayingMissionClock(false);
                    setSimulationEpochET(Number(e.target.value));
                  }}
                  className="w-full accent-[var(--selene-accent-earth)] cursor-pointer h-1.5 bg-[var(--selene-surface-alt)]"
                />
                {timelineMarkers.map((mk, idx) => (
                  <button
                    key={`${mk.type}-${mk.timestampUtc}-${idx}`}
                    type="button"
                    onClick={() => handleJumpToMarker(mk.et)}
                    title={`${mk.label} (${mk.timestampUtc.slice(0, 16)}Z)`}
                    style={{ left: `${mk.pct}%` }}
                    className="cursor-pointer absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-3 bg-[var(--selene-accent-solar)] hover:bg-[var(--selene-accent-yellow)] border border-[#111111] transition-colors"
                    aria-label={`Jump to ${mk.label} at ${mk.timestampUtc.slice(0, 16)}Z`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[var(--selene-accent-gold)] font-semibold tabular-nums whitespace-nowrap">
                Day {(elapsedHours / 24).toFixed(1)}
              </span>
            </div>

            {timelineMarkers.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10.5px]">
                <span className="inline-flex items-center gap-1 text-[var(--selene-text-muted)] shrink-0">
                  <Flag className="w-3 h-3 text-[var(--selene-accent-solar)]" />
                  <span>MARKERS:</span>
                </span>
                {timelineMarkers.map((mk, idx) => {
                  const isNear = Math.abs(mk.et - simulationEpochET) < 1800;
                  return (
                    <button
                      key={`pill-${mk.type}-${mk.timestampUtc}-${idx}`}
                      type="button"
                      onClick={() => handleJumpToMarker(mk.et)}
                      className={`cursor-pointer px-2 py-0.5 border whitespace-nowrap shrink-0 transition-colors ${
                        isNear
                          ? 'bg-[var(--selene-accent-earth)]/20 border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-bold'
                          : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:border-[var(--selene-accent-earth)] hover:text-[var(--selene-text)]'
                      }`}
                    >
                      {mk.label} · {mk.timestampUtc.slice(5, 16).replace('T', ' ')}Z
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

