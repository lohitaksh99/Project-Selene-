'use client';

import React, { useMemo, useState } from 'react';
import LunarGlobe from '../three/LunarGlobe';
import Lunar2DMapCanvas from '../three/Lunar2DMapCanvas';
import HorizonPolarRadar from '../hud/HorizonPolarRadar';
import ResizableInspector from '../navigation/ResizableInspector';
import type {
  LandingSiteRecord,
  LandingSiteStatus,
  MissionCategory,
} from '@/server/db/database';
import type { LunarShaderMode } from '@/lib/store/useSeleneStore';
import type {
  EngineeringConstraints,
  HorizonCoordinates,
  HorizonMaskSample,
} from '@/lib/astrodynamics/coordinateFrames';
import {
  getSiteStatusDescriptionClient,
  resolveSiteStatusClient,
} from '@/lib/data/datasetAdapters';
import {
  ExpandableTechnicalDrawer,
  SiteStatusBadge,
} from '../editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '../editorial/DatasetIntegrationSlot';
import {
  Bookmark,
  BookmarkCheck,
  Compass,
  Filter,
  Globe,
  Layers,
  PlusCircle,
  Radar,
  Search,
  ShieldAlert,
} from 'lucide-react';

interface ExplorerWorkspaceProps {
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  onSelectSite: (siteId: string) => void;
  onSiteCreated: (newSite: LandingSiteRecord) => void;
  shaderMode: LunarShaderMode;
  onChangeShaderMode: (mode: LunarShaderMode) => void;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
  savedComparisonSiteIds: string[];
  onToggleSavedSite: (siteId: string) => void;
  explorerViewMode: '3d-terrain' | '2d-map' | 'horizon';
  onChangeExplorerViewMode: (mode: '3d-terrain' | '2d-map' | 'horizon') => void;
  horizonProfile: HorizonMaskSample[];
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  constraints: EngineeringConstraints;
  activeSubsection?: string;
  inspectorCollapsed?: boolean;
  onToggleInspectorCollapsed?: () => void;
  inspectorWidthPx?: number;
  onChangeInspectorWidthPx?: (w: number) => void;
  fullscreenViewport?: boolean;
  onNavigateComparison?: () => void;
}

const CATEGORY_FILTERS: { id: 'ALL' | MissionCategory; label: string }[] = [
  { id: 'ALL', label: 'All Programs' },
  { id: 'ARTEMIS', label: 'Artemis III' },
  { id: 'CLPS', label: 'CLPS' },
  { id: 'APOLLO', label: 'Apollo' },
  { id: 'INTERNATIONAL', label: 'International' },
  { id: 'CUSTOM', label: 'Custom' },
];

const STATUS_FILTERS: { id: 'ALL' | LandingSiteStatus; label: string }[] = [
  { id: 'ALL', label: 'All Classifications' },
  { id: 'CANDIDATE_REGION', label: 'Candidate Regions' },
  { id: 'CONFIRMED_LANDING', label: 'Confirmed Landings' },
  { id: 'HISTORICAL_LANDING', label: 'Historical Landings' },
  { id: 'PLANNED_TARGET', label: 'Planned Targets' },
  { id: 'CUSTOM_COORDINATES', label: 'Custom Coordinates' },
];

