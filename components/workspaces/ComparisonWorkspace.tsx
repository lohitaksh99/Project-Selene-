'use client';

import React, { useMemo, useState } from 'react';
import type { LandingSiteRecord, ScenarioRecord } from '@/server/db/database';
import {
  DEFAULT_MCDA_WEIGHTS,
  EngineeringAssessmentStatus,
  McdaConstraintWeights,
  runMissionTimelineAnalysis,
} from '@/lib/astrodynamics/missionAnalyzer';
import { EngineeringConstraints } from '@/lib/astrodynamics/coordinateFrames';
import {
  EngineeringStatusBadge,
  SiteStatusBadge,
} from '@/components/editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '@/components/editorial/DatasetIntegrationSlot';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Plus, CalendarRange, MapPin, Layers, Check, Sliders, RotateCcw } from 'lucide-react';

interface ComparisonWorkspaceProps {
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  scenarios: ScenarioRecord[];
  selectedScenarioIds: string[];
  onChangeSelectedScenarioIds: (ids: string[]) => void;
  savedComparisonSiteIds: string[];
  onToggleSavedSite: (siteId: string) => void;
  onScenarioCreated: (newScenario: ScenarioRecord) => void;
  globalConstraints: EngineeringConstraints;
  missionStartDateUtc: string;
  missionDurationDays: number;
  mcdaWeights?: McdaConstraintWeights;
  onChangeMcdaWeights?: (partial: Partial<McdaConstraintWeights>) => void;
  isEduMode?: boolean;
  activeSubsection?: string;
}

type ComparisonMatrixMode = 'saved-sites' | 'multi-date' | 'scenarios';

const COLORS = ['#D9541E', '#00E5FF', '#22C55E', '#EAB308'];

interface MatrixCandidate {
  id: string;
  label: string;
  subLabel: string;
  site: LandingSiteRecord;
  epochStartUtc: string;
  durationDays: number;
  analysis: ReturnType<typeof runMissionTimelineAnalysis>;
  color: string;
}

