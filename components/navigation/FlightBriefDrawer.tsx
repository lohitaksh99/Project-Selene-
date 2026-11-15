'use client';

import React, { useEffect } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Cpu,
  Monitor,
  Moon,
  RotateCcw,
  Settings,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import type { LandingSiteRecord } from '@/server/db/database';
import type {
  DecoupledPhysicalState,
  EngineeringConstraints,
  SolarPanelOrientation,
} from '@/lib/astrodynamics/coordinateFrames';
import {
  DEFAULT_MCDA_WEIGHTS,
  type McdaConstraintWeights,
  type MissionTimelineAnalysis,
} from '@/lib/astrodynamics/missionAnalyzer';
import type { ApiWarning, EphemerisProviderMode } from '@/lib/astrodynamics/jplHorizonsProvider';
import type { SeleneThemePreference } from '@/lib/store/useSeleneStore';
import {
  EngineeringStatusBadge,
  SiteStatusBadge,
} from '@/components/editorial/WorkspacePrimitives';

interface FlightBriefDrawerProps {
  open: boolean;
  onClose: () => void;
  activeSite: LandingSiteRecord;
  simulationEpochUtc: string;
  physicalState: DecoupledPhysicalState;
  timelineAnalysis: MissionTimelineAnalysis;
  constraints: EngineeringConstraints;
  onChangeConstraints: (partial: Partial<EngineeringConstraints>) => void;
  mcdaWeights: McdaConstraintWeights;
  onChangeMcdaWeights: (partial: Partial<McdaConstraintWeights>) => void;
  providerMode: EphemerisProviderMode;
  onChangeProviderMode: (mode: EphemerisProviderMode) => void;
  lastProviderUsed: string;
  apiWarnings: ApiWarning[];
  isEduMode: boolean;
  onToggleEduMode: (val: boolean) => void;
  themePreference: SeleneThemePreference;
  resolvedTheme?: 'light' | 'dark';
  onChangeThemePreference: (pref: SeleneThemePreference) => void;
  onResetLayoutPreferences: () => void;
  onNavigateWorkspace: (target: string) => void;
}

