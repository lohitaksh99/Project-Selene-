'use client';

import React, { useEffect } from 'react';
import {
  Activity,
  BarChart3,
  BatteryCharging,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Download,
  FlaskConical,
  Globe,
  Layers,
  Map as MapIcon,
  Mountain,
  Navigation,
  Orbit,
  Radio,
  Radar,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import {
  WORKSPACE_REGISTRY,
  type PrimaryWorkspaceId,
} from '@/lib/navigation/workspaceRegistry';

interface ContextualSidebarProps {
  activeWorkspace: PrimaryWorkspaceId;
  activeSubsection: string;
  onSelectSubsection: (subsectionId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  sitesCount: number;
  datasetsCount: number;
  ephemerisSourceLabel: string;
}

const SUBSECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Explore
  '3d-terrain': Globe,
  '2d-map': MapIcon,
  horizon: Radar,
  catalog: Compass,
  // Lunar Bases
  'map-overview': MapIcon,
  stations: Building2,
  infrastructure: Layers,
  // Landing Sites
  overview: Activity,
  terrain: Mountain,
  illumination: Sun,
  communications: Radio,
  power: BatteryCharging,
  science: FlaskConical,
  // Mission Planner
  orbital: Orbit,
  ephemeris: Navigation,
  frames: Compass,
  vectors: BarChart3,
  timeline: CalendarClock,
  // Comparison
  matrix: BarChart3,
  charts: Activity,
  mcda: Sliders,
  scenarios: CalendarClock,
  // Moon Trek GIS
  layers: Layers,
  presets: Compass,
  profile: Mountain,
  // Data & Science
  datasets: Database,
  provenance: FlaskConical,
  'api-status': Radio,
  exports: Download,
};

export default function ContextualSidebar({
  activeWorkspace,
  activeSubsection,
  onSelectSubsection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  sitesCount,
  datasetsCount,
  ephemerisSourceLabel,
}: ContextualSidebarProps) {
  const workspaceDef = WORKSPACE_REGISTRY[activeWorkspace];
  const subsections = workspaceDef.subsections;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  if (subsections.length === 0) return null;

  const renderSidebarBody = (isMobileDrawer: boolean) => (
    <div className="flex flex-col justify-between h-full min-w-0">
      <div className="space-y-3 min-w-0">
        {/* Contextual Workspace Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--selene-border)]">
          {(!collapsed || isMobileDrawer) && (
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--selene-text-muted)] truncate">
                {workspaceDef.code} · {workspaceDef.topNavLabel}
              </div>
              <div className="text-xs font-bold text-[var(--selene-text)] truncate mt-0.5">
                {workspaceDef.groupLabel}
              </div>
            </div>
          )}

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close workspace tools"
              className="p-1.5 border border-[var(--selene-border)] bg-[var(--selene-surface-alt)] text-[var(--selene-text)]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand Contextual Tools' : 'Collapse Contextual Tools'}
              aria-label={collapsed ? 'Expand Contextual Tools' : 'Collapse Contextual Tools'}
              className={`p-1.5 border border-[var(--selene-border)] bg-[var(--selene-surface-alt)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors ${
                collapsed ? 'mx-auto' : 'shrink-0'
              }`}
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Subsections specific ONLY to activeWorkspace */}
        <nav aria-label={`${workspaceDef.topNavLabel} Subsections`} className="flex flex-col gap-1">
          {subsections.map((sub) => {
            const Icon = SUBSECTION_ICONS[sub.id] ?? Compass;
            const isActive = activeSubsection === sub.id;
            const showFull = !collapsed || isMobileDrawer;

            return (
              <button
                key={sub.id}
                type="button"
                title={`${sub.label} — ${sub.shortDesc}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => {
                  onSelectSubsection(sub.id);
                  if (isMobileDrawer) onCloseMobile();
                }}
                className={`text-left border transition-colors ${
                  showFull
                    ? 'px-3 py-2.5 flex items-start gap-2.5'
                    : 'p-2 flex items-center justify-center'
                } ${
                  isActive
                    ? 'bg-[var(--selene-surface-alt)] border-[var(--selene-accent-earth)] text-[var(--selene-text)]'
                    : 'bg-transparent border-transparent text-[var(--selene-text-secondary)] hover:bg-[var(--selene-surface-alt)] hover:text-[var(--selene-text)]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${showFull ? 'mt-0.5' : ''} ${
                    isActive ? 'text-[var(--selene-accent-earth)]' : 'text-[var(--selene-text-muted)]'
                  }`}
                />
                {showFull && (
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-mono leading-snug ${
                        isActive ? 'font-bold text-[var(--selene-accent-earth)]' : 'font-semibold'
                      }`}
                    >
                      {sub.label}
                    </div>
                    <div className="text-[11px] text-[var(--selene-text-muted)] leading-snug mt-0.5">
                      {sub.shortDesc}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Compact Ground-Truth Summary Footer */}
      {(!collapsed || isMobileDrawer) && (
        <div className="mt-6 pt-3 border-t border-[var(--selene-border)] text-[11px] font-mono space-y-1.5 text-[var(--selene-text-muted)]">
          <div className="flex items-center justify-between">
            <span>Sites</span>
            <span className="font-bold text-[var(--selene-text)] tabular-nums">{sitesCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Datasets</span>
            <span className="font-bold text-[var(--selene-text)] tabular-nums">{datasetsCount}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Ephemeris</span>
            <span className="font-semibold text-[var(--selene-accent-earth)] truncate">
              {ephemerisSourceLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Contextual Sidebar: 240px expanded <-> 48px collapsed */}
      <aside
        aria-label="Contextual Workspace Sidebar"
        className={`hidden lg:flex shrink-0 bg-[var(--selene-surface)] border-r border-[var(--selene-border)] transition-all duration-150 min-w-0 ${
          collapsed ? 'w-12 p-1.5' : 'w-[240px] p-3'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile / Tablet Slide-over Contextual Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/60"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside
            aria-label="Contextual Workspace Sidebar Drawer"
            className="relative z-50 w-[272px] max-w-[85vw] h-full bg-[var(--selene-surface)] border-r border-[var(--selene-border)] p-4 overflow-y-auto pt-16"
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