export default function ComparisonWorkspace({
  sites,
  activeSite,
  scenarios,
  selectedScenarioIds,
  onChangeSelectedScenarioIds,
  savedComparisonSiteIds,
  onToggleSavedSite,
  onScenarioCreated,
  globalConstraints,
  missionStartDateUtc,
  missionDurationDays,
  mcdaWeights = DEFAULT_MCDA_WEIGHTS,
  onChangeMcdaWeights,
  isEduMode = false,
  activeSubsection = 'matrix',
}: ComparisonWorkspaceProps) {
  const [matrixMode, setMatrixMode] = useState<ComparisonMatrixMode>('saved-sites');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showWeightEditor, setShowWeightEditor] = useState(activeSubsection === 'mcda');
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? 'shackleton-rim');
  const [epochStartUtc, setEpochStartUtc] = useState('2026-11-10T00:00:00Z');
  const [durationDays, setDurationDays] = useState(missionDurationDays);
  const [saving, setSaving] = useState(false);

  const [prevSubsection, setPrevSubsection] = useState(activeSubsection);

  if (activeSubsection !== prevSubsection) {
    setPrevSubsection(activeSubsection);
    if (activeSubsection === 'mcda') {
      setShowWeightEditor(true);
    } else if (activeSubsection === 'scenarios') {
      setMatrixMode('scenarios');
      setShowBuilder(true);
    }
  }

  // Multi-Date Trade Study epochs for activeSite
  const [multiDateEpochs, setMultiDateEpochs] = useState<string[]>([
    '2026-11-10T00:00:00Z',
    '2026-11-17T00:00:00Z',
    '2026-11-24T00:00:00Z',
  ]);
  const [newEpochInput, setNewEpochInput] = useState('2026-12-02T00:00');

  const toggleScenario = (id: string) => {
    if (selectedScenarioIds.includes(id)) {
      if (selectedScenarioIds.length <= 1) return;
      onChangeSelectedScenarioIds(selectedScenarioIds.filter((s) => s !== id));
    } else {
      if (selectedScenarioIds.length >= 4) {
        onChangeSelectedScenarioIds([...selectedScenarioIds.slice(1), id]);
      } else {
        onChangeSelectedScenarioIds([...selectedScenarioIds, id]);
      }
    }
  };

  const addMultiDateEpoch = () => {
    if (!newEpochInput) return;
    const iso = newEpochInput.length === 16 ? `${newEpochInput}:00Z` : new Date(newEpochInput).toISOString();
    if (multiDateEpochs.includes(iso)) return;
    if (multiDateEpochs.length >= 4) {
      setMultiDateEpochs([...multiDateEpochs.slice(1), iso]);
    } else {
      setMultiDateEpochs([...multiDateEpochs, iso]);
    }
  };

  // Compute unified MatrixCandidates based on active matrixMode and explicit mcdaWeights
  const evaluatedCandidates: MatrixCandidate[] = useMemo(() => {
    if (matrixMode === 'saved-sites') {
      const effectiveSiteIds =
        savedComparisonSiteIds.length > 0
          ? savedComparisonSiteIds.slice(0, 4)
          : sites.slice(0, 3).map((s) => s.id);

      return effectiveSiteIds.map((id, idx) => {
        const site = sites.find((s) => s.id === id) ?? sites[0]!;
        const analysis = runMissionTimelineAnalysis({
          siteId: site.id,
          siteName: site.name,
          siteLatDeg: site.latitude,
          siteLonDeg: site.longitude,
          siteElevationKm: site.elevation_km,
          psrProximityKm: site.psr_proximity_km,
          siteSlopeDeg: site.slope_deg,
          epochStartUtc: missionStartDateUtc,
          durationDays: missionDurationDays,
          stepHours: 'AUTO',
          constraints: globalConstraints,
          weights: mcdaWeights,
        });
        return {
          id: site.id,
          label: site.name,
          subLabel: `${site.designation} • ${missionStartDateUtc.slice(0, 10)} (${missionDurationDays}d)`,
          site,
          epochStartUtc: missionStartDateUtc,
          durationDays: missionDurationDays,
          analysis,
          color: COLORS[idx % COLORS.length]!,
        };
      });
    }

    if (matrixMode === 'multi-date') {
      return multiDateEpochs.map((epochIso, idx) => {
        const analysis = runMissionTimelineAnalysis({
          siteId: activeSite.id,
          siteName: activeSite.name,
          siteLatDeg: activeSite.latitude,
          siteLonDeg: activeSite.longitude,
          siteElevationKm: activeSite.elevation_km,
          psrProximityKm: activeSite.psr_proximity_km,
          siteSlopeDeg: activeSite.slope_deg,
          epochStartUtc: epochIso,
          durationDays: missionDurationDays,
          stepHours: 'AUTO',
          constraints: globalConstraints,
          weights: mcdaWeights,
        });
        return {
          id: `${activeSite.id}-${epochIso}`,
          label: `${activeSite.name} (${epochIso.slice(0, 10)})`,
          subLabel: `Launch Window #${idx + 1} • ${epochIso.replace('T', ' ').slice(0, 16)} UTC`,
          site: activeSite,
          epochStartUtc: epochIso,
          durationDays: missionDurationDays,
          analysis,
          color: COLORS[idx % COLORS.length]!,
        };
      });
    }

    // Mode: 'scenarios'
    const activeScenarios = scenarios.filter((s) => selectedScenarioIds.includes(s.id));
    const list = activeScenarios.length > 0 ? activeScenarios : scenarios.slice(0, 3);
    return list.map((scen, idx) => {
      const site = sites.find((s) => s.id === scen.site_id) ?? sites[0]!;
      const customConstraints: EngineeringConstraints = {
        ...globalConstraints,
        minSolarElevationDeg: scen.min_solar_elevation_deg,
        minEarthElevationDeg: scen.min_earth_elevation_deg,
        requiredContinuousHours: scen.required_continuous_hours,
      };
      const analysis = runMissionTimelineAnalysis({
        siteId: site.id,
        siteName: site.name,
        siteLatDeg: site.latitude,
        siteLonDeg: site.longitude,
        siteElevationKm: site.elevation_km,
        psrProximityKm: site.psr_proximity_km,
        siteSlopeDeg: site.slope_deg,
        epochStartUtc: scen.landing_date,
        durationDays: scen.duration_days,
        stepHours: 'AUTO',
        constraints: customConstraints,
        weights: mcdaWeights,
      });
      return {
        id: scen.id,
        label: scen.name,
        subLabel: `${site.name} • ${scen.landing_date.slice(0, 10)} (${scen.duration_days}d)`,
        site,
        epochStartUtc: scen.landing_date,
        durationDays: scen.duration_days,
        analysis,
        color: COLORS[idx % COLORS.length]!,
      };
    });
  }, [
    matrixMode,
    savedComparisonSiteIds,
    sites,
    missionStartDateUtc,
    missionDurationDays,
    globalConstraints,
    mcdaWeights,
    multiDateEpochs,
    activeSite,
    scenarios,
    selectedScenarioIds,
  ]);

  const radarData = useMemo(() => {
    const axisLabels = [
      'SPAC Co-Vis',
      'Solar Power',
      'DTE Link',
      'Thermal/Survival',
      'PSR Science',
    ];

    return axisLabels.map((label, axisIdx) => {
      const row: Record<string, string | number> = { metric: label };
      for (const item of evaluatedCandidates) {
        row[item.label] = item.analysis.scoreBreakdown.criteria[axisIdx]?.rawScore ?? 0;
      }
      return row;
    });
  }, [evaluatedCandidates]);

  const barData = useMemo(() => {
    return evaluatedCandidates.map((item) => ({
      name: item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label,
      SunlitPct: item.analysis.metrics.sunlitFractionPct,
      EarthVisPct: item.analysis.metrics.commsFractionPct,
      SpacPct: item.analysis.metrics.spacFractionPct,
      McdaScore: item.analysis.scoreBreakdown.overallFeasibilityScore,
      AvgPowerKw: item.analysis.metrics.avgElectricalPowerKw,
    }));
  }, [evaluatedCandidates]);

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          site_id: siteId,
          landing_date: epochStartUtc,
          duration_days: durationDays,
          min_solar_elevation_deg: globalConstraints.minSolarElevationDeg,
          min_earth_elevation_deg: globalConstraints.minEarthElevationDeg,
          required_continuous_hours: globalConstraints.requiredContinuousHours,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data?.scenario) {
        onScenarioCreated(json.data.scenario as ScenarioRecord);
        setShowBuilder(false);
        setName('');
      }
    } finally {
      setSaving(false);
    }
  };

  const maxSlopeThreshold = globalConstraints.maxSlopeDeg ?? 10.0;

  return (
    <div className="space-y-5 min-w-0">
      {/* 01. Compact Trade Study Action Strip (No Cloned Hero Banner) */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--selene-accent-earth)]">
            MULTI-SITE &amp; MULTI-DATE TRADE STUDY · {evaluatedCandidates.length} CANDIDATES
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[var(--selene-text)] tracking-tight">
            Engineering Trade Matrix &amp; MCDA Weighting
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowWeightEditor(!showWeightEditor)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)] transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>
              MCDA Weights ({mcdaWeights.spacWeightPct}/{mcdaWeights.solarWeightPct}/
              {mcdaWeights.commsWeightPct}/{mcdaWeights.eclipseWeightPct}/
              {mcdaWeights.scienceWeightPct})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowBuilder(!showBuilder)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-accent-solar)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showBuilder ? 'Close Scenario Builder' : 'Save New Scenario'}</span>
          </button>
        </div>
      </section>

      {/* Explicit MCDA Criterion Weights Editor Drawer */}
      {showWeightEditor && onChangeMcdaWeights && (
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-accent-earth)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-3">
            <div>
              <div className="text-[10.5px] font-mono uppercase tracking-widest text-[var(--selene-accent-earth)]">
                TRANSPARENT MCDA CRITERION WEIGHTS (NORMALIZED TO 100%)
              </div>
              <h3 className="text-sm font-bold text-[var(--selene-text)]">
                Configure Multi-Criteria Decision Analysis Weighting
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onChangeMcdaWeights(DEFAULT_MCDA_WEIGHTS)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
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
              <div key={item.key} className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--selene-text-secondary)]">{item.label}</span>
                  <span className={`font-bold tabular-nums ${item.color}`}>
                    {mcdaWeights[item.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={`${item.label} Weight Percentage`}
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

      {/* Mode Switcher Toolbar */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-mono text-[var(--selene-text-secondary)]">
            Select Trade Matrix Mode · Active Window: <strong>{missionDurationDays} Days</strong> from{' '}
            <strong>{missionStartDateUtc.slice(0, 10)}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
            <button
              type="button"
              onClick={() => setMatrixMode('saved-sites')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                matrixMode === 'saved-sites'
                  ? 'bg-[var(--selene-accent-solar)] text-white font-semibold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Multi-Site ({savedComparisonSiteIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('multi-date')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                matrixMode === 'multi-date'
                  ? 'bg-[var(--selene-accent-solar)] text-white font-semibold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Multi-Date ({multiDateEpochs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('scenarios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                matrixMode === 'scenarios'
                  ? 'bg-[var(--selene-accent-solar)] text-white font-semibold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Saved Scenarios ({selectedScenarioIds.length})</span>
            </button>
          </div>
        </div>

        {/* Mode-specific selector bar */}
        {matrixMode === 'saved-sites' && (
          <div className="pt-3 border-t border-[var(--selene-border)] space-y-2">
            <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
              Select up to 4 Lunar Sites to compare at Epoch{' '}
              <span className="text-[var(--selene-accent-earth)] font-semibold">{missionStartDateUtc.slice(0, 10)}</span> ({missionDurationDays}d duration):
            </div>
            <div className="flex flex-wrap gap-2">
              {sites.map((st) => {
                const isSelected = savedComparisonSiteIds.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onToggleSavedSite(st.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border transition-colors ${
                      isSelected
                        ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-semibold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {matrixMode === 'multi-date' && (
          <div className="pt-3 border-t border-[var(--selene-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">
                Comparing Launch Epochs for Active Site:{' '}
                <span className="text-[var(--selene-accent-solar)] font-semibold">{activeSite.name}</span> ({missionDurationDays}d mission window)
              </div>
              <div className="flex flex-wrap gap-2">
                {multiDateEpochs.map((ep, idx) => (
                  <span
                    key={ep}
                    className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                  >
                    <span
                      className="w-2 h-2 shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    {ep.slice(0, 16).replace('T', ' ')}Z
                    {multiDateEpochs.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove epoch ${ep}`}
                        onClick={() => setMultiDateEpochs(multiDateEpochs.filter((item) => item !== ep))}
                        className="text-[var(--selene-accent-red)] hover:underline ml-1"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
              <input
                type="datetime-local"
                aria-label="Add Launch Epoch UTC"
                value={newEpochInput}
                onChange={(e) => setNewEpochInput(e.target.value)}
                className="min-w-0 max-w-full flex-1 sm:flex-initial px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
              />
              <button
                type="button"
                onClick={addMultiDateEpoch}
                className="px-3 py-1.5 text-xs font-mono font-semibold bg-[var(--selene-accent-earth)]/15 border border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)]"
              >
                + Add Window
              </button>
            </div>
          </div>
        )}

        {matrixMode === 'scenarios' && (
          <div className="pt-3 border-t border-[var(--selene-border)] grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenarios.map((scen) => {
              const selected = selectedScenarioIds.includes(scen.id);
              const site = sites.find((s) => s.id === scen.site_id);
              return (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => toggleScenario(scen.id)}
                  className={`text-left p-3 border transition-colors ${
                    selected
                      ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-solar)]'
                      : 'bg-[var(--selene-surface)] border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--selene-text)] truncate">{scen.name}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10.5px] font-mono shrink-0 ${
                        selected
                          ? 'bg-[var(--selene-accent-solar)] text-white'
                          : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-muted)] border border-[var(--selene-border)]'
                      }`}
                    >
                      {selected ? 'SELECTED' : 'SELECT'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-[var(--selene-accent-earth)]">{site?.name ?? scen.site_id}</div>
                  <div className="mt-1 text-[10.5px] font-mono text-[var(--selene-text-muted)] tabular-nums">
                    Epoch: {scen.landing_date.slice(0, 10)} · {scen.duration_days}d
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showBuilder && (
          <form
            onSubmit={handleCreateScenario}
            className="pt-3 border-t border-[var(--selene-border)] grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <div className="min-w-0">
              <label className="block text-[11px] font-mono text-[var(--selene-text-secondary)] mb-1">Scenario Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Artemis IV Nobile Summer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-w-0 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-mono text-[var(--selene-text-secondary)] mb-1">Target Landing Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full min-w-0 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.designation})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-mono text-[var(--selene-text-secondary)] mb-1">Epoch Start (UTC)</label>
              <input
                type="text"
                value={epochStartUtc}
                onChange={(e) => setEpochStartUtc(e.target.value)}
                className="w-full min-w-0 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
              />
            </div>
            <div className="flex items-end gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-mono text-[var(--selene-text-secondary)] mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  step="any"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full min-w-0 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)]"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 bg-[var(--selene-accent-green)] text-white text-xs font-mono font-bold shrink-0"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Candidate Summary Cards with Explicit Site Status & Transparent Engineering Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {evaluatedCandidates.map((cand) => (
          <div
            key={cand.id}
            className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 flex flex-col justify-between gap-3"
            style={{ borderTopWidth: '3px', borderTopColor: cand.color }}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--selene-text)]">{cand.label}</h3>
                  <div className="text-[11px] font-mono text-[var(--selene-text-muted)]">{cand.subLabel}</div>
                </div>
                <div className="text-right font-mono shrink-0">
                  <div className="text-[10.5px] text-[var(--selene-text-muted)]">WEIGHTED SCORE</div>
                  <div className="text-lg font-bold text-[var(--selene-accent-earth)] tabular-nums">
                    {cand.analysis.scoreBreakdown.overallFeasibilityScore.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <SiteStatusBadge site={cand.site} />
                <EngineeringStatusBadge
                  status={cand.analysis.scoreBreakdown.engineeringAssessment}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--selene-border)] text-[11px] font-mono text-[var(--selene-text-secondary)] space-y-1">
              <div className="flex justify-between gap-2">
                <span>Max Cont. SPAC:</span>
                <span className="font-bold tabular-nums text-[var(--selene-text)]">
                  {cand.analysis.metrics.longestContinuousSpacHours}h (req ≥
                  {globalConstraints.requiredContinuousHours}h)
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Terrain Slope:</span>
                <span className="font-bold tabular-nums text-[var(--selene-text)]">
                  {cand.site.slope_deg.toFixed(1)}° (lim ≤{maxSlopeThreshold}°)
                </span>
              </div>
              <p className="text-[10.5px] text-[var(--selene-text-muted)] pt-1 leading-relaxed">
                {cand.analysis.scoreBreakdown.assessmentRationale}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(() => {
        const chartsSection = (
          <div key="charts-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-6 bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="text-sm font-bold text-[var(--selene-text)]">
                  5-Axis Multi-Criteria Decision Analysis (MCDA) Spider Radar
                </h3>
                <p className="text-xs font-mono text-[var(--selene-text-muted)]">
                  SPAC Co-Visibility ({mcdaWeights.spacWeightPct}%), Solar ({mcdaWeights.solarWeightPct}%), DTE Comms ({mcdaWeights.commsWeightPct}%), Thermal Survival ({mcdaWeights.eclipseWeightPct}%), PSR Science ({mcdaWeights.scienceWeightPct}%)
                </p>
              </div>
              <div className="h-80 mt-2 bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--selene-border)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: 'var(--selene-text)', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10, fontFamily: 'monospace' }}
                    />
                    {evaluatedCandidates.map((item) => (
                      <Radar
                        key={item.id}
                        name={item.label}
                        dataKey={item.label}
                        stroke={item.color}
                        fill={item.color}
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--selene-text)' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--selene-chart-tooltip-bg)',
                        borderColor: 'var(--selene-chart-tooltip-border)',
                        color: 'var(--selene-text)',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="text-sm font-bold text-[var(--selene-text)]">
                  Sunlit %, Earth DTE %, SPAC Co-Visibility % &amp; Weighted MCDA Score
                </h3>
                <p className="text-xs font-mono text-[var(--selene-text-muted)]">
                  Quantitative Trade Study Breakdown Across Selected Candidates
                </p>
              </div>
              <div className="h-80 mt-2 bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
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
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--selene-text)' }} />
                    <Bar dataKey="SunlitPct" fill="#D9541E" name="Sunlit (%)" />
                    <Bar dataKey="EarthVisPct" fill="#00838F" name="Earth DTE (%)" />
                    <Bar dataKey="SpacPct" fill="#188038" name="SPAC Window (%)" />
                    <Bar dataKey="McdaScore" fill="#B78900" name="Weighted MCDA (/100)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

        const matrixSection = (
          <div key="matrix-section" className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-[var(--selene-text)]">
                Quantitative Mission Trade Matrix ({matrixMode.toUpperCase()} MODE)
              </h3>
              <span className="text-xs font-mono text-[var(--selene-text-muted)]">
                {isEduMode
                  ? 'Explorer View: Key Mission Feasibility Metrics'
                  : 'Engineering View: Includes Power Generation, Slope Hazard & Explicit Assessment Status'}
              </span>
            </div>
            <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[880px]">
              <thead>
                <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                  <th className="py-2.5 pr-4">Candidate / Epoch</th>
                  <th className="py-2.5 pr-4">Site Classification</th>
                  <th className="py-2.5 pr-4">Sunlit %</th>
                  <th className="py-2.5 pr-4">Earth DTE %</th>
                  <th className="py-2.5 pr-4">SPAC %</th>
                  <th className="py-2.5 pr-4">Max SPAC (h)</th>
                  <th className="py-2.5 pr-4">Max Eclipse (h)</th>
                  <th className="py-2.5 pr-4">Avg Power (kW)</th>
                  <th className="py-2.5 pr-4">Slope / PSR</th>
                  <th className="py-2.5 pr-4">Weighted Score</th>
                  <th className="py-2.5">Engineering Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--selene-border)]">
                {evaluatedCandidates.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--selene-surface-alt)]">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[var(--selene-text)]">{item.label}</div>
                      <div className="text-[10.5px] text-[var(--selene-text-muted)]">{item.subLabel}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <SiteStatusBadge site={item.site} />
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-accent-solar)] font-semibold">
                      {item.analysis.metrics.sunlitFractionPct}%
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-accent-earth)] font-semibold">
                      {item.analysis.metrics.commsFractionPct}%
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-accent-green)] font-semibold">
                      {item.analysis.metrics.spacFractionPct}%
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-text)]">
                      {item.analysis.metrics.longestContinuousSpacHours}h
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-accent-red)] font-semibold">
                      {item.analysis.metrics.longestContinuousDarknessHours}h
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-accent-green)] font-semibold">
                      {item.analysis.metrics.avgElectricalPowerKw.toFixed(2)} kW
                    </td>
                    <td className="py-3 pr-4 text-[var(--selene-text-secondary)]">
                      {item.site.slope_deg.toFixed(1)}° / {item.site.psr_proximity_km.toFixed(1)} km
                    </td>
                    <td className="py-3 pr-4 font-bold text-[var(--selene-text)]">
                      {item.analysis.scoreBreakdown.overallFeasibilityScore.toFixed(1)} / 100
                    </td>
                    <td className="py-3">
                      <EngineeringStatusBadge
                        status={
                          item.analysis.scoreBreakdown
                            .engineeringAssessment as EngineeringAssessmentStatus
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        return activeSubsection === 'charts'
          ? [chartsSection, matrixSection]
          : [matrixSection, chartsSection];
      })()}

      {/* Integration Slot for External Candidate Site Catalogs */}
      <DatasetIntegrationSlot
        domain="LANDING_SITE_CATALOG"
        activeDatabaseCount={sites.length}
        activeSourceLabel={`SQLite landing_sites table (${sites.length} verified records across ARTEMIS, APOLLO, CLPS, INTERNATIONAL)`}
      />
    </div>
  );
}
