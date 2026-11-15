'use client';

import React from 'react';
import {
  BookOpen,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  PanelLeft,
  Sun,
} from 'lucide-react';
import type { LandingSiteRecord } from '@/server/db/database';
import type { SeleneThemePreference } from '@/lib/store/useSeleneStore';
import {
  WORKSPACE_REGISTRY,
  type PrimaryWorkspaceId,
} from '@/lib/navigation/workspaceRegistry';
import { SiteStatusBadge } from '@/components/editorial/WorkspacePrimitives';

interface WorkspaceContextStripProps {
  activeWorkspace: PrimaryWorkspaceId;
  activeSubsection: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  onSelectSite: (siteId: string) => void;
  simulationEpochUtc: string;
  onDateTimeChange: (value: string) => void;
  onStepDays: (deltaDays: number) => void;
  missionDurationDays: number;
  onChangeDurationDays: (days: number) => void;
  themePreference: SeleneThemePreference;
  onChangeThemePreference: (pref: SeleneThemePreference) => void;
  isEduMode: boolean;
  onToggleEduMode: () => void;
  fullscreenViewport: boolean;
  onToggleFullscreenViewport: () => void;
}

const FULLSCREEN_CAPABLE_WORKSPACES: PrimaryWorkspaceId[] = [
  'explorer',
  'lunar-bases',
  'simulator',
  'moon-trek',
];

export default function WorkspaceContextStrip({
  activeWorkspace,
  activeSubsection,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
  sites,
  activeSite,
  onSelectSite,
  simulationEpochUtc,
  onDateTimeChange,
  onStepDays,
  missionDurationDays,
  onChangeDurationDays,
  themePreference,
  onChangeThemePreference,
  isEduMode,
  onToggleEduMode,
  fullscreenViewport,
  onToggleFullscreenViewport,
}: WorkspaceContextStripProps) {
  const workspaceDef = WORKSPACE_REGISTRY[activeWorkspace];
  const subLabel =
    workspaceDef.subsections.find((s) => s.id === activeSubsection)?.label ??
    workspaceDef.topNavLabel;
  const canFullscreen = FULLSCREEN_CAPABLE_WORKSPACES.includes(activeWorkspace);

  return (
    <div
      className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3 sm:px-4 lg:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono min-w-0"
      data-testid="workspace-context-strip"
    >
      {/* Left: Contextual Sidebar Toggle + Breadcrumb + Active Site Selector */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Desktop Sidebar Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Show workspace tools' : 'Collapse workspace tools'}
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors shrink-0 whitespace-nowrap"
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span>{sidebarCollapsed ? 'Tools' : 'Hide Tools'}</span>
        </button>

        {/* Mobile Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] shrink-0 whitespace-nowrap"
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span>Tools</span>
        </button>

        {/* Clean Unboxed Breadcrumb */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-[var(--selene-text-muted)] px-1.5 min-w-0">
          <span className="truncate">{workspaceDef.topNavLabel}</span>
          <span aria-hidden="true">/</span>
          <span className="font-bold text-[var(--selene-text)] truncate">{subLabel}</span>
        </div>

        {/* Active Site Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <label
            htmlFor="global-site-selector"
            className="hidden sm:inline text-[11px] text-[var(--selene-text-muted)] font-semibold shrink-0"
          >
            Site
          </label>
          <select
            id="global-site-selector"
            aria-label="Select Active Lunar Landing Site"
            value={activeSite.id}
            onChange={(e) => onSelectSite(e.target.value)}
            className="min-w-0 max-w-[210px] sm:max-w-[290px] px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] font-semibold truncate focus:outline-none focus:border-[var(--selene-accent-earth)]"
          >
            {sites.map((st) => (
              <option key={st.id} value={st.id}>
                {st.designation} — {st.name} (
                {st.latitude < 0
                  ? `${Math.abs(st.latitude).toFixed(2)}°S`
                  : `${st.latitude.toFixed(2)}°N`}
                , {st.longitude.toFixed(2)}°E)
              </option>
            ))}
          </select>
          <div className="hidden md:block">
            <SiteStatusBadge site={activeSite} showTooltip />
          </div>
        </div>
      </div>

      {/* Right: Synchronized Epoch UTC + Duration + Analysis Mode + Theme + Fullscreen */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <label
            htmlFor="global-landing-datetime"
            className="hidden sm:inline text-[11px] text-[var(--selene-text-muted)] mr-1"
          >
            UTC
          </label>
          <input
            id="global-landing-datetime"
            aria-label="Mission Simulation Epoch UTC"
            type="datetime-local"
            value={simulationEpochUtc.slice(0, 16)}
            onChange={(e) => onDateTimeChange(e.target.value)}
            className="px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] tabular-nums focus:outline-none focus:border-[var(--selene-accent-earth)]"
          />
          <button
            type="button"
            onClick={() => onStepDays(-1)}
            title="Step Backward 1 Day (-24h)"
            className="px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:border-[var(--selene-accent-earth)] tabular-nums"
          >
            -1d
          </button>
          <button
            type="button"
            onClick={() => onStepDays(1)}
            title="Advance 1 Day (+24h)"
            className="px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:border-[var(--selene-accent-earth)] tabular-nums"
          >
            +1d
          </button>
        </div>

        <select
          id="global-mission-duration"
          aria-label="Mission Analysis Window Duration"
          value={
            [1, 7, 14, 29.53].includes(Number(missionDurationDays.toFixed(2)))
              ? String(Number(missionDurationDays.toFixed(2)))
              : 'custom'
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val !== 'custom') {
              onChangeDurationDays(Number(val));
            }
          }}
          className="px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] font-semibold"
        >
          <option value="1">24h (1d)</option>
          <option value="7">7d (168h)</option>
          <option value="14">14d (336h)</option>
          <option value="29.53">29.53d (Synodic)</option>
          <option value="custom">{missionDurationDays}d</option>
        </select>

        {/* Explorer vs Engineering Mode */}
        <button
          type="button"
          onClick={onToggleEduMode}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 border transition-colors whitespace-nowrap shrink-0 ${
            isEduMode
              ? 'bg-[var(--selene-accent-green)]/15 border-[var(--selene-accent-green)] text-[var(--selene-accent-green)] font-bold'
              : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-accent-earth)] font-semibold hover:border-[var(--selene-accent-earth)]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isEduMode ? 'Explorer' : 'Engineering (±1σ)'}</span>
        </button>

        {/* Theme Switcher */}
        <div
          role="group"
          aria-label="Workspace Theme Mode"
          className="inline-flex items-center bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-0.5"
        >
          {(
            [
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'system', label: 'Auto', icon: Monitor },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = themePreference === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                title={`Theme: ${mode.label}`}
                onClick={() => onChangeThemePreference(mode.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors ${
                  active
                    ? 'bg-[var(--selene-surface)] text-[var(--selene-accent-earth)] font-bold border border-[var(--selene-border)]'
                    : 'text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden md:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Fullscreen Viewport Toggle for Canvas Workspaces */}
        {canFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreenViewport}
            aria-pressed={fullscreenViewport}
            title={fullscreenViewport ? 'Exit Full-Screen Viewport (Esc)' : 'Expand Canvas Viewport'}
            className={`inline-flex items-center gap-1 px-2 py-1 border transition-colors whitespace-nowrap shrink-0 ${
              fullscreenViewport
                ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            {fullscreenViewport ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden 2xl:inline">
              {fullscreenViewport ? 'Exit Full' : 'Expand'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
