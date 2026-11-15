'use client';

import React from 'react';
import type { LandingSiteRecord } from '@/server/db/database';
import type { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import type { MoonTrekCategory, MoonTrekGisLayer } from '@/lib/store/useSeleneStore';
import MoonTrekViewer from '@/components/three/MoonTrekViewer';
import LayerControl from '@/components/three/LayerControl';
import ScientificRechartsDeck from '@/components/charts/ScientificRechartsDeck';
import DatasetIntegrationSlot from '@/components/editorial/DatasetIntegrationSlot';
import { ExpandableTechnicalDrawer } from '@/components/editorial/WorkspacePrimitives';

interface MoonTrekWorkspaceProps {
  layers: MoonTrekGisLayer[];
  activeCategory: MoonTrekCategory;
  onSelectCategory: (cat: MoonTrekCategory) => void;
  onToggleVisibility: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  highlightedLayerId: string | null;
  onSelectHighlight: (id: string | null) => void;
  projection: 'stereographic' | 'globe3d';
  onChangeProjection: (proj: 'stereographic' | 'globe3d') => void;
  showGraticule: boolean;
  onToggleGraticule: (show: boolean) => void;
  solarAzimuthDeg: number;
  onChangeSolarAzimuth: (deg: number) => void;
  onApplyPreset: (presetId: string) => void;
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  onSelectSite: (siteId: string) => void;
  timelineAnalysis: MissionTimelineAnalysis;
  datasetsCount: number;
  activeSubsection?: string;
  fullscreenViewport?: boolean;
  onOpenDataHub: () => void;
}

const SURVEY_PRESETS = [
  {
    id: 'full-mission',
    label: 'Full Polar Survey',
    desc: 'LROC WAC + LOLA LDEM + PSR Cold Traps + LEND + Slope Hazard',
  },
  {
    id: 'topographic-screening',
    label: 'Topographic Screening',
    desc: 'LROC WAC + LOLA LDEM + 3×3 Slope + LDEC Spot Support',
  },
  {
    id: 'solar-illumination',
    label: 'Solar Grazing & PSRs',
    desc: 'LROC WAC + LOLA LDEM + 18.6-yr LPSR Cold Traps',
  },
  {
    id: 'cryogenic-volatile',
    label: 'Cryogenic Volatile Science',
    desc: 'LPSR + Diviner T_bol (<110 K / <40 K) + LEND Neutron H',
  },
  {
    id: 'slope-hazard',
    label: 'Slope & Control Hazard',
    desc: 'Geodetically Controlled NAC + LDSM Slope + LDEC Support',
  },
];

export default function MoonTrekWorkspace({
  layers,
  activeCategory,
  onSelectCategory,
  onToggleVisibility,
  onChangeOpacity,
  highlightedLayerId,
  onSelectHighlight,
  projection,
  onChangeProjection,
  showGraticule,
  onToggleGraticule,
  solarAzimuthDeg,
  onChangeSolarAzimuth,
  onApplyPreset,
  sites,
  activeSite,
  onSelectSite,
  timelineAnalysis,
  datasetsCount,
  activeSubsection = 'layers',
  fullscreenViewport = false,
  onOpenDataHub,
}: MoonTrekWorkspaceProps) {
  return (
    <div className="space-y-4 min-w-0">
      {/* Compact Cartographic Projection & Dataset Separation Notice */}
      {!fullscreenViewport && (
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <span className="text-[var(--selene-text-secondary)]">
            <strong className="text-[var(--selene-accent-earth)]">CARTOGRAPHIC DATUM:</strong>{' '}
            {projection === 'stereographic'
              ? 'IAU2000:30120 South Polar Stereographic (80°S–90°S · PIXEL_IS_AREA)'
              : 'IAU_MOON_ME 3D Orthographic Sphere (R₀ = 1737.4 km)'}
          </span>
          <span className="text-[var(--selene-text-muted)]">
            LOLA LDEM elevation matrices and LROC optical imagery are tracked separately with explicit geodetic control flags.
          </span>
        </div>
      )}

      {/* Survey Presets Quick Bar when Presets subsection is active */}
      {activeSubsection === 'presets' && !fullscreenViewport && (
        <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 space-y-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--selene-text-muted)]">
            Cartographic Survey Layer Presets
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
            {SURVEY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.id)}
                className="text-left p-3 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)] transition-colors"
              >
                <div className="text-xs font-mono font-bold text-[var(--selene-text)]">
                  {preset.label}
                </div>
                <div className="text-[11px] text-[var(--selene-text-muted)] mt-1 leading-snug">
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Cartographic Canvas-First Stage: Left Layer Dock (30%) + Full-Height Moon Trek Viewport (70%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-4 xl:col-span-3 min-w-0">
          <LayerControl
            layers={layers}
            activeCategory={activeCategory}
            onSelectCategory={onSelectCategory}
            onToggleVisibility={onToggleVisibility}
            onChangeOpacity={onChangeOpacity}
            highlightedLayerId={highlightedLayerId}
            onSelectHighlight={onSelectHighlight}
            projection={projection}
            onChangeProjection={onChangeProjection}
            showGraticule={showGraticule}
            onToggleGraticule={onToggleGraticule}
            solarAzimuthDeg={solarAzimuthDeg}
            onChangeSolarAzimuth={onChangeSolarAzimuth}
          />
        </div>
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          <MoonTrekViewer
            layers={layers}
            highlightedLayerId={highlightedLayerId}
            projection={projection}
            showGraticule={showGraticule}
            solarAzimuthDeg={solarAzimuthDeg}
            sites={sites}
            activeSiteId={activeSite.id}
            onSelectSite={onSelectSite}
          />
        </div>
      </div>

      {/* Collapsible Bottom Elevation Transect & LOLA Provenance Tray */}
      {!fullscreenViewport && (
        <ExpandableTechnicalDrawer
          title="Elevation Transect & LOLA LDEM Provenance"
          subtitle="Cross-crater altimetry profile relative to R₀ = 1737.4 km (MOON_ME DE421) — LOLA elevation data is never substituted for LROC optical imagery."
          badgeText={`${activeSite.designation} · ${activeSite.elevation_km.toFixed(2)} km`}
          defaultOpen={activeSubsection === 'profile'}
        >
          <div className="space-y-4">
            <ScientificRechartsDeck
              siteLatDeg={activeSite.latitude}
              siteLonDeg={activeSite.longitude}
              timelineAnalysis={timelineAnalysis}
              defaultTab="elevation-profile"
            />
            <DatasetIntegrationSlot
              domain="TERRAIN_ELEVATION_DEM"
              activeDatabaseCount={datasetsCount}
              activeSourceLabel="LRO LOLA LDEM_80S v1.4 GDS (5m/px) & LROC WAC CDR v2.1"
              onOpenDataHub={onOpenDataHub}
            />
          </div>
        </ExpandableTechnicalDrawer>
      )}
    </div>
  );
}
