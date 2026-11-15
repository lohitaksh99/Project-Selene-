'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Database, Layers, ShieldCheck } from 'lucide-react';
import {
  ExternalDatasetDomain,
  UPCOMING_DATASET_INTEGRATION_SLOTS,
} from '@/lib/data/datasetAdapters';

export default function DatasetIntegrationSlot({
  domain,
  activeDatabaseCount,
  activeSourceLabel,
  onOpenDataHub,
}: {
  domain: ExternalDatasetDomain;
  activeDatabaseCount?: number;
  activeSourceLabel?: string;
  onOpenDataHub?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const slot =
    UPCOMING_DATASET_INTEGRATION_SLOTS.find((s) => s.domain === domain) ??
    UPCOMING_DATASET_INTEGRATION_SLOTS[0]!;

  return (
    <section
      aria-label={`Dataset Integration Slot: ${slot.title}`}
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)]"
    >
      <div className="p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] font-semibold">
              <Database className="w-3.5 h-3.5 text-[var(--selene-accent-earth)]" />
              <span>SCIENTIFIC DATA INTEGRATION</span>
            </span>
            {typeof activeDatabaseCount === 'number' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#22C55E]/15 border border-[#22C55E]/40 text-[var(--selene-accent-green)] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{activeDatabaseCount} Active DB Records Connected</span>
              </span>
            )}
            <span className="px-2 py-0.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-muted)]">
              FRAME: {slot.referenceFrame}
            </span>
          </div>

          <h3 className="text-base font-bold text-[var(--selene-text)]">{slot.title}</h3>
          <p className="text-xs sm:text-sm text-[var(--selene-text-secondary)] leading-relaxed">
            {slot.statusMessage}{' '}
            {activeSourceLabel && (
              <span className="text-[var(--selene-text)] font-medium">
                Currently operating on validated baseline: {activeSourceLabel}.
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-[var(--selene-text-muted)]">SCHEMA FIELDS:</span>
            {slot.requiredColumns.map((col) => (
              <code
                key={col}
                className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)]"
              >
                {col}
              </code>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="group cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider border border-[var(--selene-accent-earth)]/60 bg-[var(--selene-accent-earth)]/10 text-[var(--selene-accent-earth)] hover:bg-[var(--selene-accent-earth)]/20 hover:border-[var(--selene-accent-earth)] transition-all duration-150 whitespace-nowrap shrink-0"
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span>{expanded ? 'Collapse Technical Data' : 'Inspect Technical Data'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:translate-y-0.5" />
            )}
          </button>

          {onOpenDataHub && (
            <button
              type="button"
              onClick={onOpenDataHub}
              className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] hover:text-[var(--selene-accent-earth)] transition-colors whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Open Data Hub &amp; Schema Registry</span>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--selene-border)] bg-[var(--selene-surface-alt)]/50 p-5 lg:p-6 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-3 space-y-1">
              <div className="text-[10.5px] uppercase text-[var(--selene-text-muted)]">DOMAIN IDENTIFIER</div>
              <div className="font-bold text-[var(--selene-accent-earth)]">{slot.domain}</div>
            </div>
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-3 space-y-1">
              <div className="text-[10.5px] uppercase text-[var(--selene-text-muted)]">REFERENCE FRAME &amp; DATUM</div>
              <div className="font-bold text-[var(--selene-text)]">{slot.referenceFrame}</div>
            </div>
            <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-3 space-y-1">
              <div className="text-[10.5px] uppercase text-[var(--selene-text-muted)]">ACTIVE PROVENANCE BASELINE</div>
              <div className="font-bold text-[var(--selene-accent-green)]">
                {activeSourceLabel ?? 'Validated SQLite + SPICE Registry'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-[var(--selene-surface)] border border-[var(--selene-border)]">
            <table className="w-full text-left border-collapse text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)] bg-[var(--selene-surface-alt)]">
                  <th className="py-2 px-3">SCHEMA COLUMN</th>
                  <th className="py-2 px-3">INGESTION REQUIREMENT</th>
                  <th className="py-2 px-3">DATUM / BINDING</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--selene-border)]">
                {slot.requiredColumns.map((col, idx) => (
                  <tr key={col}>
                    <td className="py-1.5 px-3 font-bold text-[var(--selene-accent-earth)]">{col}</td>
                    <td className="py-1.5 px-3 text-[var(--selene-text-secondary)]">
                      Required field #{idx + 1} for {slot.title}
                    </td>
                    <td className="py-1.5 px-3 text-[var(--selene-text-muted)]">{slot.referenceFrame}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(false)}
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

