'use client';

import React, { useMemo, useState } from 'react';
import Lunar2DMapCanvas from '../three/Lunar2DMapCanvas';
import ResizableInspector from '../navigation/ResizableInspector';
import {
  CLASSIFICATION_META,
  LUNAR_SURFACE_LOCATIONS,
  LunarLocationClassification,
  LunarSurfaceLocationEntry,
  LunarRegionZone,
  summarizeLunarBasesCatalog,
} from '@/lib/data/lunarBasesCatalog';
import { ExpandableTechnicalDrawer } from '../editorial/WorkspacePrimitives';
import {
  CheckSquare,
  Compass,
  Globe,
  Radar,
  Search,
  ShieldAlert,
  Square,
} from 'lucide-react';

interface LunarBasesWorkspaceProps {
  activeSiteId: string;
  onSelectSeleneSite: (siteId: string) => void;
  onNavigateTo3DGlobe: (siteId: string) => void;
  onNavigateToSitePhysics: (siteId: string) => void;
  activeSubsection?: string;
  inspectorCollapsed?: boolean;
  onToggleInspectorCollapsed?: () => void;
  inspectorWidthPx?: number;
  onChangeInspectorWidthPx?: (w: number) => void;
  fullscreenViewport?: boolean;
}

const REGION_ZONE_LABELS: Record<LunarRegionZone | 'ALL', string> = {
  ALL: 'All Lunar Zones',
  SOUTH_POLE: 'South Polar Region (60°S–90°S)',
  EQUATORIAL_NEARSIDE: 'Equatorial Nearside Maria',
  MID_LATITUDE_NEARSIDE: 'Mid-Latitude Nearside',
  FARSIDE_SPA: 'Lunar Farside / SPA Basin',
  NORTH_POLE: 'North Polar Region (75°N–90°N)',
};

