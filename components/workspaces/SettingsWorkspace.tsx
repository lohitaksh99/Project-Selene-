'use client';

import React from 'react';
import {
  EngineeringConstraints,
  SolarPanelOrientation,
} from '@/lib/astrodynamics/coordinateFrames';
import {
  DEFAULT_MCDA_WEIGHTS,
  McdaConstraintWeights,
} from '@/lib/astrodynamics/missionAnalyzer';
import { EphemerisProviderMode } from '@/lib/astrodynamics/jplHorizonsProvider';
import { SeleneThemePreference } from '@/lib/store/useSeleneStore';
import { EditorialWorkspaceHeader } from '@/components/editorial/WorkspacePrimitives';
import {
  Settings,
  Cpu,
  BookOpen,
  Sun,
  Radio,
  ShieldAlert,
  Monitor,
  Moon,
  Sliders,
  RotateCcw,
} from 'lucide-react';

interface SettingsWorkspaceProps {
  constraints: EngineeringConstraints;
  onChangeConstraints: (partial: Partial<EngineeringConstraints>) => void;
  mcdaWeights?: McdaConstraintWeights;
  onChangeMcdaWeights?: (partial: Partial<McdaConstraintWeights>) => void;
  providerMode: EphemerisProviderMode;
  onChangeProviderMode: (mode: EphemerisProviderMode) => void;
  isEduMode: boolean;
  onToggleEduMode: (val: boolean) => void;
  themePreference?: SeleneThemePreference;
  onChangeThemePreference?: (pref: SeleneThemePreference) => void;
}

