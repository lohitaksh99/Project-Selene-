'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Database, Info } from 'lucide-react';
import type { EngineeringAssessmentStatus } from '@/lib/astrodynamics/missionAnalyzer';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  getSiteStatusDescriptionClient,
  getSiteStatusLabelClient,
  resolveSiteStatusClient,
} from '@/lib/data/datasetAdapters';

export function EngineeringStatusBadge({
  status,
  size = 'sm',
}: {
  status: EngineeringAssessmentStatus;
  size?: 'sm' | 'md';
}) {
  const styles: Record<EngineeringAssessmentStatus, string> = {
    'MEETS REQUIREMENTS':
      'bg-[#22C55E]/15 text-[var(--selene-accent-green)] border-[#22C55E]/40',
    'DOES NOT MEET REQUIREMENTS':
      'bg-[#EF4444]/15 text-[var(--selene-accent-red)] border-[#EF4444]/40',
    'INSUFFICIENT DATA':
      'bg-[#F59E0B]/15 text-[var(--selene-accent-amber)] border-[#F59E0B]/40',
    'REQUIRES FURTHER ANALYSIS':
      'bg-[#007A91]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)]/40',
  };

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider border ${
        size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]'
      } ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function SiteStatusBadge({
  site,
  showTooltip = false,
}: {
  site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>;
  showTooltip?: boolean;
}) {
  const status = resolveSiteStatusClient(site);
  const label = getSiteStatusLabelClient(site);
  const desc = getSiteStatusDescriptionClient(site);

  const colorMap = {
    HISTORICAL_LANDING:
      'bg-[#F59E0B]/15 text-[var(--selene-accent-amber)] border-[#F59E0B]/40',
    CONFIRMED_LANDING:
      'bg-[#22C55E]/15 text-[var(--selene-accent-green)] border-[#22C55E]/40',
    PLANNED_TARGET:
      'bg-[#007A91]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)]/40',
    CANDIDATE_REGION:
      'bg-[var(--selene-surface-alt)] text-[var(--selene-text)] border-[var(--selene-border)]',
    CUSTOM_COORDINATES:
      'bg-[#D9541E]/15 text-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)]/40',
  };

  return (
    <span
      title={showTooltip ? desc : undefined}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider border whitespace-nowrap ${colorMap[status]}`}
    >
      <span>{label}</span>
    </span>
  );
}

export function EditorialWorkspaceHeader({
  sectionIndex,
  indexCode,
  eyebrow,
  categoryLabel,
  title,
  description,
  subtitle,
  site,
  rightSlot,
  actions,
}: {
  sectionIndex?: string;
  indexCode?: string;
  eyebrow?: string;
  categoryLabel?: string;
  title: string;
  description?: string;
  subtitle?: string;
  site?: LandingSiteRecord;
  rightSlot?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const resolvedIndex = sectionIndex ?? indexCode ?? '01';
  const resolvedEyebrow = eyebrow ?? categoryLabel ?? 'WORKSPACE MODULE';
  const resolvedDescription = description ?? subtitle ?? '';
  const resolvedRight = rightSlot ?? actions;

  return (
    <header className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-3 max-w-4xl min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[var(--selene-accent-yellow)] text-[#111111]">
              {resolvedIndex}
            </span>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--selene-text-muted)]">
              {resolvedEyebrow}
            </span>
            {site && <SiteStatusBadge site={site} showTooltip />}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--selene-text)] leading-tight">
            {title}
          </h1>
          {resolvedDescription && (
            <p className="text-sm sm:text-base text-[var(--selene-text-secondary)] leading-relaxed max-w-3xl">
              {resolvedDescription}
            </p>
          )}
        </div>
        {resolvedRight && <div className="shrink-0">{resolvedRight}</div>}
      </div>
    </header>
  );
}

export function EditorialMetricCard({
  label,
  value,
  unit,
  meaning,
  footnote,
  whyItMatters,
  provenance,
  status,
  accentColor = 'default',
}: {
  label: string;
  value: string | number;
  unit?: string;
  meaning?: string;
  footnote?: string;
  whyItMatters?: string;
  provenance?: string;
  status?: EngineeringAssessmentStatus;
  accentColor?:
    | 'default'
    | 'solar'
    | 'earth'
    | 'spac'
    | 'yellow'
    | 'cyan'
    | 'emerald'
    | 'orange'
    | 'amber'
    | 'red';
}) {
  const topBorderMap: Record<string, string> = {
    default: 'border-t-2 border-t-[var(--selene-border-strong)]',
    solar: 'border-t-2 border-t-[var(--selene-accent-solar)]',
    orange: 'border-t-2 border-t-[var(--selene-accent-solar)]',
    earth: 'border-t-2 border-t-[var(--selene-accent-earth)]',
    cyan: 'border-t-2 border-t-[var(--selene-accent-earth)]',
    spac: 'border-t-2 border-t-[var(--selene-accent-green)]',
    emerald: 'border-t-2 border-t-[var(--selene-accent-green)]',
    yellow: 'border-t-2 border-t-[var(--selene-accent-yellow)]',
    amber: 'border-t-2 border-t-[var(--selene-accent-amber)]',
    red: 'border-t-2 border-t-[var(--selene-accent-red)]',
  };

  const resolvedMeaning = meaning ?? footnote ?? '';
  const valueStr = String(value);
  const isLongStatusText = valueStr.length > 14;

  return (
    <article
      className={`bg-[var(--selene-surface)] border border-[var(--selene-border)] ${topBorderMap[accentColor] ?? topBorderMap.default} p-5 lg:p-6 flex flex-col justify-between gap-4 min-w-0`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--selene-text-muted)]">
            {label}
          </span>
          {status && <EngineeringStatusBadge status={status} />}
        </div>

        <div className="flex flex-wrap items-baseline gap-2 pt-1">
          <span
            className={`font-mono font-extrabold text-[var(--selene-text)] tabular-nums tracking-tight ${
              isLongStatusText ? 'text-lg lg:text-xl leading-snug' : 'text-2xl lg:text-3xl leading-none'
            }`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-xs font-mono font-semibold text-[var(--selene-text-muted)]">
              {unit}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-[var(--selene-border)]">
        {resolvedMeaning && (
          <p className="text-xs sm:text-sm text-[var(--selene-text-secondary)] leading-relaxed">
            {resolvedMeaning}
          </p>
        )}
        {whyItMatters && (
          <p className="text-xs text-[var(--selene-text-muted)] leading-relaxed">
            <strong className="font-semibold text-[var(--selene-text)]">Why it matters:</strong> {whyItMatters}
          </p>
        )}
        {provenance && (
          <div className="pt-1 text-[11px] font-mono text-[var(--selene-text-muted)] flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            <span>SOURCE: {provenance}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export interface TechnicalDataInspectorProps {
  title: string;
  summaryBadge?: string;
  provenance: string;
  sourceDatasets: string[];
  units: string;
  methodology: string;
  assumptions: string[];
  uncertainty: string;
  metrics?: {
    label: string;
    value: string;
    accent?: 'solar' | 'earth' | 'green' | 'gold' | 'default';
  }[];
  tableHeaders?: string[];
  tableRows?: (string | number)[][];
  metadata?: { key: string; value: string }[];
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export function TechnicalDataInspector({
  title,
  summaryBadge,
  provenance,
  sourceDatasets,
  units,
  methodology,
  assumptions,
  uncertainty,
  metrics = [],
  tableHeaders = [],
  tableRows = [],
  metadata = [],
  defaultOpen = false,
  children,
}: TechnicalDataInspectorProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showMethod, setShowMethod] = useState(true);

  const accentClassMap: Record<string, string> = {
    solar: 'text-[var(--selene-accent-solar)]',
    earth: 'text-[var(--selene-accent-earth)]',
    green: 'text-[var(--selene-accent-green)]',
    gold: 'text-[var(--selene-accent-gold)]',
    default: 'text-[var(--selene-text)]',
  };

  return (
    <div className="border-t border-[var(--selene-border)] pt-3 mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group cursor-pointer w-full flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs font-mono border border-[var(--selene-accent-earth)]/55 bg-[var(--selene-accent-earth)]/10 hover:bg-[var(--selene-accent-earth)]/20 hover:border-[var(--selene-accent-earth)] transition-all duration-150 text-left"
      >
        <span className="flex items-center gap-2 text-[var(--selene-accent-earth)] font-bold uppercase tracking-wider min-w-0">
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{open ? 'Collapse Technical Data' : 'Inspect Technical Data'}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {summaryBadge && (
            <span className="hidden sm:inline text-[11px] text-[var(--selene-text-secondary)]">
              {summaryBadge}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-[var(--selene-accent-earth)] transition-transform duration-150 group-hover:-translate-y-0.5" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--selene-accent-earth)] transition-transform duration-150 group-hover:translate-y-0.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="mt-2.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--selene-border)]">
            <span className="font-bold text-[var(--selene-text)] uppercase tracking-wider">
              {title} — Technical Specification &amp; Raw Telemetry
            </span>
            <span className="text-[11px] text-[var(--selene-accent-earth)]">UNITS: {units}</span>
          </div>

          {metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-2.5 space-y-0.5"
                >
                  <div className="text-[10px] uppercase text-[var(--selene-text-muted)]">{m.label}</div>
                  <div className={`font-bold tabular-nums ${accentClassMap[m.accent ?? 'default']}`}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-3 space-y-1">
              <div className="text-[10px] uppercase text-[var(--selene-text-muted)] font-bold">
                DATA PROVENANCE &amp; SOURCE DATASETS
              </div>
              <div className="text-[var(--selene-text)] font-semibold">{provenance}</div>
              <ul className="list-disc list-inside text-[var(--selene-text-secondary)] space-y-0.5 pt-1">
                {sourceDatasets.map((ds) => (
                  <li key={ds}>{ds}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-3 space-y-1">
              <div className="text-[10px] uppercase text-[var(--selene-text-muted)] font-bold">
                UNCERTAINTY &amp; METADATA
              </div>
              <div className="text-[var(--selene-accent-amber)] font-semibold">{uncertainty}</div>
              {metadata.length > 0 && (
                <div className="grid grid-cols-1 gap-1 pt-1 text-[var(--selene-text-secondary)]">
                  {metadata.map((item) => (
                    <div key={item.key} className="flex items-baseline justify-between gap-2">
                      <span className="text-[var(--selene-text-muted)]">{item.key}:</span>
                      <span className="text-right text-[var(--selene-text)] tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)]">
            <button
              type="button"
              aria-expanded={showMethod}
              onClick={() => setShowMethod((v) => !v)}
              className="cursor-pointer w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]"
            >
              <span>Calculation Methodology &amp; Engineering Assumptions</span>
              {showMethod ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showMethod && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--selene-border)] space-y-1.5 text-[11px] leading-relaxed text-[var(--selene-text-secondary)]">
                <p>{methodology}</p>
                {assumptions.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 text-[var(--selene-text-muted)]">
                    {assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {tableHeaders.length > 0 && tableRows.length > 0 && (
            <div className="overflow-x-auto bg-[var(--selene-surface)] border border-[var(--selene-border)] max-h-64 overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[540px]">
                <thead className="sticky top-0 bg-[var(--selene-surface-alt)] border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                  <tr>
                    {tableHeaders.map((h) => (
                      <th key={h} className="py-2 px-2.5 font-bold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--selene-border)]">
                  {tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[var(--selene-surface-alt)]/60">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-1.5 px-2.5 whitespace-nowrap text-[var(--selene-text)]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {children}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider border border-[var(--selene-accent-earth)]/60 bg-[var(--selene-accent-earth)]/10 text-[var(--selene-accent-earth)] hover:bg-[var(--selene-accent-earth)]/20 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse Technical Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpandableTechnicalDrawer({
  title,
  subtitle,
  badgeText,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badgeText?: string;
  defaultOpen?: boolean;
  toggleLabelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group cursor-pointer w-full px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-left hover:bg-[var(--selene-surface-alt)]/80 transition-colors"
      >
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--selene-text)]">
              {title}
            </h3>
            {badgeText && (
              <span className="px-2 py-0.5 text-[11px] font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)]">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-[var(--selene-text-muted)]">{subtitle}</p>}
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border border-[var(--selene-accent-earth)]/60 bg-[var(--selene-accent-earth)]/10 text-[var(--selene-accent-earth)] group-hover:bg-[var(--selene-accent-earth)]/20 group-hover:border-[var(--selene-accent-earth)] transition-all duration-150 whitespace-nowrap shrink-0">
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>{open ? 'Collapse Technical Data' : 'Inspect Technical Data'}</span>
          {open ? (
            <ChevronUp className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-y-0.5" />
          )}
        </span>
      </button>
      {open && (
        <div className="p-5 sm:p-6 border-t border-[var(--selene-border)] space-y-4">
          {children}
          <div className="flex justify-end pt-2 border-t border-[var(--selene-border)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider border border-[var(--selene-accent-earth)]/60 bg-[var(--selene-accent-earth)]/10 text-[var(--selene-accent-earth)] hover:bg-[var(--selene-accent-earth)]/20 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse Technical Data</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
