'use client';

import React from 'react';
import {
  MoonTrekCategory,
  MoonTrekGisLayer,
  useSeleneStore,
} from '@/lib/store/useSeleneStore';
import {
  Eye,
  EyeOff,
  Globe,
  Grid,
  Layers,
  ShieldAlert,
  Sparkles,
  Sun,
} from 'lucide-react';

interface LayerControlProps {
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
}

const CATEGORIES: MoonTrekCategory[] = [
  'All',
  'Elevation',
  'Imagery',
  'Illumination',
  'Volatile Science',
  'Crater Maps',
];

const SCIENTIFIC_PRESETS = [
  { id: 'topographic-screening', label: 'Topographic Screening' },
  { id: 'solar-illumination', label: 'Solar Illumination' },
  { id: 'cryogenic-volatile', label: 'Cryogenic & Volatile Prospectivity' },
  { id: 'slope-hazard', label: 'Slope & NAC Hazard' },
  { id: 'full-mission', label: 'Full Mission Stack' },
];

export default function LayerControl({
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
}: LayerControlProps) {
  const { applyMoonTrekPreset } = useSeleneStore();

  const filteredLayers =
    activeCategory === 'All'
      ? layers
      : layers.filter((l) => l.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--selene-border)]">
        <div>
          <h3 className="text-sm font-bold text-[var(--selene-text)]">
            NASA Moon Trek Scientific GIS Stack
          </h3>
          <p className="text-[11px] text-[var(--selene-text-muted)] font-mono">
            PGDA LOLA · LROC WAC/NAC · DIVINER · LEND · LCROSS
          </p>
        </div>
        <span className="text-xs font-mono text-[var(--selene-accent-gold)] font-bold tabular-nums">
          {layers.filter((l) => l.visible).length}/{layers.length} ACTIVE
        </span>
      </div>

      {/* 5 One-Click Scientific Layer Presets */}
      <div className="space-y-1.5 pb-3 border-b border-[var(--selene-border)]">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--selene-accent-gold)] font-semibold uppercase tracking-wider">
          <Layers className="w-3 h-3" />
          <span>ONE-CLICK SCIENTIFIC LAYER PRESETS</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCIENTIFIC_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyMoonTrekPreset(p.id)}
              className="px-2 py-1 text-[11px] font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Projection & Graticule Controls */}
      <div className="space-y-2.5 pb-3 border-b border-[var(--selene-border)]">
        <div className="text-[11px] font-mono text-[var(--selene-text-muted)] font-semibold">
          PROJECTION &amp; SELENOGRAPHIC GRATICULE
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onChangeProjection('stereographic')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border transition-colors text-center leading-tight ${
              projection === 'stereographic'
                ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            <Grid className="w-3.5 h-3.5 shrink-0" />
            <span>Polar Stereo (80°S)</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeProjection('globe3d')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border transition-colors text-center leading-tight ${
              projection === 'globe3d'
                ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>3D Ortho Globe</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label
            htmlFor="moon-trek-graticule-toggle"
            className="text-xs text-[var(--selene-text-secondary)] cursor-pointer font-mono"
          >
            88°S / 85°S / 80°S Graticule
          </label>
          <button
            id="moon-trek-graticule-toggle"
            type="button"
            onClick={() => onToggleGraticule(!showGraticule)}
            className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
              showGraticule
                ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[var(--selene-accent-green)] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)]'
            }`}
          >
            {showGraticule ? 'GRID ON' : 'GRID OFF'}
          </button>
        </div>

        {/* Grazing Solar Light Azimuth Slider */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[var(--selene-text-secondary)]">
              <Sun className="w-3.5 h-3.5 text-[var(--selene-accent-amber)]" />
              <span>Grazing Solar Azimuth</span>
            </span>
            <span className="text-[var(--selene-accent-amber)] tabular-nums font-bold">
              {solarAzimuthDeg.toFixed(0)}° AZ
            </span>
          </div>
          <input
            type="range"
            aria-label="Grazing Solar Light Azimuth"
            min={0}
            max={360}
            step={1}
            value={solarAzimuthDeg}
            onChange={(e) => onChangeSolarAzimuth(Number(e.target.value))}
            className="w-full accent-[var(--selene-accent-amber)] cursor-pointer h-1.5 bg-[var(--selene-surface-alt)]"
          />
        </div>
      </div>

      {/* Segmented Category Filter */}
      <div className="flex flex-wrap gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className={`px-2 py-1 text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
              activeCategory === cat
                ? 'bg-[var(--selene-accent-yellow)] text-[#111111] font-bold'
                : 'text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Layer Stack List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
        {filteredLayers.map((layer) => {
          const isHighlighted = highlightedLayerId === layer.id;
          return (
            <div
              key={layer.id}
              className={`p-3 border transition-colors ${
                isHighlighted
                  ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-earth)]'
                  : layer.visible
                    ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)]'
                    : 'bg-[var(--selene-surface)] border-[var(--selene-border)] opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 shrink-0 border border-[#111111]/20"
                      style={{ backgroundColor: layer.colorSwatch }}
                    />
                    <span className="text-xs font-bold text-[var(--selene-text)] truncate">
                      {layer.name}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--selene-text-muted)] mt-0.5">
                    {layer.shortCode} · {layer.category} · {layer.pgdaProductCode ?? layer.datasetSource}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Highlight ${layer.name}`}
                    onClick={() =>
                      onSelectHighlight(isHighlighted ? null : layer.id)
                    }
                    className={`p-1.5 border text-xs transition-colors ${
                      isHighlighted
                        ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111]'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
                    }`}
                    title="Active Layer Highlight Mode (Enhance Contrast & Crater Rim Vectors)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Toggle visibility for ${layer.name}`}
                    onClick={() => onToggleVisibility(layer.id)}
                    className={`p-1.5 border text-xs transition-colors ${
                      layer.visible
                        ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[var(--selene-accent-green)]'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-[var(--selene-text-secondary)] mt-1.5 leading-relaxed">
                {layer.description}
              </p>

              {layer.geodeticControlWarning && (
                <div className="mt-1.5 flex items-start gap-1.5 p-2 bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[11px] font-mono text-[var(--selene-accent-amber)]">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{layer.geodeticControlWarning}</span>
                </div>
              )}

              {/* Opacity Slider & Legend Range */}
              <div className="mt-2.5 pt-2 border-t border-[var(--selene-border)] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[var(--selene-text-muted)]">LAYER OPACITY</span>
                  <span className="text-[var(--selene-text)] tabular-nums font-semibold">
                    {layer.opacity}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={`Opacity for ${layer.name}`}
                  min={0}
                  max={100}
                  step={1}
                  disabled={!layer.visible}
                  value={layer.opacity}
                  onChange={(e) =>
                    onChangeOpacity(layer.id, Number(e.target.value))
                  }
                  className="w-full accent-[var(--selene-accent-earth)] cursor-pointer h-1.5 bg-[var(--selene-surface)] disabled:opacity-40"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--selene-text-muted)]">
                  <span>MIN: {layer.legendMin}</span>
                  <span>MAX: {layer.legendMax}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