export default function SettingsWorkspace({
  constraints,
  onChangeConstraints,
  mcdaWeights = DEFAULT_MCDA_WEIGHTS,
  onChangeMcdaWeights,
  providerMode,
  onChangeProviderMode,
  isEduMode,
  onToggleEduMode,
  themePreference = 'system',
  onChangeThemePreference,
}: SettingsWorkspaceProps) {
  const maxSlopeDeg = constraints.maxSlopeDeg ?? 10.0;
  const solarArrayAreaM2 = constraints.solarArrayAreaM2 ?? 12;
  const pvEfficiency = constraints.pvEfficiency ?? 0.32;
  const solarPanelOrientation = constraints.solarPanelOrientation ?? 'VERTICAL_MAST';

  return (
    <div className="space-y-8 min-w-0">
      {/* 01. Editorial Workspace Header */}
      <EditorialWorkspaceHeader
        indexCode="09"
        categoryLabel="PLATFORM THEME, CONSTRAINT THRESHOLDS & MCDA WEIGHTS"
        title="Mission Engineering Constraints & Ephemeris Configuration"
        subtitle="Configure system-adaptive workspace theming (Light Editorial / Dark Aerospace), ephemeris kernel routing (DE441-MOON_ME), solar array & DTE hardware constraints, and explicit Multi-Criteria Decision Analysis (MCDA) weights."
      />

      {/* 02. Workspace Appearance & Analysis Mode Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Theme Mode Selection */}
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
            <h3 className="text-sm font-bold text-[var(--selene-text)]">
              Internal Workspace Color Theme
            </h3>
          </div>
          <p className="text-xs text-[var(--selene-text-secondary)] leading-relaxed">
            Follows your OS color scheme by default, or lock internal workspaces to Editorial Light Mode (#F7F7F3) or Aerospace Dark Mode (#080B12). The #home portal preserves its own editorial layout.
          </p>
          {onChangeThemePreference && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(
                [
                  { id: 'system', label: 'System Auto', icon: Monitor },
                  { id: 'light', label: 'Editorial Light', icon: Sun },
                  { id: 'dark', label: 'Aerospace Dark', icon: Moon },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const active = themePreference === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeThemePreference(mode.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 border text-xs font-mono transition-colors ${
                      active
                        ? 'bg-[var(--selene-accent-earth)]/15 border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-bold'
                        : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-center">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ephemeris Provider Mode */}
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--selene-accent-solar)] shrink-0" />
            <h3 className="text-sm font-bold text-[var(--selene-text)]">
              Ephemeris Calculation Engine (DE441-MOON_ME)
            </h3>
          </div>
          <div className="space-y-2">
            {(
              [
                {
                  id: 'AUTO_JPL',
                  title: 'AUTO HYBRID JPL HORIZONS (Recommended)',
                  desc: 'Queries live NASA JPL Horizons REST API first; falls back seamlessly to validated offline DE441-MOON_ME provider.',
                },
                {
                  id: 'CALIBRATED_OFFLINE',
                  title: 'CALIBRATED OFFLINE DE441-MOON_ME',
                  desc: 'Zero-latency deterministic analytical ephemeris with MOON_PA_DE440 libration.',
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
                    : 'bg-[var(--selene-surface)] border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold text-[var(--selene-text)]">
                  <span>{opt.title}</span>
                  {providerMode === opt.id && (
                    <span className="text-[10.5px] text-[var(--selene-accent-solar)] shrink-0">ACTIVE</span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--selene-text-secondary)] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Explorer vs Engineering Mode */}
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--selene-accent-green)] shrink-0" />
              <h3 className="text-sm font-bold text-[var(--selene-text)]">
                Telemetry &amp; Uncertainty Display Mode
              </h3>
            </div>
            <p className="text-xs text-[var(--selene-text-secondary)] leading-relaxed">
              Switch between <strong>Explorer Mode</strong> (plain-English astrodynamics guidance for students and mission planners) and <strong>Engineering Mode</strong> (full JD/TDB epochs, Ka-band link margins, and ±1σ uncertainty bounds).
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleEduMode(!isEduMode)}
            className={`w-full py-3 px-4 border font-mono text-xs font-bold transition-colors ${
              isEduMode
                ? 'bg-[var(--selene-accent-green)]/15 border-[var(--selene-accent-green)] text-[var(--selene-accent-green)]'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)]'
            }`}
          >
            {isEduMode
              ? 'ACTIVE: EXPLORER MODE (PLAIN-ENGLISH GUIDANCE)'
              : 'ACTIVE: ENGINEERING MODE (FULL TELEMETRY & ±1σ)'}
          </button>
        </div>
      </div>

      {/* 03. Explicit MCDA Criterion Weights Configuration */}
      {onChangeMcdaWeights && (
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-[var(--selene-text)]">
                  Explicit Multi-Criteria Decision Analysis (MCDA) Weights
                </h3>
                <p className="text-xs font-mono text-[var(--selene-text-muted)]">
                  Any composite site ranking uses these explicitly configured criterion weights (normalized automatically to 100%).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChangeMcdaWeights(DEFAULT_MCDA_WEIGHTS)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default Weights</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {(
              [
                { key: 'spacWeightPct', label: 'SPAC Co-Visibility', color: 'text-[var(--selene-accent-green)]' },
                { key: 'solarWeightPct', label: 'Solar Illumination', color: 'text-[var(--selene-accent-solar)]' },
                { key: 'commsWeightPct', label: 'Earth DTE Link', color: 'text-[var(--selene-accent-earth)]' },
                { key: 'eclipseWeightPct', label: 'Eclipse Survival', color: 'text-[var(--selene-accent-amber)]' },
                { key: 'scienceWeightPct', label: 'PSR Science Value', color: 'text-[var(--selene-text)]' },
              ] as const
            ).map((item) => (
              <div key={item.key} className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--selene-text-secondary)]">{item.label}</span>
                  <span className={`font-bold tabular-nums ${item.color}`}>
                    {mcdaWeights[item.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={`${item.label} MCDA Weight`}
                  min={0}
                  max={100}
                  step={5}
                  value={mcdaWeights[item.key]}
                  onChange={(e) =>
                    onChangeMcdaWeights({ [item.key]: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--selene-accent-earth)]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 04. Hardware, Horizon & Safety Constraint Thresholds */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--selene-border)] pb-3">
          <Settings className="w-4 h-4 text-[var(--selene-accent-solar)] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[var(--selene-text)]">
              Mission Hardware, Horizon &amp; Hazard Thresholds
            </h3>
            <p className="text-xs font-mono text-[var(--selene-text-muted)]">
              Sites are evaluated transparently against these thresholds (MEETS REQUIREMENTS, DOES NOT MEET REQUIREMENTS, REQUIRES FURTHER ANALYSIS, INSUFFICIENT DATA).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Horizon & SPAC Continuity */}
          <div className="space-y-4 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--selene-accent-solar)]">
              <Sun className="w-3.5 h-3.5" />
              <span>HORIZON &amp; SPAC CONTINUITY</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Min Solar Elevation (h☉)</span>
                <span className="text-[var(--selene-accent-solar)] font-bold tabular-nums">
                  {constraints.minSolarElevationDeg.toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                aria-label="Minimum Solar Elevation Degrees"
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
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Min Earth DTE Elevation (h⊕)</span>
                <span className="text-[var(--selene-accent-earth)] font-bold tabular-nums">
                  {constraints.minEarthElevationDeg.toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                aria-label="Minimum Earth DTE Elevation Degrees"
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
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Required Continuous SPAC Window</span>
                <span className="text-[var(--selene-accent-green)] font-bold tabular-nums">
                  {constraints.requiredContinuousHours}h
                </span>
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
          </div>

          {/* Column 2: Solar Array Hardware */}
          <div className="space-y-4 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--selene-accent-green)]">
              <Radio className="w-3.5 h-3.5" />
              <span>SOLAR ARRAY POWER CONFIGURATION</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Active Array Area (m²)</span>
                <span className="text-[var(--selene-accent-green)] font-bold tabular-nums">
                  {solarArrayAreaM2} m²
                </span>
              </div>
              <input
                type="range"
                aria-label="Active Solar Array Area Square Meters"
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
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Triple-Junction Cell Efficiency</span>
                <span className="text-[var(--selene-accent-earth)] font-bold tabular-nums">
                  {Math.round(pvEfficiency * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Photovoltaic Cell Efficiency Percentage"
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

            <div>
              <label htmlFor="settings-panel-orientation" className="block text-xs font-mono text-[var(--selene-text-secondary)] mb-1">
                Mast Gimbal / Panel Orientation
              </label>
              <select
                id="settings-panel-orientation"
                value={solarPanelOrientation}
                onChange={(e) =>
                  onChangeConstraints({
                    solarPanelOrientation: e.target.value as SolarPanelOrientation,
                  })
                }
                className="w-full px-2.5 py-2 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
              >
                <option value="VERTICAL_MAST">Vertical Polar Mast (Low-Sun Optimized)</option>
                <option value="DUAL_AXIS_TRACKING">2-Axis Sun-Tracking Gimbal</option>
                <option value="HORIZONTAL_DECK">Horizontal Lander Deck</option>
              </select>
            </div>
          </div>

          {/* Column 3: Terrain Slope & Eclipse Survival */}
          <div className="space-y-4 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--selene-accent-amber)]">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>TERRAIN HAZARD &amp; ECLIPSE LIMITS</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[var(--selene-text-secondary)]">Max Safe Lander Touchdown Slope</span>
                <span className="text-[var(--selene-accent-amber)] font-bold tabular-nums">
                  {maxSlopeDeg.toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                aria-label="Max Safe Lander Touchdown Slope Degrees"
                min={3}
                max={20}
                step={0.5}
                value={maxSlopeDeg}
                onChange={(e) =>
                  onChangeConstraints({ maxSlopeDeg: Number(e.target.value) })
                }
                className="w-full accent-[var(--selene-accent-amber)]"
              />
            </div>

            <div className="p-3 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[11px] font-mono text-[var(--selene-text-secondary)]">
              Any candidate site exceeding Max Touchdown Slope ({maxSlopeDeg.toFixed(1)}°) or failing continuous SPAC requirements ({constraints.requiredContinuousHours}h) is flagged transparently as{' '}
              <strong className="text-[var(--selene-accent-red)]">DOES NOT MEET REQUIREMENTS</strong> or{' '}
              <strong className="text-[var(--selene-accent-amber)]">REQUIRES FURTHER ANALYSIS</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