export default function LunarBasesWorkspace({
  activeSiteId,
  onSelectSeleneSite,
  onNavigateTo3DGlobe,
  onNavigateToSitePhysics,
  activeSubsection = 'map-overview',
  inspectorCollapsed = false,
  onToggleInspectorCollapsed,
  inspectorWidthPx = 340,
  onChangeInspectorWidthPx,
  fullscreenViewport = false,
}: LunarBasesWorkspaceProps) {
  const catalogSummary = useMemo(() => summarizeLunarBasesCatalog(), []);

  const [selectedBaseId, setSelectedBaseId] = useState<string>(() => {
    const matched = LUNAR_SURFACE_LOCATIONS.find(
      (item) => item.linkedSeleneSiteId === activeSiteId
    );
    return matched ? matched.id : 'base-cand-shackleton-rim';
  });

  const [classificationFilter, setClassificationFilter] = useState<
    LunarLocationClassification | 'ALL'
  >('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<LunarRegionZone | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [southPolarPlanningMode, setSouthPolarPlanningMode] = useState<boolean>(false);
  const [mapProjection, setMapProjection] = useState<'EQ' | 'SP' | 'NP'>('EQ');

  const [comparisonIds, setComparisonIds] = useState<string[]>([
    'base-cand-shackleton-rim',
    'concept-artemis-base-camp-shackleton',
    'base-cand-ilrs-south-pole',
    'infra-shackleton-solar-towers',
    'mod-clps-im1-odysseus',
  ]);

  const agencies = useMemo(() => {
    return Array.from(new Set(LUNAR_SURFACE_LOCATIONS.map((item) => item.countryOrAgency))).sort();
  }, []);

  const filteredLocations = useMemo(() => {
    return LUNAR_SURFACE_LOCATIONS.filter((loc) => {
      if (southPolarPlanningMode && loc.regionZone !== 'SOUTH_POLE') return false;
      if (
        classificationFilter === 'ALL' &&
        activeSubsection === 'infrastructure' &&
        loc.classification !== 'PROPOSED_INFRASTRUCTURE' &&
        loc.classification !== 'CONCEPTUAL_BASE_DESIGN'
      ) {
        return false;
      }
      if (classificationFilter !== 'ALL' && loc.classification !== classificationFilter) {
        return false;
      }
      if (agencyFilter !== 'ALL' && loc.countryOrAgency !== agencyFilter) return false;
      if (regionFilter !== 'ALL' && loc.regionZone !== regionFilter) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const hay = `${loc.name} ${loc.shortLabel} ${loc.missionOrProgram} ${loc.classificationBadge} ${loc.countryOrAgency} ${loc.scientificSummary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    southPolarPlanningMode,
    classificationFilter,
    activeSubsection,
    agencyFilter,
    regionFilter,
    searchQuery,
  ]);

  const activeLocation: LunarSurfaceLocationEntry = useMemo(() => {
    return (
      LUNAR_SURFACE_LOCATIONS.find((item) => item.id === selectedBaseId) ??
      filteredLocations[0] ??
      LUNAR_SURFACE_LOCATIONS[0]!
    );
  }, [selectedBaseId, filteredLocations]);

  const comparisonLocations = useMemo(() => {
    return LUNAR_SURFACE_LOCATIONS.filter((loc) => comparisonIds.includes(loc.id));
  }, [comparisonIds]);

  const handleSelectLocation = (id: string) => {
    setSelectedBaseId(id);
    const found = LUNAR_SURFACE_LOCATIONS.find((item) => item.id === id);
    if (found?.linkedSeleneSiteId) {
      onSelectSeleneSite(found.linkedSeleneSiteId);
    }
  };

  const toggleComparisonId = (id: string) => {
    setComparisonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setClassificationFilter('ALL');
    setAgencyFilter('ALL');
    setRegionFilter('ALL');
    setSearchQuery('');
    setSouthPolarPlanningMode(false);
    setMapProjection('EQ');
  };

  const activeClassMeta = CLASSIFICATION_META[activeLocation.classification];

  return (
    <div className="space-y-4 min-w-0">
      {/* Compact Horizontal Projection, Classification & Focus Bar — Map Immediately Above the Fold */}
      <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
            <span className="font-bold text-[var(--selene-text)]">
              Lunar Bases &amp; Infrastructure Map
            </span>
            <span className="text-[var(--selene-text-muted)] tabular-nums">
              {filteredLocations.length}/{LUNAR_SURFACE_LOCATIONS.length} visible
            </span>
            <span className="hidden xl:inline text-[var(--selene-accent-gold)]">
              · Verified landings distinguished from conceptual architectures
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !southPolarPlanningMode;
              setSouthPolarPlanningMode(next);
              if (next) {
                setRegionFilter('SOUTH_POLE');
                setSelectedBaseId('base-cand-shackleton-rim');
                setMapProjection('SP');
              } else {
                setRegionFilter('ALL');
                setMapProjection('EQ');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold border transition-colors ${
              southPolarPlanningMode
                ? 'bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] border-[var(--selene-accent-gold)]'
                : 'bg-[var(--selene-surface-alt)] text-[var(--selene-accent-gold)] border-[var(--selene-border)] hover:border-[var(--selene-accent-gold)]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>{southPolarPlanningMode ? 'South Polar Focus: ON' : 'South Polar Focus'}</span>
          </button>
        </div>

        {/* Interactive Classification Filter Row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono pt-2 border-t border-[var(--selene-border)]">
          {(Object.keys(CLASSIFICATION_META) as LunarLocationClassification[]).map((cls) => {
            const meta = CLASSIFICATION_META[cls];
            const count = catalogSummary.byClassification[cls] || 0;
            const isSelected = classificationFilter === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() =>
                  setClassificationFilter(classificationFilter === cls ? 'ALL' : cls)
                }
                style={{
                  borderColor: isSelected ? meta.colorHex : 'var(--selene-border)',
                  backgroundColor: isSelected ? `${meta.colorHex}20` : 'var(--selene-surface-alt)',
                  color: 'var(--selene-text)',
                }}
                className="px-2 py-1 border transition-colors flex items-center gap-1.5"
              >
                <span
                  style={{ backgroundColor: meta.colorHex }}
                  className="w-2 h-2 inline-block shrink-0"
                />
                <span>{meta.shortTag}</span>
                <span className="font-bold tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leading Interactive Lunar Map + Collapsible/Resizable Base Dossier Inspector */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch min-w-0">
        <div className="flex-1 min-w-0">
          <Lunar2DMapCanvas
            locations={filteredLocations}
            activeId={activeLocation.id}
            onSelectId={handleSelectLocation}
            defaultProjection="EQ"
            controlledProjection={mapProjection}
            onProjectionChange={setMapProjection}
          />
        </div>

        {!fullscreenViewport && (
          <ResizableInspector
            title="Station & Concept Dossier"
            collapsed={inspectorCollapsed}
            onToggleCollapsed={() => onToggleInspectorCollapsed?.()}
            widthPx={inspectorWidthPx}
            onChangeWidthPx={(w) => onChangeInspectorWidthPx?.(w)}
          >
            <div className="border-b border-[var(--selene-border)] pb-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  style={{
                    borderColor: activeClassMeta.colorHex,
                    backgroundColor: `${activeClassMeta.colorHex}18`,
                    color: 'var(--selene-text)',
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-mono font-bold border uppercase"
                >
                  <span
                    style={{ backgroundColor: activeClassMeta.colorHex }}
                    className="w-2 h-2 inline-block shrink-0"
                  />
                  <span>{activeClassMeta.label}</span>
                </span>
                <span className="text-xs font-mono text-[var(--selene-accent-earth)] font-semibold">
                  {activeLocation.shortLabel}
                </span>
              </div>

              <h2 className="text-lg font-bold text-[var(--selene-text)] leading-tight">
                {activeLocation.name}
              </h2>
              <div className="text-xs font-mono text-[var(--selene-text-muted)]">
                {activeLocation.classificationBadge} · {activeLocation.countryOrAgency}
              </div>
            </div>

            <div className="p-2.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[11px] font-mono space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[var(--selene-accent-gold)]">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Verified vs. Conceptual Status</span>
              </div>
              <p className="text-[var(--selene-text-secondary)] leading-relaxed">
                {activeClassMeta.description}
              </p>
              <div className="text-[var(--selene-accent-earth)]">
                {activeLocation.missionOrProgram} ({activeLocation.dateOrWindow})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">COORDS</div>
                <div className="font-bold mt-0.5">
                  {activeLocation.latitude < 0
                    ? `${Math.abs(activeLocation.latitude).toFixed(2)}°S`
                    : `${activeLocation.latitude.toFixed(2)}°N`}
                  , {activeLocation.longitude.toFixed(2)}°E
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">LOLA ELEV</div>
                <div className="font-bold text-[var(--selene-accent-earth)] mt-0.5">
                  {activeLocation.elevationKm >= 0
                    ? `+${activeLocation.elevationKm.toFixed(2)}`
                    : activeLocation.elevationKm.toFixed(2)}{' '}
                  km
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">MEAN SLOPE</div>
                <div className="font-bold text-[var(--selene-accent-green)] mt-0.5">
                  {activeLocation.meanSlopeDeg.toFixed(1)}°
                </div>
              </div>
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-2.5">
                <div className="text-[10px] text-[var(--selene-text-muted)]">SUN / DTE</div>
                <div className="font-bold text-[var(--selene-accent-gold)] mt-0.5">
                  {activeLocation.meanIlluminationPct}% / {activeLocation.dteVisibilityPct}%
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs leading-relaxed">
              <p className="text-[var(--selene-text-secondary)]">
                {activeLocation.scientificSummary}
              </p>
              <p className="text-[var(--selene-text-muted)]">
                {activeLocation.engineeringAndHabitatContext}
              </p>
              <div className="text-[11px] font-mono text-[var(--selene-text-muted)] pt-2 border-t border-[var(--selene-border)]">
                Provenance: {activeLocation.measurementProvenance} · {activeLocation.sourceAttribution}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--selene-border)] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleComparisonId(activeLocation.id)}
                className={`w-full py-2 px-3 text-xs font-mono font-bold border flex items-center justify-center gap-2 ${
                  comparisonIds.includes(activeLocation.id)
                    ? 'bg-[var(--selene-accent-green)]/15 text-[var(--selene-accent-green)] border-[var(--selene-accent-green)]'
                    : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text)] border-[var(--selene-border)]'
                }`}
              >
                {comparisonIds.includes(activeLocation.id) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>In Matrix ({comparisonIds.length})</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Add to Matrix</span>
                  </>
                )}
              </button>

              {activeLocation.linkedSeleneSiteId && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTo3DGlobe(activeLocation.linkedSeleneSiteId!)}
                    className="py-2 px-2.5 text-xs font-mono font-bold bg-[var(--selene-accent-solar)] text-white flex items-center justify-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>3D Globe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToSitePhysics(activeLocation.linkedSeleneSiteId!)}
                    className="py-2 px-2.5 text-xs font-mono font-bold bg-[var(--selene-surface-alt)] border border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] flex items-center justify-center gap-1"
                  >
                    <Radar className="w-3.5 h-3.5" />
                    <span>Site Physics</span>
                  </button>
                </div>
              )}
            </div>
          </ResizableInspector>
        )}
      </div>

      {/* Expandable Catalog & Infrastructure Comparison Drawer */}
      {!fullscreenViewport && (
        <ExpandableTechnicalDrawer
          title={`Base Catalog & Infrastructure Matrix (${filteredLocations.length} Records · ${comparisonLocations.length} Compared)`}
          subtitle="Filter by agency, region, or operational tier and compare surface outposts side-by-side."
          defaultOpen={activeSubsection === 'stations' || activeSubsection === 'infrastructure'}
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[var(--selene-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mission, crater, agency..."
                  aria-label="Search lunar bases and landing sites"
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                />
              </div>
              <select
                aria-label="Filter by Country or Agency"
                value={agencyFilter}
                onChange={(e) => setAgencyFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
              >
                <option value="ALL">All Agencies / Countries</option>
                {agencies.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by Lunar Region Zone"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value as LunarRegionZone | 'ALL')}
                className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
              >
                {(Object.keys(REGION_ZONE_LABELS) as Array<LunarRegionZone | 'ALL'>).map((z) => (
                  <option key={z} value={z}>
                    {REGION_ZONE_LABELS[z]}
                  </option>
                ))}
              </select>
              {(classificationFilter !== 'ALL' ||
                agencyFilter !== 'ALL' ||
                regionFilter !== 'ALL' ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)]"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {filteredLocations.length === 0 ? (
              <div className="p-6 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-center space-y-2">
                <div className="text-sm font-mono font-bold">
                  No cataloged lunar bases match the current filters.
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-accent-earth)] text-[var(--selene-bg)]"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLocations.map((loc) => {
                  const meta = CLASSIFICATION_META[loc.classification];
                  const isSelected = loc.id === activeLocation.id;
                  const isCompared = comparisonIds.includes(loc.id);
                  return (
                    <article
                      key={loc.id}
                      className={`p-3.5 border flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-gold)]'
                          : 'bg-[var(--selene-surface)] border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectLocation(loc.id)}
                        className="text-left w-full space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
                          <span className="font-bold" style={{ color: meta.colorHex }}>
                            {meta.shortTag}
                          </span>
                          <span className="text-[var(--selene-text-muted)]">
                            {loc.countryOrAgency}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[var(--selene-text)]">{loc.name}</h4>
                        <p className="text-xs text-[var(--selene-text-secondary)] line-clamp-2">
                          {loc.scientificSummary}
                        </p>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--selene-text-muted)]">
                          {loc.latitude.toFixed(1)}°, {loc.longitude.toFixed(1)}° · Sun{' '}
                          {loc.meanIlluminationPct}% · DTE {loc.dteVisibilityPct}%
                        </div>
                      </button>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--selene-border)] text-[11px] font-mono">
                        <span className="text-[var(--selene-text-muted)]">{loc.dateOrWindow}</span>
                        <button
                          type="button"
                          onClick={() => toggleComparisonId(loc.id)}
                          className={`px-2 py-0.5 border ${
                            isCompared
                              ? 'border-[var(--selene-accent-green)] text-[var(--selene-accent-green)] font-bold'
                              : 'border-[var(--selene-border)] text-[var(--selene-text-secondary)]'
                          }`}
                        >
                          {isCompared ? '✓ Comparing' : '+ Compare'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Side-by-Side Comparison Matrix */}
            <div className="overflow-x-auto border-t border-[var(--selene-border)] pt-4">
              <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[760px]">
                <thead>
                  <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Classification</th>
                    <th className="py-2 pr-3">Coords</th>
                    <th className="py-2 pr-3">LOLA Elev</th>
                    <th className="py-2 pr-3">Slope</th>
                    <th className="py-2 pr-3">Sun %</th>
                    <th className="py-2 pr-3">DTE %</th>
                    <th className="py-2">Diviner T</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--selene-border)]">
                  {comparisonLocations.map((loc) => {
                    const meta = CLASSIFICATION_META[loc.classification];
                    return (
                      <tr key={loc.id} className="hover:bg-[var(--selene-surface-alt)]">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => handleSelectLocation(loc.id)}
                            className="text-left font-bold hover:underline"
                          >
                            {loc.name}
                          </button>
                        </td>
                        <td className="py-2 pr-3" style={{ color: meta.colorHex }}>
                          {meta.shortTag}
                        </td>
                        <td className="py-2 pr-3">
                          {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                        </td>
                        <td className="py-2 pr-3 text-[var(--selene-accent-earth)]">
                          {loc.elevationKm >= 0
                            ? `+${loc.elevationKm.toFixed(2)}`
                            : loc.elevationKm.toFixed(2)}{' '}
                          km
                        </td>
                        <td className="py-2 pr-3">{loc.meanSlopeDeg.toFixed(1)}°</td>
                        <td className="py-2 pr-3 font-bold text-[var(--selene-accent-gold)]">
                          {loc.meanIlluminationPct}%
                        </td>
                        <td className="py-2 pr-3 font-bold text-[var(--selene-accent-earth)]">
                          {loc.dteVisibilityPct}%
                        </td>
                        <td className="py-2 text-[var(--selene-accent-solar)]">
                          {loc.divinerTempRangeK}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ExpandableTechnicalDrawer>
      )}
    </div>
  );
}
