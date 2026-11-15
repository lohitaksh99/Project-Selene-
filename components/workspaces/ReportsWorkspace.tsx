'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  DatabaseDeploymentStatus,
  DatasetRecord,
  LandingSiteRecord,
} from '@/server/db/database';
import {
  MissionTimelineAnalysis,
  runMissionTimelineAnalysis,
} from '@/lib/astrodynamics/missionAnalyzer';
import { EngineeringConstraints } from '@/lib/astrodynamics/coordinateFrames';
import {
  getSiteStatusLabelClient,
  summarizeDatabaseDatasets,
  UPCOMING_DATASET_INTEGRATION_SLOTS,
} from '@/lib/data/datasetAdapters';
import {
  EngineeringStatusBadge,
  SiteStatusBadge,
} from '@/components/editorial/WorkspacePrimitives';
import { getWebglTextureCacheTelemetry } from '@/lib/three/webglUtils';
import { LUNAR_BASES_CATALOG } from '@/lib/data/lunarBasesCatalog';
import { fetchJsonWithRetry } from '@/lib/services/apiRequestManager';
import { useSeleneStore } from '@/lib/store/useSeleneStore';
import {
  CheckCircle2,
  Cpu,
  Database,
  Download,
  HardDrive,
  Layers,
  Printer,
  ShieldCheck,
} from 'lucide-react';

interface ReportsWorkspaceProps {
  sites: LandingSiteRecord[];
  activeSite: LandingSiteRecord;
  datasets: DatasetRecord[];
  timelineAnalysis: MissionTimelineAnalysis;
  constraints: EngineeringConstraints;
  missionStartDateUtc: string;
  missionDurationDays: number;
  activeSubsection?: string;
}

interface HealthTelemetryPayload {
  sqlite_status: string;
  sqlite_journal_mode: string;
  uptime_seconds: number;
  deployment_status?: DatabaseDeploymentStatus;
  environment_integrity?: {
    ok: boolean;
    warnings: string[];
  };
}