export default function ExplorerWorkspace({
  sites,
  activeSite,
  onSelectSite,
  onSiteCreated,
  shaderMode,
  onChangeShaderMode,
  subSolarLatDeg,
  subSolarLonDeg,
  savedComparisonSiteIds,
  onToggleSavedSite,
  explorerViewMode,
  onChangeExplorerViewMode,
  horizonProfile,
  solarHorizon,
  earthHorizon,
  constraints,
  activeSubsection = '3d-terrain',
  inspectorCollapsed = false,
  onToggleInspectorCollapsed,
  inspectorWidthPx = 340,
  onChangeInspectorWidthPx,
  fullscreenViewport = false,
  onNavigateComparison,
}: ExplorerWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MissionCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LandingSiteStatus>('ALL');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('-88.25');
  const [customLon, setCustomLon] = useState('84.50');
  const [customElev, setCustomElev] = useState('1.95');
  const [customCrater, setCustomCrater] = useState('Shoemaker–Faustini Saddle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inferCategory = (site: LandingSiteRecord): MissionCategory => {
    if (site.mission_category) return site.mission_category;
    if (!site.is_preset || site.id.startsWith('custom')) return 'CUSTOM';
    if (site.id.startsWith('apollo')) return 'APOLLO';
    if (site.id.startsWith('clps')) return 'CLPS';
    if (site.id.startsWith('isro') || site.id.startsWith('cnsa') || site.id.startsWith('jaxa'))
      return 'INTERNATIONAL';
    return 'ARTEMIS';
  };

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const cat = inferCategory(site);
      const status = resolveSiteStatusClient(site);
      if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        site.name.toLowerCase().includes(q) ||
        site.designation.toLowerCase().includes(q) ||
        site.crater_name.toLowerCase().includes(q) ||
        site.description.toLowerCase().includes(q)
      );
    });
  }, [sites, categoryFilter, statusFilter, searchQuery]);

  const handleCreateCustomSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = customName.trim();
    const latNum = Number(customLat);
    const lonNum = Number(customLon);
    const elevNum = Number(customElev);

    if (!trimmedName) {
      setErrorMsg('Please enter a designation name for the custom landing site.');
      return;
    }
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMsg('Selenographic Boundary Violation: Latitude must satisfy -90.0° <= φ <= +90.0°.');
      return;
    }
    if (Number.isNaN(lonNum) || lonNum < -180 || lonNum > 360) {
      setErrorMsg('Longitude must satisfy -180.0° <= λ <= +360.0°.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          latitude: latNum,
          longitude: lonNum,
          elevation_km: Number.isNaN(elevNum) ? 1.8 : elevNum,
          crater_name: customCrater.trim() || 'Lunar Custom Survey Sector',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setErrorMsg(json.data?.error || 'Failed to register custom landing site.');
      } else if (json.data?.site) {
        onSiteCreated(json.data.site);
        setCustomName('');
        setShowCustomForm(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error registering site.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatLat = (lat: number) =>
    lat < 0 ? `${Math.abs(lat).toFixed(2)}°S` : `${lat.toFixed(2)}°N`;

  const isActiveSaved = savedComparisonSiteIds.includes(activeSite.id);
  const effectiveViewMode =
    activeSubsection === '2d-map' || activeSubsection === 'horizon' || activeSubsection === '3d-terrain'
      ? activeSubsection
      : explorerViewMode;

  return (
    <div className="space-y-4 min-w-0">
      {/* Compact Top Viewport Bar — Immediate Map-First Focus Above the Fold */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono min-w-0">
          <span className="font-bold text-[var(--selene-text)] truncate">{activeSite.name}</span>
          <span className="text-[var(--selene-text-muted)] tabular-nums">
            {formatLat(activeSite.latitude)} · {activeSite.longitude.toFixed(2)}°E
          </span>
          <SiteStatusBadge site={activeSite} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Viewport Mode Segmented Bar */}
          <div className="flex items-center gap-1 p-0.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
            <button
              type="button"
              onClick={() => onChangeExplorerViewMode('3d-terrain')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors ${
                effectiveViewMode === '3d-terrain'
                  ? 'bg-[var(--selene-accent-solar)] text-white font-bold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Terrain</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeExplorerViewMode('2d-map')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors ${
                effectiveViewMode === '2d-map'
                  ? 'bg-[var(--selene-accent-earth)] text-[var(--selene-bg)] font-bold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Map</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeExplorerViewMode('horizon')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors ${
                effectiveViewMode === 'horizon'
                  ? 'bg-[var(--selene-accent-green)] text-[var(--selene-bg)] font-bold'
                  : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              <span>360° Horizon</span>
            </button>
          </div>

          {onNavigateComparison && (
            <button
              type="button"
              onClick={onNavigateComparison}
              className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)]"
            >
              Compare ({savedComparisonSiteIds.length}) →
            </button>
          )}
        </div>
      </div>

      {/* 70%+ Interactive Viewport Stage + 30% Resizable/Collapsible Right Inspector */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch min-w-0">
        <div className="flex-1 min-w-0">
          {effectiveViewMode === '3d-terrain' && (
            <LunarGlobe
              sites={sites}
              activeSiteId={activeSite.id}
              onSelectSite={onSelectSite}
              shaderMode={shaderMode}
              onChangeShaderMode={onChangeShaderMode}
              subSolarLatDeg={subSolarLatDeg}
              subSolarLonDeg={subSolarLonDeg}
            />
          )}

          {effectiveViewMode === '2d-map' && (
            <Lunar2DMapCanvas
              sites={sites}
              activeId={activeSite.id}
              onSelectId={onSelectSite}
              defaultProjection={activeSite.latitude <= -60 ? 'SP' : 'EQ'}
            />
          )}

          {effectiveViewMode === 'horizon' && (
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5">
              <HorizonPolarRadar
                horizonProfile={horizonProfile}
                solarHorizon={solarHorizon}
                earthHorizon={earthHorizon}
                minSolarElevationDeg={constraints.minSolarElevationDeg}
                minEarthElevationDeg={constraints.minEarthElevationDeg}
              />
            </div>
          )}
        </div>

        {/* Resizable & Collapsible Right Inspector */}
        {!fullscreenViewport && (
          <ResizableInspector
            title="Site Reconnaissance Dossier"
            collapsed={inspectorCollapsed}
            onToggleCollapsed={() => onToggleInspectorCollapsed?.()}
            widthPx={inspectorWidthPx}
            onChangeWidthPx={(w) => onChangeInspectorWidthPx?.(w)}
          >
            {/* Dossier Header */}
            <div className="space-y-2 pb-3 border-b border-[var(--selene-border)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-bold text-[var(--selene-accent-solar)]">
                    {activeSite.designation} · {inferCategory(activeSite)}
                  </div>
                  <h2 className="text-lg font-extrabold text-[var(--selene-text)] leading-tight">
                    {activeSite.name}
                  </h2>
                  <div className="text-xs font-mono text-[var(--selene-text-muted)] truncate">
                    {activeSite.crater_name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSavedSite(activeSite.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono border shrink-0 transition-colors ${
                    isActiveSaved
                      ? 'bg-[var(--selene-accent-earth)]/15 border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-bold'
                      : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                  }`}
                >
                  {isActiveSaved ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
              <SiteStatusBadge site={activeSite} showTooltip />
            </div>

            {/* Key Selenographic Metrics */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">COORDS (MOON_ME)</div>
                <div className="font-bold mt-0.5">
                  {formatLat(activeSite.latitude)}, {activeSite.longitude.toFixed(2)}°E
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">LOLA ELEVATION</div>
                <div className="font-bold text-[var(--selene-accent-earth)] mt-0.5">
                  {activeSite.elevation_km >= 0 ? '+' : ''}
                  {activeSite.elevation_km.toFixed(2)} km
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">MEAN SLOPE</div>
                <div className="font-bold text-[var(--selene-accent-green)] mt-0.5">
                  {activeSite.slope_deg.toFixed(1)}° (≤{(constraints.maxSlopeDeg ?? 10).toFixed(1)}°)
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">PSR PROXIMITY</div>
                <div className="font-bold text-[var(--selene-accent-amber)] mt-0.5">
                  {activeSite.psr_proximity_km.toFixed(1)} km
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs leading-relaxed">
              <p className="text-[var(--selene-text-secondary)]">{activeSite.description}</p>
              <p className="text-[var(--selene-text-muted)]">
                <strong className="text-[var(--selene-text)]">Classification:</strong>{' '}
                {getSiteStatusDescriptionClient(activeSite)}
              </p>
              <p className="text-[11px] font-mono text-[var(--selene-text-muted)] border-t border-[var(--selene-border)] pt-2">
                PROVENANCE: Surface DEM is LOLA LDEM (R₀ = 1737.4 km); 3D Globe procedural relief is modeled separately from LROC WAC albedo.
              </p>
            </div>

            {/* Collapsible Custom Pin Registration */}
            <div className="border-t border-[var(--selene-border)] pt-3">
              <button
                type="button"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="w-full py-2 px-3 text-xs font-mono font-bold bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-solar)] flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[var(--selene-accent-solar)]" />
                  <span>Register Custom Pin</span>
                </span>
                <span>{showCustomForm ? '−' : '+'}</span>
              </button>

              {showCustomForm && (
                <form onSubmit={handleCreateCustomSite} className="mt-3 space-y-2.5">
                  {errorMsg && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 p-2.5 bg-[var(--selene-accent-red)]/12 border border-[var(--selene-accent-red)] text-xs text-[var(--selene-accent-red)]"
                    >
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  <input
                    id="custom-site-name"
                    aria-label="Custom Site Designation Name"
                    type="text"
                    placeholder="Site designation name..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      id="custom-site-lat"
                      aria-label="Latitude Degrees"
                      type="number"
                      step="0.01"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      className="px-2 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] tabular-nums"
                    />
                    <input
                      id="custom-site-lon"
                      aria-label="Longitude Degrees East"
                      type="number"
                      step="0.01"
                      value={customLon}
                      onChange={(e) => setCustomLon(e.target.value)}
                      className="px-2 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] tabular-nums"
                    />
                    <input
                      id="custom-site-elev"
                      aria-label="LOLA Elevation km"
                      type="number"
                      step="0.05"
                      value={customElev}
                      onChange={(e) => setCustomElev(e.target.value)}
                      className="px-2 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] tabular-nums"
                    />
                  </div>
                  <input
                    id="custom-site-crater"
                    aria-label="Geomorphic Region or Crater Feature"
                    type="text"
                    value={customCrater}
                    onChange={(e) => setCustomCrater(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono font-bold uppercase bg-[var(--selene-accent-solar)] text-white disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Registering...' : 'Save Custom Pin'}</span>
                  </button>
                </form>
              )}
            </div>
          </ResizableInspector>
        )}
      </div>

      {/* Collapsible Site Catalog Tray (automatically expanded when contextual sidebar selects Site Catalog) */}
      {!fullscreenViewport && (
        <ExpandableTechnicalDrawer
          title={`Lunar Surface Catalog (${filteredSites.length} of ${sites.length} Locations)`}
          subtitle="Filter verified landings, Artemis III candidate regions, and custom coordinates."
          badgeText={`${savedComparisonSiteIds.length} Saved`}
          defaultOpen={activeSubsection === 'catalog'}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[var(--selene-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Search Lunar Landing Sites"
                  placeholder="Search by site name, crater, designation, or mission..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                />
              </div>

              <select
                aria-label="Filter by Site Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | LandingSiteStatus)}
                className="px-2.5 py-2 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
              >
                {STATUS_FILTERS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[var(--selene-text-muted)] mr-1" />
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
                    categoryFilter === cat.id
                      ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-bold'
                      : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {filteredSites.length === 0 ? (
              <div className="p-6 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-center space-y-2">
                <div className="text-sm font-bold">No landing sites match your active filters</div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-accent-solar)] text-white"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredSites.map((site) => {
                  const selected = site.id === activeSite.id;
                  const isSaved = savedComparisonSiteIds.includes(site.id);
                  return (
                    <article
                      key={site.id}
                      className={`p-3.5 border flex flex-col justify-between gap-2.5 ${
                        selected
                          ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-solar)]'
                          : 'bg-[var(--selene-surface)] border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectSite(site.id)}
                        className="text-left w-full space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                          <span className="text-[var(--selene-accent-earth)] font-bold">
                            {site.designation}
                          </span>
                          <span className="text-[var(--selene-text-muted)]">
                            {inferCategory(site)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--selene-text)]">{site.name}</h3>
                        <p className="text-xs text-[var(--selene-text-muted)]">{site.crater_name}</p>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--selene-text-secondary)]">
                          {formatLat(site.latitude)} · {site.longitude.toFixed(2)}°E ·{' '}
                          {site.elevation_km >= 0 ? '+' : ''}
                          {site.elevation_km.toFixed(2)} km
                        </div>
                      </button>

                      <div className="pt-2 border-t border-[var(--selene-border)] flex items-center justify-between text-xs font-mono">
                        <SiteStatusBadge site={site} />
                        <button
                          type="button"
                          onClick={() => onToggleSavedSite(site.id)}
                          className={`flex items-center gap-1 px-2 py-1 border ${
                            isSaved
                              ? 'border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-bold'
                              : 'border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <BookmarkCheck className="w-3 h-3" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3 h-3" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <DatasetIntegrationSlot
              domain="LANDING_SITE_CATALOG"
              activeDatabaseCount={sites.length}
              activeSourceLabel="SQLite `landing_sites` table with IAU MOON_ME coordinates"
            />
          </div>
        </ExpandableTechnicalDrawer>
      )}
    </div>
  );
}