export default function FlightBriefDrawer({
  open,
  onClose,
  activeSite,
  simulationEpochUtc,
  physicalState,
  timelineAnalysis,
  constraints,
  onChangeConstraints,
  mcdaWeights,
  onChangeMcdaWeights,
  providerMode,
  onChangeProviderMode,
  lastProviderUsed,
  apiWarnings,
  isEduMode,
  onToggleEduMode,
  themePreference,
  resolvedTheme = 'dark',
  onChangeThemePreference,
  onResetLayoutPreferences,
  onNavigateWorkspace,
}: FlightBriefDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxSlopeDeg = constraints.maxSlopeDeg ?? 10.0;
  const solarArrayAreaM2 = constraints.solarArrayAreaM2 ?? 12;
  const pvEfficiency = constraints.pvEfficiency ?? 0.32;
  const solarPanelOrientation = constraints.solarPanelOrientation ?? 'VERTICAL_MAST';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/65"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        id="selene-flight-brief-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Flight Brief and Engineering Constraints"
        className={`selene-workspace-shell ${
          resolvedTheme === 'light' ? 'light-editorial' : 'dark'
        } relative z-10 w-full max-w-[560px] h-full bg-[var(--selene-surface)] border-l border-[var(--selene-border)] text-[var(--selene-text)] flex flex-col overflow-hidden`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[var(--selene-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--selene-surface-alt)]">
          <div className="min-w-0">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--selene-accent-earth)]">
              Flight Brief · Global Mission Configuration
            </div>
            <h2 className="text-base font-extrabold tracking-tight truncate">
              {activeSite.designation} — {activeSite.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Flight Brief Drawer"
            className="p-2 border border-[var(--selene-border)] bg-[var(--selene-surface)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Executive Mission Summary */}
          <section className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SiteStatusBadge site={activeSite} showTooltip />
              <EngineeringStatusBadge status={timelineAnalysis.scoreBreakdown.engineeringAssessment} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono text-xs tabular-nums">
              <div>
                <div className="text-[10px] text-[var(--selene-text-muted)] uppercase">Latitude</div>
                <div className="font-bold">{activeSite.latitude.toFixed(3)}°</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--selene-text-muted)] uppercase">Longitude</div>
                <div className="font-bold">{activeSite.longitude.toFixed(3)}°</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--selene-text-muted)] uppercase">SPAC Hours</div>
                <div className="font-bold text-[var(--selene-accent-green)]">
                  {timelineAnalysis.metrics.cumulativeSpacHours}h
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--selene-text-muted)] uppercase">MCDA Score</div>
                <div className="font-bold text-[var(--selene-accent-earth)]">
                  {timelineAnalysis.scoreBreakdown.overallFeasibilityScore}/100
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--selene-text-muted)] pt-2 border-t border-[var(--selene-border)] flex flex-wrap items-center justify-between gap-2">
              <span>Epoch: {simulationEpochUtc.slice(0, 19)}Z</span>
              <span>Instant Power: {physicalState.effectiveElectricalPowerKw.toFixed(2)} kW</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onNavigateWorkspace('site-analysis');
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-surface)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]"
              >
                Open Site Physics
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateWorkspace('simulator/timeline');
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-surface)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]"
              >
                Inspect Mission Timeline
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateWorkspace('reports');
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-surface)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]"
              >
                Data &amp; Exports
              </button>
            </div>
          </section>

          {/* Section 2: Appearance, Mode & Layout Reset */}
          <section className="border border-[var(--selene-border)] p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[var(--selene-text)]">
                <Monitor className="w-4 h-4 text-[var(--selene-accent-earth)]" />
                <span>Appearance &amp; Workspace Layout</span>
              </div>
              <button
                type="button"
                onClick={onResetLayoutPreferences}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Layout Preferences</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'dark', label: 'Dark Observatory', icon: Moon },
                  { id: 'light', label: 'Editorial Light', icon: Sun },
                  { id: 'system', label: 'System Auto', icon: Monitor },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const active = themePreference === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeThemePreference(mode.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2.5 border text-xs font-mono transition-colors ${
                      active
                        ? 'bg-[var(--selene-accent-earth)]/15 border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-bold'
                        : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-center text-[11px]">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onToggleEduMode(!isEduMode)}
              className={`w-full py-2.5 px-3 border font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                isEduMode
                  ? 'bg-[var(--selene-accent-green)]/15 border-[var(--selene-accent-green)] text-[var(--selene-accent-green)]'
                  : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-accent-earth)]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {isEduMode
                  ? 'Explorer Mode (Plain-English Guidance)'
                  : 'Engineering Mode (Full Telemetry & ±1σ)'}
              </span>
            </button>
          </section>

          {/* Section 3: Ephemeris Engine & Provider Status */}
          <section className="border border-[var(--selene-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[var(--selene-text)]">
                <Cpu className="w-4 h-4 text-[var(--selene-accent-solar)]" />
                <span>Ephemeris Provider (DE441-MOON_ME)</span>
              </div>
              <span className="text-[11px] font-mono text-[var(--selene-text-muted)]">
                {lastProviderUsed}
              </span>
            </div>

            <div className="space-y-2">
              {(
                [
                  {
                    id: 'AUTO_JPL',
                    title: 'Auto Hybrid JPL Horizons (Recommended)',
                    desc: 'Queries NASA JPL Horizons API with deterministic fallback to DE441 analytical kernel.',
                  },
                  {
                    id: 'CALIBRATED_OFFLINE',
                    title: 'Calibrated Offline DE441-MOON_ME',
                    desc: 'Zero-latency deterministic offline kernel without external network calls.',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeProviderMode(opt.id)}
                  className={`w-full text-left p-2.5 border transition-colors ${
                    providerMode === opt.id
                      ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-solar)]'
                      : 'bg-transparent border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span>{opt.title}</span>
                    {providerMode === opt.id && (
                      <span className="text-[10px] text-[var(--selene-accent-solar)]">ACTIVE</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--selene-text-muted)] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {apiWarnings.length > 0 && (
              <div className="p-2.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-accent-amber)]/50 text-[11px] font-mono text-[var(--selene-accent-amber)] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{apiWarnings[0]?.code}</div>
                  <div className="text-[var(--selene-text-secondary)]">{apiWarnings[0]?.message}</div>
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Hardware & Safety Thresholds */}
          <section className="border border-[var(--selene-border)] p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[var(--selene-text)]">
              <Settings className="w-4 h-4 text-[var(--selene-accent-solar)]" />
              <span>Engineering &amp; Hazard Thresholds</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--selene-text-secondary)]">Min Solar Elevation</span>
                  <span className="font-bold tabular-nums">
                    {constraints.minSolarElevationDeg.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Min Solar Elevation Degrees"
                  min={0}
                  max={10}
                  step={0.5}
                  value={constraints.minSolarElevationDeg}
                  onChange={(e) =>
                    onChangeConstraints({ minSolarElevationDeg: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--selene-accent-solar)]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--selene-text-secondary)]">Min Earth DTE Elevation</span>
                  <span className="font-bold tabular-nums">
                    {constraints.minEarthElevationDeg.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Min Earth DTE Elevation Degrees"
                  min={0}
                  max={10}
                  step={0.5}
                  value={constraints.minEarthElevationDeg}
                  onChange={(e) =>
                    onChangeConstraints({ minEarthElevationDeg: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--selene-accent-earth)]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--selene-text-secondary)]">Required Continuous SPAC</span>
                  <span className="font-bold tabular-nums">{constraints.requiredContinuousHours}h</span>
                </div>
                <input
                  type="range"
                  aria-label="Required Continuous SPAC Hours"
                  min={12}
                  max={336}
                  step={12}
                  value={constraints.requiredContinuousHours}
                  onChange={(e) =>
                    onChangeConstraints({ requiredContinuousHours: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--selene-accent-green)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--selene-text-secondary)]">Solar Array</span>
                    <span className="font-bold tabular-nums">{solarArrayAreaM2} m²</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Solar Array Area Square Meters"
                    min={2}
                    max={60}
                    step={2}
                    value={solarArrayAreaM2}
                    onChange={(e) =>
                      onChangeConstraints({ solarArrayAreaM2: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--selene-accent-green)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--selene-text-secondary)]">Cell Eff.</span>
                    <span className="font-bold tabular-nums">{Math.round(pvEfficiency * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Photovoltaic Efficiency"
                    min={0.15}
                    max={0.45}
                    step={0.01}
                    value={pvEfficiency}
                    onChange={(e) =>
                      onChangeConstraints({ pvEfficiency: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--selene-accent-earth)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="brief-panel-orientation"
                    className="block text-[var(--selene-text-secondary)] mb-1"
                  >
                    Array Orientation
                  </label>
                  <select
                    id="brief-panel-orientation"
                    value={solarPanelOrientation}
                    onChange={(e) =>
                      onChangeConstraints({
                        solarPanelOrientation: e.target.value as SolarPanelOrientation,
                      })
                    }
                    className="w-full px-2 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs"
                  >
                    <option value="VERTICAL_MAST">Vertical Polar Mast</option>
                    <option value="DUAL_AXIS_TRACKING">2-Axis Tracking Gimbal</option>
                    <option value="HORIZONTAL_DECK">Horizontal Lander Deck</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--selene-text-secondary)]">Max Slope</span>
                    <span className="font-bold tabular-nums">{maxSlopeDeg.toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Max Lander Touchdown Slope"
                    min={3}
                    max={20}
                    step={0.5}
                    value={maxSlopeDeg}
                    onChange={(e) => onChangeConstraints({ maxSlopeDeg: Number(e.target.value) })}
                    className="w-full accent-[var(--selene-accent-amber)]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: MCDA Criterion Weights */}
          <section className="border border-[var(--selene-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[var(--selene-text)]">
                <Sliders className="w-4 h-4 text-[var(--selene-accent-earth)]" />
                <span>MCDA Decision Weights</span>
              </div>
              <button
                type="button"
                onClick={() => onChangeMcdaWeights(DEFAULT_MCDA_WEIGHTS)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {(
                [
                  { key: 'spacWeightPct', label: 'SPAC Co-Visibility' },
                  { key: 'solarWeightPct', label: 'Solar Illumination' },
                  { key: 'commsWeightPct', label: 'Earth DTE Link' },
                  { key: 'eclipseWeightPct', label: 'Eclipse Survival' },
                  { key: 'scienceWeightPct', label: 'PSR Science Value' },
                ] as const
              ).map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[var(--selene-text-secondary)]">{item.label}</span>
                    <span className="font-bold tabular-nums">{mcdaWeights[item.key]}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label={`${item.label} Weight`}
                    min={0}
                    max={100}
                    step={5}
                    value={mcdaWeights[item.key]}
                    onChange={(e) => onChangeMcdaWeights({ [item.key]: Number(e.target.value) })}
                    className="w-full accent-[var(--selene-accent-earth)]"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