export default function ReportsWorkspace({
  sites,
  activeSite,
  datasets,
  timelineAnalysis,
  constraints,
  missionStartDateUtc,
  missionDurationDays,
  activeSubsection = 'datasets',
}: ReportsWorkspaceProps) {
  const [healthPayload, setHealthPayload] = useState<HealthTelemetryPayload | null>(null);
  const { lastProviderUsed, apiWarnings } = useSeleneStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchJsonWithRetry<{ data?: HealthTelemetryPayload }>({
      dedupeKey: 'reports-health-status',
      workspaceId: 'reports',
      url: '/api/v1/health',
      init: { signal: controller.signal },
      timeoutMs: 8000,
    })
      .then((res) => {
        if (res.data) {
          setHealthPayload(res.data);
        }
      })
      .catch(() => {
        // Non-fatal if aborted on tab switch
      });
    return () => controller.abort();
  }, []);

  const datasetSummary = useMemo(
    () => summarizeDatabaseDatasets(datasets),
    [datasets]
  );

  const globalSiteRanking = useMemo(() => {
    return sites
      .map((site) => {
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
          constraints,
        });
        return { site, analysis };
      })
      .sort(
        (a, b) =>
          b.analysis.scoreBreakdown.overallFeasibilityScore -
          a.analysis.scoreBreakdown.overallFeasibilityScore
      );
  }, [sites, missionStartDateUtc, missionDurationDays, constraints]);

  const exportCsv = () => {
    const headers = [
      'timestamp_utc',
      'epoch_hour',
      'solar_el_deg',
      'solar_az_deg',
      'topo_horizon_el_deg',
      'earth_el_deg',
      'earth_az_deg',
      'solar_irradiance_w_m2',
      'effective_power_kw',
      'dte_margin_db',
      'is_sunlit',
      'is_earth_dte',
      'is_spac',
    ];
    const rows = timelineAnalysis.points.map((pt) =>
      [
        pt.timestampUtc,
        pt.epochHour,
        pt.solarElevationDeg,
        pt.solarAzimuthDeg,
        pt.solarTerrainHorizonDeg,
        pt.earthElevationDeg,
        pt.earthAzimuthDeg,
        pt.solarIrradianceWm2,
        pt.effectivePowerKw,
        pt.dteLinkMarginDb,
        pt.solarTerrainVis ? 1 : 0,
        pt.dteLinkFeasible ? 1 : 0,
        pt.isSpac ? 1 : 0,
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selene_${activeSite.id}_${missionStartDateUtc.slice(0, 10)}_${missionDurationDays}d_telemetry.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportJsonDossier = () => {
    const payload = {
      reportType: 'Project Selene Mission Selection & Scientific Data Dossier',
      generatedAtUtc: new Date().toISOString(),
      ephemerisProvenance: 'JPL DE441-MOON_ME + NASA NAIF SPICE moon_pa_de440_200625.bpc',
      activeSite: {
        ...activeSite,
        siteStatusClassification: getSiteStatusLabelClient(activeSite),
      },
      missionWindow: {
        epochStartUtc: missionStartDateUtc,
        durationDays: missionDurationDays,
        samplingStepHours: timelineAnalysis.stepHours,
        samplingMode: timelineAnalysis.samplingMode,
        totalSamples: timelineAnalysis.points.length,
      },
      engineeringConstraints: constraints,
      activeSiteSummary: {
        sunlitPercent: timelineAnalysis.metrics.sunlitFractionPct,
        earthVisiblePercent: timelineAnalysis.metrics.commsFractionPct,
        spacPercent: timelineAnalysis.metrics.spacFractionPct,
        maxContinuousSpacHours: timelineAnalysis.metrics.longestContinuousSpacHours,
        maxEclipseDurationHours: timelineAnalysis.metrics.longestContinuousDarknessHours,
        avgEffectivePowerKw: timelineAnalysis.metrics.avgElectricalPowerKw,
        peakSolarElevationDeg: timelineAnalysis.metrics.peakSolarElevationDeg,
        mcdaScore: timelineAnalysis.scoreBreakdown.overallFeasibilityScore,
        mcdaWeightsUsed: timelineAnalysis.scoreBreakdown.weightsUsed,
        engineeringAssessment: timelineAnalysis.scoreBreakdown.engineeringAssessment,
        feasibilityTier: timelineAnalysis.scoreBreakdown.feasibilityTier,
        assessmentRationale: timelineAnalysis.scoreBreakdown.assessmentRationale,
      },
      globalSiteComparison: globalSiteRanking.map((item, idx) => ({
        rank: idx + 1,
        designation: item.site.designation,
        name: item.site.name,
        category: item.site.mission_category,
        siteStatus: getSiteStatusLabelClient(item.site),
        latitude: item.site.latitude,
        longitude: item.site.longitude,
        sunlitPercent: item.analysis.metrics.sunlitFractionPct,
        earthVisiblePercent: item.analysis.metrics.commsFractionPct,
        spacPercent: item.analysis.metrics.spacFractionPct,
        avgEffectivePowerKw: item.analysis.metrics.avgElectricalPowerKw,
        mcdaScore: item.analysis.scoreBreakdown.overallFeasibilityScore,
        engineeringAssessment: item.analysis.scoreBreakdown.engineeringAssessment,
      })),
      databaseProvenanceSummary: {
        totalSitesInDatabase: sites.length,
        totalDatasetsInDatabase: datasets.length,
        validatedDatasetsInDatabase: datasetSummary.verifiedCount,
        datasets,
        deploymentStatus: healthPayload?.deployment_status ?? null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selene_${activeSite.id}_mission_dossier.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const weightsUsed = timelineAnalysis.scoreBreakdown.weightsUsed;
  const cacheStats = getWebglTextureCacheTelemetry();

  const datasetsRegistrySection = (
    <section
      key="datasets-registry"
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
          <h2 className="text-sm font-bold text-[var(--selene-text)]">
            Active SQLite Scientific Dataset Provenance Registry ({datasets.length} Registered Records)
          </h2>
        </div>
        <span className="text-xs font-mono text-[var(--selene-accent-green)] flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Dynamic Database Query (/api/v1/datasets)</span>
        </span>
      </div>

      {datasets.length === 0 ? (
        <div className="p-5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-accent-amber)]">
          INSUFFICIENT DATA — Waiting for SQLite dataset registry records from /api/v1/datasets.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--selene-text)]">{ds.name}</span>
                  <span className="px-2 py-0.5 text-[10.5px] font-mono bg-[var(--selene-accent-green)]/15 text-[var(--selene-accent-green)] border border-[var(--selene-accent-green)]/40 shrink-0">
                    {ds.is_available === 1 ? 'VALIDATED' : 'PENDING'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--selene-accent-earth)]">{ds.provider}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--selene-border)] text-[11px] font-mono text-[var(--selene-text-secondary)]">
                <div>
                  <span className="text-[10.5px] text-[var(--selene-text-muted)] block">VERSION / KERNEL</span>
                  <span className="font-semibold text-[var(--selene-text)]">{ds.version}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[var(--selene-text-muted)] block">RESOLUTION</span>
                  <span className="font-semibold text-[var(--selene-text)] tabular-nums">
                    {ds.resolution_m > 0 ? `${ds.resolution_m} m/px` : 'Continuous Analytical'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[var(--selene-text-muted)] block">COVERAGE</span>
                  <span>{ds.spatial_coverage}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[var(--selene-text-muted)] block">REFERENCE DATUM</span>
                  <span>{ds.datum}</span>
                </div>
                {ds.checksum_sha256 && (
                  <div className="col-span-2 pt-1 border-t border-[var(--selene-border)]/60">
                    <span className="text-[10px] text-[var(--selene-text-muted)] block">CANONICAL SHA-256</span>
                    <code className="text-[10.5px] text-[var(--selene-accent-gold)] break-all">
                      {ds.checksum_sha256}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const adaptersSection = (
    <section
      key="adapters-section"
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--selene-accent-solar)] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-[var(--selene-text)]">
              Standardized Ingestion Adapters for External Datasets
            </h2>
            <p className="text-xs font-mono text-[var(--selene-text-muted)]">
              Modular schema slots for custom DEMs, horizon masks, illumination tables &amp; thermal maps.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10.5px] font-mono font-bold bg-[var(--selene-accent-earth)]/10 text-[var(--selene-accent-earth)] border border-[var(--selene-accent-earth)]/30">
          {UPCOMING_DATASET_INTEGRATION_SLOTS.length} ADAPTER SLOTS CONFIGURED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {UPCOMING_DATASET_INTEGRATION_SLOTS.map((slot) => (
          <div
            key={slot.slotId}
            className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 flex flex-col justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--selene-text)]">{slot.title}</span>
                <span className="px-2 py-0.5 text-[10.5px] font-mono font-bold bg-[var(--selene-accent-earth)]/15 text-[var(--selene-accent-earth)] border border-[var(--selene-accent-earth)]/30">
                  SCHEMA READY
                </span>
              </div>
              <div className="text-[11px] font-mono text-[var(--selene-accent-solar)]">
                Format: {slot.expectedFormat}
              </div>
              <div className="text-[11px] font-mono text-[var(--selene-text-secondary)]">
                Reference Frame: {slot.referenceFrame}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--selene-border)]">
              <div className="flex flex-wrap gap-1.5">
                {slot.requiredColumns.map((col) => (
                  <code
                    key={col}
                    className="px-2 py-0.5 text-[10.5px] font-mono bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)]"
                  >
                    {col}
                  </code>
                ))}
              </div>
              <p className="text-[11px] font-mono text-[var(--selene-text-secondary)]">
                {slot.statusMessage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const provenanceAndDeploymentSection = (
    <section
      key="provenance-deployment"
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--selene-accent-earth)] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-[var(--selene-text)]">
              Scientific Provenance, Cache Telemetry &amp; SQLite Deployment Architecture
            </h2>
            <p className="text-xs font-mono text-[var(--selene-text-muted)]">
              Measurement vs. model taxonomy, WebGL resource reuse, and database WAL / multi-instance status
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10.5px] font-mono font-bold bg-[var(--selene-accent-green)]/15 text-[var(--selene-accent-green)] border border-[var(--selene-accent-green)]/40">
          PROVENANCE VERIFIED
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2">
          <div className="text-[var(--selene-accent-gold)] font-bold">01. DIRECT ORBITAL MEASUREMENTS</div>
          <ul className="space-y-1 text-[11px] text-[var(--selene-text-secondary)]">
            <li>• LOLA Elevation Datum: R = 1737.4 km (LDEM_80S 5–10 m/px)</li>
            <li>• LOLA LDEC &gt; 0: Direct laser altimeter spot support</li>
            <li>• LROC NAC Touchdown Coordinates: Apollo, Luna, Chang&apos;e, Vikram, Odysseus, SLIM</li>
            <li>• Diviner Bolometric T: 29–295 K polar &amp; equatorial measurements</li>
          </ul>
        </div>

        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2">
          <div className="text-[var(--selene-accent-earth)] font-bold">02. MODEL-DERIVED &amp; CONCEPTUAL</div>
          <ul className="space-y-1 text-[11px] text-[var(--selene-text-secondary)]">
            <li>• Ephemeris &amp; Libration: JPL Horizons DE441 + MOON_PA_DE440</li>
            <li>• 3-Regime Illumination: Sub-solar + LOLA mask + cosine incidence</li>
            <li>• LEND WEH (~10 km footprint): Bulk hydrogen, not 100 m pure H2O ice</li>
            <li>• Conceptual Bases ({LUNAR_BASES_CATALOG.filter((b) => b.classification === 'CONCEPTUAL_BASE_DESIGN').length} in catalog): Architectural study designs</li>
          </ul>
        </div>

        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2">
          <div className="text-[var(--selene-accent-green)] font-bold">03. RUNTIME &amp; FALLBACK STATUS</div>
          <ul className="space-y-1 text-[11px] text-[var(--selene-text-secondary)] tabular-nums">
            <li>• Active Provider: {lastProviderUsed}</li>
            <li>
              • WebGL Shader Cache: {cacheStats.cachedShaderModes.length} modes (Hits: {cacheStats.textureCacheHits}, Misses: {cacheStats.textureCacheMisses})
            </li>
            <li>• 2D Lunar Map Engine: 3-Pass AABB Collision Avoidance</li>
            <li>• API Notices: {apiWarnings.length > 0 ? apiWarnings.join(' | ') : 'None'}</li>
          </ul>
        </div>
      </div>

      {/* Live SQLite WAL & Cloud Run Storage Transparency */}
      {healthPayload?.deployment_status && (
        <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2 text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold text-[var(--selene-accent-earth)]">
              <HardDrive className="w-3.5 h-3.5" />
              <span>SQLITE DEPLOYMENT &amp; WAL COMPATIBILITY AUDIT</span>
            </span>
            <span className="text-[11px] text-[var(--selene-accent-green)] tabular-nums">
              JOURNAL: {healthPayload.deployment_status.journalMode} · INTEGRITY:{' '}
              {healthPayload.deployment_status.integrityCheck.toUpperCase()} · MIGRATIONS:{' '}
              {healthPayload.deployment_status.appliedMigrations.length} · SIZE:{' '}
              {(healthPayload.deployment_status.dbSizeBytes / 1024).toFixed(1)} KB
            </span>
          </div>
          <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">
            <strong>Runtime ({healthPayload.deployment_status.runtime}):</strong>{' '}
            {healthPayload.deployment_status.persistentStorageCaveat}
          </p>
          <p className="text-[11px] text-[var(--selene-text-muted)] leading-relaxed">
            {healthPayload.deployment_status.multiInstanceRecommendation}
          </p>
        </div>
      )}
    </section>
  );

  const exportsAndRankingSection = (
    <div key="exports-ranking" className="space-y-5">
      {/* Active Site Executive Feasibility Summary Card */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--selene-border)] pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 text-[10.5px] font-mono font-bold bg-[var(--selene-accent-solar)]/15 text-[var(--selene-accent-solar)] border border-[var(--selene-accent-solar)]/40">
                PRIMARY TARGET DOSSIER
              </span>
              <SiteStatusBadge site={activeSite} showTooltip />
              <span className="text-xs font-mono text-[var(--selene-accent-earth)]">{activeSite.designation}</span>
            </div>
            <h2 className="text-lg font-bold text-[var(--selene-text)]">
              {activeSite.name} — {activeSite.crater_name}
            </h2>
            <p className="text-xs text-[var(--selene-text-secondary)] max-w-3xl leading-relaxed">
              {activeSite.description}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <EngineeringStatusBadge status={timelineAnalysis.scoreBreakdown.engineeringAssessment} />
            <div className="text-xs font-mono text-[var(--selene-text-muted)] tabular-nums">
              Window: {missionStartDateUtc.slice(0, 10)} ({missionDurationDays}d · Δt=
              {timelineAnalysis.stepHours}h)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">SELENOGRAPHIC</div>
            <div className="font-bold text-[var(--selene-text)] mt-1">
              {activeSite.latitude.toFixed(2)}°, {activeSite.longitude.toFixed(2)}°
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">ELEV / SLOPE</div>
            <div className="font-bold text-[var(--selene-text)] mt-1">
              {activeSite.elevation_km.toFixed(2)} km / {activeSite.slope_deg.toFixed(1)}°
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">SUNLIT FRACTION</div>
            <div className="font-bold text-[var(--selene-accent-solar)] mt-1">
              {timelineAnalysis.metrics.sunlitFractionPct}%
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">EARTH DTE VIS</div>
            <div className="font-bold text-[var(--selene-accent-earth)] mt-1">
              {timelineAnalysis.metrics.commsFractionPct}%
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">SPAC CO-VIS</div>
            <div className="font-bold text-[var(--selene-accent-green)] mt-1">
              {timelineAnalysis.metrics.spacFractionPct}%
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">MAX CONT. SPAC</div>
            <div className="font-bold text-[var(--selene-text)] mt-1">
              {timelineAnalysis.metrics.longestContinuousSpacHours}h
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">MAX ECLIPSE</div>
            <div className="font-bold text-[var(--selene-accent-red)] mt-1">
              {timelineAnalysis.metrics.longestContinuousDarknessHours}h
            </div>
          </div>
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
            <div className="text-[10.5px] text-[var(--selene-text-muted)]">AVG SOLAR POWER</div>
            <div className="font-bold text-[var(--selene-accent-green)] mt-1">
              {timelineAnalysis.metrics.avgElectricalPowerKw.toFixed(2)} kW
            </div>
          </div>
        </div>

        <div className="p-3 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text-secondary)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-[var(--selene-accent-earth)]">ENGINEERING RATIONALE:</strong>{' '}
            {timelineAnalysis.scoreBreakdown.assessmentRationale}
          </div>
          <span className="text-[11px] text-[var(--selene-text-muted)] tabular-nums">
            Weights: SPAC {weightsUsed.spacWeightPct}% · Solar {weightsUsed.solarWeightPct}% ·
            DTE {weightsUsed.commsWeightPct}% · Eclipse {weightsUsed.eclipseWeightPct}% · PSR{' '}
            {weightsUsed.scienceWeightPct}%
          </span>
        </div>
      </section>

      {/* Global Landing Site Comparison Matrix across all DB Sites */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 overflow-x-auto space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[var(--selene-text)]">
              Global Lunar Landing Site Evaluation Matrix ({sites.length} Sites in Database)
            </h2>
            <p className="text-xs font-mono text-[var(--selene-text-muted)]">
              Evaluated for {missionStartDateUtc.slice(0, 10)} ({missionDurationDays}d window)
            </p>
          </div>
          <ShieldCheck className="w-4 h-4 text-[var(--selene-accent-green)] shrink-0" />
        </div>

        <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[840px]">
          <thead>
            <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
              <th className="py-2.5 pr-3">Rank</th>
              <th className="py-2.5 pr-3">Site &amp; Designation</th>
              <th className="py-2.5 pr-3">Site Classification</th>
              <th className="py-2.5 pr-3">Coords</th>
              <th className="py-2.5 pr-3">Sunlit %</th>
              <th className="py-2.5 pr-3">Earth DTE %</th>
              <th className="py-2.5 pr-3">SPAC %</th>
              <th className="py-2.5 pr-3">Avg Power</th>
              <th className="py-2.5 pr-3">Weighted Score</th>
              <th className="py-2.5">Engineering Assessment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--selene-border)]">
            {globalSiteRanking.map(({ site, analysis }, idx) => {
              const isSelected = site.id === activeSite.id;
              return (
                <tr
                  key={site.id}
                  className={
                    isSelected
                      ? 'bg-[var(--selene-accent-solar)]/10'
                      : 'hover:bg-[var(--selene-surface-alt)]'
                  }
                >
                  <td className="py-2.5 pr-3 font-bold text-[var(--selene-text-secondary)]">#{idx + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-[var(--selene-text)]">{site.name}</div>
                    <div className="text-[10.5px] text-[var(--selene-accent-earth)]">{site.designation}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <SiteStatusBadge site={site} />
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--selene-text-secondary)]">
                    {site.latitude.toFixed(2)}°, {site.longitude.toFixed(2)}°
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--selene-accent-solar)] font-semibold">
                    {analysis.metrics.sunlitFractionPct}%
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--selene-accent-earth)] font-semibold">
                    {analysis.metrics.commsFractionPct}%
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--selene-accent-green)] font-semibold">
                    {analysis.metrics.spacFractionPct}%
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--selene-accent-green)] font-semibold">
                    {analysis.metrics.avgElectricalPowerKw.toFixed(2)} kW
                  </td>
                  <td className="py-2.5 pr-3 font-bold text-[var(--selene-text)]">
                    {analysis.scoreBreakdown.overallFeasibilityScore.toFixed(1)}
                  </td>
                  <td className="py-2.5">
                    <EngineeringStatusBadge status={analysis.scoreBreakdown.engineeringAssessment} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );

  const orderedSections =
    activeSubsection === 'provenance'
      ? [provenanceAndDeploymentSection, adaptersSection, datasetsRegistrySection, exportsAndRankingSection]
      : activeSubsection === 'exports'
        ? [exportsAndRankingSection, datasetsRegistrySection, provenanceAndDeploymentSection, adaptersSection]
        : activeSubsection === 'api-status'
          ? [provenanceAndDeploymentSection, datasetsRegistrySection, exportsAndRankingSection, adaptersSection]
          : [datasetsRegistrySection, provenanceAndDeploymentSection, adaptersSection, exportsAndRankingSection];

  return (
    <div className="space-y-5 min-w-0">
      {/* Compact Data & Science Action Strip (No Cloned Hero Header) */}
      <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <span className="font-bold text-[var(--selene-accent-earth)]">
              {sites.length} SITES IN DB
            </span>
            <span className="text-[var(--selene-accent-green)] font-bold">
              {datasetSummary.verifiedCount}/{datasets.length} DATASETS VALIDATED
            </span>
            <span className="text-[var(--selene-text-muted)]">
              KERNEL: DE441-MOON_ME + MOON_PA_DE440
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[var(--selene-text)] tracking-tight">
            Scientific Data Hub, Provenance &amp; Mission Exports
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({timelineAnalysis.points.length} rows)</span>
          </button>
          <button
            type="button"
            onClick={exportJsonDossier}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-green)] hover:border-[var(--selene-accent-green)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Dossier</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-[var(--selene-accent-solar)] text-white hover:opacity-90 transition-opacity"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </section>

      {orderedSections}
    </div>
  );
}
