'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  useSeleneStore,
} from '@/lib/store/useSeleneStore';
import type {
  MoonTrekLayerCatalogEntry,
  MoonTrekProjectionCode,
  WmtsParsedCapabilities,
  WmtsResolvedTileResult,
} from '@/lib/services/moonTrekService';
import type {
  HorizonsEphemType,
  HorizonsOutUnits,
  HorizonsParsedResponse,
  HorizonsRefSystem,
} from '@/lib/services/horizonsService';
import type {
  LrocPdsScientificProduct,
  LrocProjectionMode,
  LrocWmsLayerEntry,
} from '@/lib/services/lrocService';
import type { PhysicalIlluminationEvaluation } from '@/lib/services/illuminationEngine';
import {
  CheckCircle2,
  Compass,
  Database,
  Download,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Sun,
} from 'lucide-react';

interface NasaLiveIntegrationPanelProps {
  siteId: string;
  siteName: string;
  siteLatDeg: number;
  siteLonDeg: number;
  siteElevationKm: number;
  simulationEpochUtc: string;
  defaultSubTab?: 'moontrek-wmts' | 'lroc-wms' | 'jpl-horizons' | 'illumination-engine' | 'verification-report';
}

export default function NasaLiveIntegrationPanel({
  siteId,
  siteName,
  siteLatDeg,
  siteLonDeg,
  siteElevationKm,
  simulationEpochUtc,
  defaultSubTab = 'moontrek-wmts',
}: NasaLiveIntegrationPanelProps) {
  const {
    activeLiveWmtsLayer,
    setActiveLiveWmtsLayer,
    activeLiveLrocWmsLayer,
    setActiveLiveLrocWmsLayer,
    liveHorizonsOverride,
    setLiveHorizonsOverride,
    setLastProviderUsed,
  } = useSeleneStore();

  const [activeSubTab, setActiveSubTab] = useState<
    'moontrek-wmts' | 'lroc-wms' | 'jpl-horizons' | 'illumination-engine' | 'verification-report'
  >(defaultSubTab);
  const [prevDefaultSubTab, setPrevDefaultSubTab] = useState(defaultSubTab);

  if (defaultSubTab !== prevDefaultSubTab) {
    setPrevDefaultSubTab(defaultSubTab);
    setActiveSubTab(defaultSubTab);
  }

  // --- Phase 2: NASA Moon Trek WMTS State ---
  const [wmtsProj, setWmtsProj] = useState<MoonTrekProjectionCode>('SP');
  const [wmtsCatalog, setWmtsCatalog] = useState<MoonTrekLayerCatalogEntry[]>([]);
  const [selectedWmtsLayerId, setSelectedWmtsLayerId] = useState<string>(
    'LRO_NAC_AvgMosaic_SPole855_1mp'
  );
  const [wmtsCapabilities, setWmtsCapabilities] = useState<WmtsParsedCapabilities | null>(null);
  const [wmtsResolvedTile, setWmtsResolvedTile] = useState<WmtsResolvedTileResult | null>(null);
  const [wmtsTileValidation, setWmtsTileValidation] = useState<{
    valid: boolean;
    httpStatus: number;
    contentType: string;
    byteLength: number;
    dimensions: string;
    diagnosticCategory: string;
    diagnosticMessage: string;
  } | null>(null);
  const [wmtsZoom, setWmtsZoom] = useState<number>(1);
  const [wmtsLoading, setWmtsLoading] = useState<boolean>(false);
  const [wmtsError, setWmtsError] = useState<string | null>(null);

  // --- Phase 4: LROC Lunaserv WMS & PDS State ---
  const [lrocLayers, setLrocLayers] = useState<LrocWmsLayerEntry[]>([]);
  const [lrocPdsProducts, setLrocPdsProducts] = useState<LrocPdsScientificProduct[]>([]);
  const [lrocTotalDiscovered, setLrocTotalDiscovered] = useState<number>(96);
  const [selectedLrocLayer, setSelectedLrocLayer] = useState<string>('luna_wac_global');
  const [selectedLrocSrs, setSelectedLrocSrs] = useState<LrocProjectionMode>(
    'AUTO:42003,9001,0,-90'
  );
  const [lrocFeatureInfo, setLrocFeatureInfo] = useState<string>('');
  const [lrocLoading, setLrocLoading] = useState<boolean>(false);

  // --- Phase 3: JPL Horizons State ---
  const [horizonsCommand, setHorizonsCommand] = useState<string>('301');
  const [horizonsCenter, setHorizonsCenter] = useState<string>('500@399');
  const [horizonsEphemType, setHorizonsEphemType] = useState<HorizonsEphemType>('VECTORS');
  const [horizonsRefSystem, setHorizonsRefSystem] = useState<HorizonsRefSystem>('ICRF');
  const [horizonsOutUnits, setHorizonsOutUnits] = useState<HorizonsOutUnits>('KM-S');
  const [horizonsStartTime, setHorizonsStartTime] = useState<string>(
    simulationEpochUtc.slice(0, 10)
  );
  const [horizonsStopTime, setHorizonsStopTime] = useState<string>(() => {
    const d = new Date(simulationEpochUtc);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [horizonsStepSize, setHorizonsStepSize] = useState<string>('6 h');
  const [horizonsData, setHorizonsData] = useState<HorizonsParsedResponse | null>(null);
  const [horizonsLoading, setHorizonsLoading] = useState<boolean>(false);
  const [horizonsError, setHorizonsError] = useState<string | null>(null);
  const [syncingGeometry, setSyncingGeometry] = useState<boolean>(false);

  // --- Phase 7: Physical Illumination Engine State ---
  const [illumEval, setIllumEval] = useState<PhysicalIlluminationEvaluation | null>(null);
  const [illumLoading, setIllumLoading] = useState<boolean>(false);

  // --- Phase 9: Verification Report State ---
  const [verificationReport, setVerificationReport] = useState<Record<string, unknown> | null>(
    null
  );
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);

  // Load Moon Trek WMTS catalog, capabilities & live tile validation
  const loadWmtsData = useCallback(
    async (proj: MoonTrekProjectionCode, layerId: string, zoomLevel: number) => {
      setWmtsLoading(true);
      setWmtsError(null);
      try {
        const [catRes, capRes] = await Promise.all([
          fetch(`/api/lunar/wmts?action=catalog&projection=${proj}`),
          fetch(
            `/api/lunar/wmts?action=capabilities&projection=${proj}&layer=${encodeURIComponent(
              layerId
            )}&lat=${siteLatDeg}&lon=${siteLonDeg}&zoom=${zoomLevel}`
          ),
        ]);
        const catJson = await catRes.json();
        if (catJson.layers) {
          setWmtsCatalog(catJson.layers);
        }
        const capJson = await capRes.json();
        if (capJson.status === 'ok' && capJson.capabilities) {
          setWmtsCapabilities(capJson.capabilities);
          const resolved: WmtsResolvedTileResult | null = capJson.resolvedTile || null;
          setWmtsResolvedTile(resolved);

          if (resolved) {
            const valRes = await fetch(
              `/api/lunar/wmts?action=validate-tile&projection=${proj}&layer=${encodeURIComponent(
                layerId
              )}&z=${encodeURIComponent(resolved.tileMatrix)}&row=${resolved.tileRow}&col=${
                resolved.tileCol
              }&ext=${capJson.capabilities.fileExtension}`
            );
            const valJson = await valRes.json();
            if (valJson.status === 'ok' && valJson.validation) {
              setWmtsTileValidation(valJson.validation);
            }
          }
        } else {
          setWmtsError(capJson.message || 'Failed to parse WMTSCapabilities.xml');
        }
      } catch (err) {
        setWmtsError(err instanceof Error ? err.message : String(err));
      } finally {
        setWmtsLoading(false);
      }
    },
    [siteLatDeg, siteLonDeg]
  );

  // Load LROC WMS Capabilities & FeatureInfo
  const loadLrocData = useCallback(async () => {
    setLrocLoading(true);
    try {
      const [capRes, fiRes] = await Promise.all([
        fetch('/api/imagery/lroc?action=capabilities'),
        fetch(
          `/api/imagery/lroc?action=feature-info&layer=luna_wac_dtm_numeric_meters&lat=${siteLatDeg}&lon=${siteLonDeg}`
        ),
      ]);
      const capJson = await capRes.json();
      if (capJson.curatedLayers) {
        setLrocLayers(capJson.curatedLayers);
        setLrocTotalDiscovered(capJson.totalLunarLayersDiscovered || 96);
        setLrocPdsProducts(capJson.pdsScientificProducts || []);
      }
      const fiJson = await fiRes.json();
      if (fiJson.data?.rawFeatureInfo) {
        setLrocFeatureInfo(fiJson.data.rawFeatureInfo);
      }
    } catch {
      // Non-fatal
    } finally {
      setLrocLoading(false);
    }
  }, [siteLatDeg, siteLonDeg]);

  // Execute JPL Horizons Query
  const runHorizonsQuery = useCallback(async () => {
    setHorizonsLoading(true);
    setHorizonsError(null);
    try {
      const params = new URLSearchParams({
        action: 'query',
        command: horizonsCommand,
        center: horizonsCenter,
        startTime: horizonsStartTime,
        stopTime: horizonsStopTime,
        stepSize: horizonsStepSize,
        ephemType: horizonsEphemType,
        refSystem: horizonsRefSystem,
        outUnits: horizonsOutUnits,
      });
      const res = await fetch(`/api/ephemeris/horizons?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'ok' && json.data) {
        setHorizonsData(json.data);
      } else {
        setHorizonsError(json.message || 'JPL Horizons query failed');
      }
    } catch (err) {
      setHorizonsError(err instanceof Error ? err.message : String(err));
    } finally {
      setHorizonsLoading(false);
    }
  }, [
    horizonsCommand,
    horizonsCenter,
    horizonsStartTime,
    horizonsStopTime,
    horizonsStepSize,
    horizonsEphemType,
    horizonsRefSystem,
    horizonsOutUnits,
  ]);

  // Sync workspace solar/Earth geometry with live JPL Horizons DE441
  const syncLiveHorizonsGeometry = async () => {
    setSyncingGeometry(true);
    try {
      const params = new URLSearchParams({
        action: 'lunar-geometry',
        epochUtc: simulationEpochUtc,
        siteLat: String(siteLatDeg),
        siteLon: String(siteLonDeg),
        siteElevKm: String(siteElevationKm),
      });
      const res = await fetch(`/api/ephemeris/horizons?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'ok' && json.data) {
        setLiveHorizonsOverride({
          epochUtc: json.data.epochUtc,
          subSolarLatDeg: json.data.subSolarLatDeg,
          subSolarLonDeg: json.data.subSolarLonDeg,
          subEarthLatDeg: json.data.subEarthLatDeg,
          subEarthLonDeg: json.data.subEarthLonDeg,
          earthMoonRangeKm: json.data.earthMoonRangeKm,
          sourceKernel: json.data.sourceMode,
        });
        setLastProviderUsed(json.data.sourceMode);
      }
    } finally {
      setSyncingGeometry(false);
    }
  };

  // Evaluate Physical Illumination Engine
  const runIlluminationEngine = useCallback(async () => {
    setIllumLoading(true);
    try {
      const params = new URLSearchParams({
        siteId,
        lat: String(siteLatDeg),
        lon: String(siteLonDeg),
        epochUtc: simulationEpochUtc,
      });
      const res = await fetch(`/api/terrain/illumination?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'ok' && json.data) {
        setIllumEval(json.data);
      }
    } finally {
      setIllumLoading(false);
    }
  }, [siteId, siteLatDeg, siteLonDeg, simulationEpochUtc]);

  // Run Live 3-Source Verification Suite
  const runVerificationReport = useCallback(async () => {
    setVerificationLoading(true);
    try {
      const res = await fetch('/api/v1/system/integration-report');
      const json = await res.json();
      if (json.status === 'ok' && json.report) {
        setVerificationReport(json.report);
      }
    } finally {
      setVerificationLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWmtsData(wmtsProj, selectedWmtsLayerId, wmtsZoom);
    });
  }, [wmtsProj, selectedWmtsLayerId, wmtsZoom, loadWmtsData]);

  useEffect(() => {
    queueMicrotask(() => {
      if (activeSubTab === 'lroc-wms' && lrocLayers.length === 0) {
        void loadLrocData();
      } else if (activeSubTab === 'jpl-horizons' && !horizonsData) {
        void runHorizonsQuery();
      } else if (activeSubTab === 'illumination-engine') {
        void runIlluminationEngine();
      } else if (activeSubTab === 'verification-report' && !verificationReport) {
        void runVerificationReport();
      }
    });
  }, [
    activeSubTab,
    lrocLayers.length,
    horizonsData,
    verificationReport,
    loadLrocData,
    runHorizonsQuery,
    runIlluminationEngine,
    runVerificationReport,
  ]);

  const handleSelectWmtsProjection = (nextProj: MoonTrekProjectionCode) => {
    setWmtsProj(nextProj);
    const defaultLayerByProj: Record<MoonTrekProjectionCode, string> = {
      EQ: 'LRO_WAC_Mosaic_Global_303ppd_v02',
      SP: 'LRO_NAC_AvgMosaic_SPole855_1mp',
      NP: 'LRO_LOLA_Count_NPole75_30mp_v04',
    };
    setSelectedWmtsLayerId(defaultLayerByProj[nextProj]);
    setWmtsZoom(1);
  };

  const wmtsProxyTileUrl = wmtsCapabilities
    ? `/api/lunar/wmts?action=tile&projection=${wmtsProj}&layer=${encodeURIComponent(
        selectedWmtsLayerId
      )}&z=${wmtsResolvedTile?.tileMatrix || '0'}&row=${wmtsResolvedTile?.tileRow ?? 0}&col=${
        wmtsResolvedTile?.tileCol ?? 0
      }&ext=${wmtsCapabilities.fileExtension}`
    : '';

  const lrocProxyMapUrl = `/api/imagery/lroc?action=map&layers=${encodeURIComponent(
    selectedLrocLayer
  )}&srs=${encodeURIComponent(selectedLrocSrs)}&lat=${siteLatDeg}&lon=${siteLonDeg}&width=512&height=512`;

  return (
    <section
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 sm:p-6 space-y-5 text-[var(--selene-text)] min-w-0"
      data-testid="nasa-live-integration-panel"
    >
      {/* Header & Sub-Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--selene-border)] pb-4">
        <div className="space-y-1 min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--selene-accent-gold)]">
            Official Planetary Science Data Services · OGC WMTS · JPL Horizons DE441 · LROC Lunaserv WMS
          </div>
          <h3 className="text-lg font-bold text-[var(--selene-text)]">
            NASA Moon Trek, JPL Horizons &amp; LROC QuickMap Live Integration Console
          </h3>
          <p className="text-xs text-[var(--selene-text-muted)] font-mono">
            Active Target: {siteName} ({siteLatDeg.toFixed(2)}°, {siteLonDeg.toFixed(2)}°E) · Epoch:{' '}
            {simulationEpochUtc.slice(0, 19)}Z
            {liveHorizonsOverride && (
              <span className="text-[var(--selene-accent-green)] ml-2">
                · Synced with JPL Horizons ({liveHorizonsOverride.sourceKernel})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {(
            [
              { id: 'moontrek-wmts', label: '01. NASA Moon Trek WMTS', icon: Globe },
              { id: 'lroc-wms', label: '02. LROC Lunaserv WMS & PDS', icon: Layers },
              { id: 'jpl-horizons', label: '03. JPL Horizons API', icon: Satellite },
              { id: 'illumination-engine', label: '04. 3-Regime Illumination', icon: Sun },
              { id: 'verification-report', label: '05. Live Audit Report', icon: CheckCircle2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border transition-colors whitespace-normal sm:whitespace-nowrap ${
                  active
                    ? 'bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] border-[var(--selene-accent-gold)] font-bold'
                    : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-secondary)] border-[var(--selene-border)] hover:text-[var(--selene-text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: NASA MOON TREK OGC WMTS */}
      {activeSubTab === 'moontrek-wmts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Projection, Layer Discovery & Capabilities Controls */}
          <div className="lg:col-span-7 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--selene-surface-alt)] p-3.5 border border-[var(--selene-border)] font-mono text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--selene-text-muted)]">PROJECTION CRS:</span>
                {(['SP', 'EQ', 'NP'] as const).map((proj) => (
                  <button
                    key={proj}
                    type="button"
                    onClick={() => handleSelectWmtsProjection(proj)}
                    className={`px-2.5 py-1 border transition-colors ${
                      wmtsProj === proj
                        ? 'bg-[var(--selene-accent-earth)]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-bold'
                        : 'bg-[var(--selene-surface)] text-[var(--selene-text-secondary)] border-[var(--selene-border)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {proj === 'SP'
                      ? 'South Polar (IAU2000:30120)'
                      : proj === 'EQ'
                        ? 'Global EQ (EPSG:104903)'
                        : 'North Polar (IAU2000:30118)'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => loadWmtsData(wmtsProj, selectedWmtsLayerId, wmtsZoom)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${wmtsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh XML</span>
              </button>
            </div>

            {/* Layer Selector */}
            <div className="space-y-2">
              <label
                htmlFor="moontrek-wmts-layer-select"
                className="block text-xs font-mono text-[var(--selene-text-secondary)]"
              >
                SELECT OFFICIAL NASA MOON TREK WMTS LAYER ({wmtsCatalog.length} VERIFIED IN {wmtsProj}):
              </label>
              <select
                id="moontrek-wmts-layer-select"
                value={selectedWmtsLayerId}
                onChange={(e) => setSelectedWmtsLayerId(e.target.value)}
                className="w-full max-w-full min-w-0 px-3 py-2 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-xs font-mono text-[var(--selene-text)] focus:outline-none focus:border-[var(--selene-accent-gold)]"
              >
                {wmtsCatalog.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    [{layer.projectionCode}] {layer.title} ({layer.id})
                  </option>
                ))}
              </select>
            </div>

            {wmtsError && (
              <div className="p-3 bg-[var(--selene-accent-red)]/15 border border-[var(--selene-accent-red)] text-xs font-mono text-[var(--selene-accent-red)]">
                WMTS Error: {wmtsError}
              </div>
            )}

            {wmtsResolvedTile?.hemisphereAdjusted && (
              <div className="p-3 bg-[var(--selene-accent-earth)]/15 border border-[var(--selene-accent-earth)] text-[11px] font-mono text-[var(--selene-accent-earth)]">
                <strong>HEMISPHERE COVERAGE ALIGNMENT:</strong> {wmtsResolvedTile.diagnosticMessage}
              </div>
            )}

            {/* Parsed WMTSCapabilities.xml Metadata Table */}
            {wmtsCapabilities && (
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2">
                  <span className="font-bold text-[var(--selene-accent-gold)]">
                    PARSED OGC WMTS 1.0.0 GetCapabilities XML
                  </span>
                  <span className="text-[11px] text-[var(--selene-accent-green)]">
                    {wmtsCapabilities.provenance.cacheStatus} · CRS: {wmtsCapabilities.supportedCrs}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)]">
                    <div className="text-[var(--selene-text-muted)]">IDENTIFIER</div>
                    <div className="font-bold text-[var(--selene-text)] truncate mt-0.5">
                      {wmtsCapabilities.layerIdentifier}
                    </div>
                  </div>
                  <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)]">
                    <div className="text-[var(--selene-text-muted)]">TILE MATRIX SET / STYLE</div>
                    <div className="font-bold text-[var(--selene-accent-earth)] mt-0.5">
                      {wmtsCapabilities.tileMatrixSetId} /{' '}
                      {wmtsCapabilities.styles[0]?.identifier || 'default'}
                    </div>
                  </div>
                  <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)]">
                    <div className="text-[var(--selene-text-muted)]">IMAGE FORMAT</div>
                    <div className="font-bold text-[var(--selene-accent-green)] mt-0.5">
                      {wmtsCapabilities.formats.join(', ')} (.{wmtsCapabilities.fileExtension})
                    </div>
                  </div>
                  <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)] sm:col-span-2">
                    <div className="text-[var(--selene-text-muted)]">BOUNDING BOX ({wmtsCapabilities.boundingBox.crs})</div>
                    <div className="font-bold text-[var(--selene-text)] tabular-nums mt-0.5 break-all">
                      Lower: [{wmtsCapabilities.boundingBox.lowerCorner.join(', ')}] · Upper: [
                      {wmtsCapabilities.boundingBox.upperCorner.join(', ')}]
                    </div>
                  </div>
                  <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)]">
                    <div className="text-[var(--selene-text-muted)]">TILE MATRICES</div>
                    <div className="font-bold text-[var(--selene-accent-gold)] tabular-nums mt-0.5">
                      {wmtsCapabilities.tileMatrices.length} Zoom Levels
                    </div>
                  </div>
                </div>

                {/* TileMatrix Table — Scoped to active TileMatrixSet with deterministic composite key */}
                <div className="max-h-44 overflow-auto border border-[var(--selene-border)]">
                  <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[460px]">
                    <thead>
                      <tr className="bg-[var(--selene-surface)] text-[var(--selene-text-muted)] border-b border-[var(--selene-border)]">
                        <th className="py-1.5 px-2">Matrix ID</th>
                        <th className="py-1.5 px-2">Scale Denominator</th>
                        <th className="py-1.5 px-2">Tile Size</th>
                        <th className="py-1.5 px-2">Grid (W×H)</th>
                        <th className="py-1.5 px-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--selene-border)]">
                      {wmtsCapabilities.tileMatrices.slice(0, 8).map((tm, idx) => (
                        <tr
                          key={`${tm.tileMatrixSetId || wmtsCapabilities.tileMatrixSetId}-${tm.identifier}`}
                          className="hover:bg-[var(--selene-surface)]"
                        >
                          <td className="py-1 px-2 font-bold text-[var(--selene-accent-gold)]">{tm.identifier}</td>
                          <td className="py-1 px-2">{tm.scaleDenominator.toFixed(1)}</td>
                          <td className="py-1 px-2">
                            {tm.tileWidth}×{tm.tileHeight}
                          </td>
                          <td className="py-1 px-2">
                            {tm.matrixWidth}×{tm.matrixHeight}
                          </td>
                          <td className="py-1 px-2">
                            <button
                              type="button"
                              onClick={() => setWmtsZoom(idx)}
                              className={`px-2 py-0.5 text-[10.5px] border ${
                                wmtsZoom === idx
                                  ? 'bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] border-[var(--selene-accent-gold)] font-bold'
                                  : 'bg-[var(--selene-surface)] text-[var(--selene-text-secondary)] border-[var(--selene-border)]'
                              }`}
                            >
                              Select z={tm.identifier}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Tile Preview, Validation Telemetry & Map Drape Toggle */}
          <div className="lg:col-span-5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3 font-mono text-xs min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2">
              <span className="font-bold text-[var(--selene-text)]">LIVE WMTS TILE STREAM</span>
              {wmtsResolvedTile && (
                <span className="text-[11px] text-[var(--selene-accent-earth)] tabular-nums">
                  z={wmtsResolvedTile.tileMatrix} · row={wmtsResolvedTile.tileRow} · col=
                  {wmtsResolvedTile.tileCol}
                </span>
              )}
            </div>

            <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-[#080B12] border border-[var(--selene-border)] flex items-center justify-center overflow-hidden">
              {wmtsProxyTileUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wmtsProxyTileUrl}
                  alt={`NASA Moon Trek WMTS Tile ${selectedWmtsLayerId}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-[#C8C4BA] text-xs">Loading WMTS tile...</span>
              )}
            </div>

            {wmtsTileValidation && (
              <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-2.5 space-y-1 text-[10.5px] tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--selene-text-muted)]">DIAGNOSTIC STATUS:</span>
                  <span
                    className={`font-bold ${
                      wmtsTileValidation.valid
                        ? 'text-[var(--selene-accent-green)]'
                        : 'text-[var(--selene-accent-amber)]'
                    }`}
                  >
                    {wmtsTileValidation.diagnosticCategory} (HTTP {wmtsTileValidation.httpStatus})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[var(--selene-text-muted)]">
                  <span>FORMAT &amp; PAYLOAD:</span>
                  <span className="text-[var(--selene-text)]">
                    {wmtsTileValidation.contentType} · {wmtsTileValidation.dimensions} ·{' '}
                    {wmtsTileValidation.byteLength.toLocaleString()} B
                  </span>
                </div>
                <div className="text-[var(--selene-text-secondary)] leading-snug pt-0.5">
                  {wmtsTileValidation.diagnosticMessage}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setActiveLiveWmtsLayer({
                    layerId: selectedWmtsLayerId,
                    projection: wmtsProj,
                    enabled:
                      !(
                        activeLiveWmtsLayer.enabled &&
                        activeLiveWmtsLayer.layerId === selectedWmtsLayerId
                      ),
                  })
                }
                className={`w-full py-2 px-3 font-bold uppercase tracking-wider border transition-colors ${
                  activeLiveWmtsLayer.enabled &&
                  activeLiveWmtsLayer.layerId === selectedWmtsLayerId
                    ? 'bg-[var(--selene-accent-green)] text-white border-[var(--selene-accent-green)]'
                    : 'bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] border-[var(--selene-accent-gold)] hover:opacity-90'
                }`}
              >
                {activeLiveWmtsLayer.enabled &&
                activeLiveWmtsLayer.layerId === selectedWmtsLayerId
                  ? 'Live WMTS Layer Draped on Lunar Map (Click to Detach)'
                  : 'Drape Live WMTS Tile on 3D / 2D Lunar Map'}
              </button>

              {wmtsResolvedTile && (
                <div className="text-[10.5px] text-[var(--selene-text-muted)] break-all bg-[var(--selene-surface)] p-2 border border-[var(--selene-border)]">
                  Upstream URL: {wmtsResolvedTile.tileUrl}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LROC QUICKMAP & LUNASERV OGC WMS + PDS */}
      {activeSubTab === 'lroc-wms' && (
        <div className="space-y-5 font-mono text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: WMS Layer Selector & GetFeatureInfo */}
            <div className="lg:col-span-7 space-y-4 min-w-0">
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[var(--selene-accent-gold)] font-bold">
                    LROC LUNASERV OGC WMS 1.1.1 (wms.im-ldi.com)
                  </span>
                  <span className="text-[var(--selene-text-muted)] ml-2">
                    · {lrocTotalDiscovered} Lunar Layers Discovered
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'AUTO:42003,9001,0,-90', label: 'South Pole Ortho' },
                      { id: 'EPSG:4326', label: 'Global EPSG:4326' },
                      { id: 'AUTO:42003,9001,0,90', label: 'North Pole Ortho' },
                    ] as const
                  ).map((crsOpt) => (
                    <button
                      key={crsOpt.id}
                      type="button"
                      onClick={() => setSelectedLrocSrs(crsOpt.id)}
                      className={`px-2 py-1 text-[11px] border ${
                        selectedLrocSrs === crsOpt.id
                          ? 'bg-[var(--selene-accent-earth)]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-bold'
                          : 'bg-[var(--selene-surface)] text-[var(--selene-text-secondary)] border-[var(--selene-border)]'
                      }`}
                    >
                      {crsOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="lroc-wms-layer-select"
                  className="block text-xs text-[var(--selene-text-secondary)]"
                >
                  SELECT VERIFIED LROC LUNASERV WMS LAYER:
                </label>
                <select
                  id="lroc-wms-layer-select"
                  value={selectedLrocLayer}
                  onChange={(e) => setSelectedLrocLayer(e.target.value)}
                  className="w-full max-w-full min-w-0 px-3 py-2 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                >
                  {(lrocLayers.length > 0
                    ? lrocLayers
                    : [
                        {
                          name: 'luna_wac_global',
                          title: 'LROC WAC Global Monochrome Mosaic (100 m/px)',
                          category: 'WAC_IMAGERY',
                        },
                      ]
                  ).map((layer) => (
                    <option key={layer.name} value={layer.name}>
                      [{layer.category}] {layer.title} ({layer.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scientific Caveat & GetFeatureInfo */}
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2">
                <div className="flex items-center gap-2 text-[var(--selene-accent-amber)] font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>SCIENTIFIC DISTINCTION: WMS RASTER VS. NUMERICAL DEM</span>
                </div>
                <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">
                  LROC Lunaserv WMS <code>GetMap</code> returns rendered 8-bit cartographic rasters (
                  <code>image/png</code> / <code>image/jpeg</code>), never raw numerical elevation
                  arrays. Point numeric queries use <code>GetFeatureInfo</code> below, and numerical
                  32-bit Float NAC DTMs are retrieved via the LROC PDS Archive table.
                </p>
                <div className="bg-[var(--selene-surface)] p-2.5 border border-[var(--selene-border)] text-[11px]">
                  <span className="text-[var(--selene-accent-earth)] font-bold">
                    WMS GetFeatureInfo ({siteLatDeg.toFixed(2)}°, {siteLonDeg.toFixed(2)}°E):
                  </span>{' '}
                  <span className="text-[var(--selene-text)]">
                    {lrocLoading ? 'Querying Lunaserv...' : lrocFeatureInfo || 'Ready'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Live LROC WMS GetMap Preview & Overlay Toggle */}
            <div className="lg:col-span-5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2">
                <span className="font-bold text-[var(--selene-text)]">LIVE LROC WMS GetMap RENDER</span>
                <span className="text-[11px] text-[var(--selene-accent-green)]">{selectedLrocSrs}</span>
              </div>

              <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-[#080B12] border border-[var(--selene-border)] flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lrocProxyMapUrl}
                  alt={`LROC Lunaserv WMS ${selectedLrocLayer}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveLiveLrocWmsLayer({
                    layerName: selectedLrocLayer,
                    srs: selectedLrocSrs,
                    opacity: activeLiveLrocWmsLayer.opacity,
                    enabled:
                      !(
                        activeLiveLrocWmsLayer.enabled &&
                        activeLiveLrocWmsLayer.layerName === selectedLrocLayer
                      ),
                  })
                }
                className={`w-full py-2 px-3 font-bold uppercase tracking-wider border transition-colors ${
                  activeLiveLrocWmsLayer.enabled &&
                  activeLiveLrocWmsLayer.layerName === selectedLrocLayer
                    ? 'bg-[var(--selene-accent-green)] text-white border-[var(--selene-accent-green)]'
                    : 'bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] border-[var(--selene-accent-gold)] hover:opacity-90'
                }`}
              >
                {activeLiveLrocWmsLayer.enabled &&
                activeLiveLrocWmsLayer.layerName === selectedLrocLayer
                  ? 'Live LROC WMS Overlay Active on Map (Click to Disable)'
                  : 'Overlay Live LROC WMS on 3D / 2D Lunar Map'}
              </button>
            </div>
          </div>

          {/* Downloadable LROC PDS Numerical DTM & RDR Products Table */}
          {lrocPdsProducts.length > 0 && (
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[var(--selene-accent-gold)]">
                  LROC PDS NUMERICAL SCIENTIFIC PRODUCT ARCHIVE (data.lroc.im-ldi.com)
                </span>
                <span className="text-[11px] text-[var(--selene-text-muted)]">
                  32-Bit Float NAC Stereo DTMs &amp; GLD100 Products
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                      <th className="py-2 pr-3">Product ID</th>
                      <th className="py-2 pr-3">Region / Target</th>
                      <th className="py-2 pr-3">Resolution</th>
                      <th className="py-2 pr-3">Format &amp; CRS</th>
                      <th className="py-2 pr-3">PDS Archive Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--selene-border)]">
                    {lrocPdsProducts.map((prod) => (
                      <tr key={prod.productId} className="hover:bg-[var(--selene-surface)]">
                        <td className="py-2 pr-3 font-bold text-[var(--selene-accent-earth)]">{prod.productId}</td>
                        <td className="py-2 pr-3">{prod.regionName}</td>
                        <td className="py-2 pr-3">
                          {prod.pixelScaleMeters} m/px (±{prod.verticalPrecisionMeters}m Z)
                        </td>
                        <td className="py-2 pr-3">
                          {prod.format} · {prod.crs}
                        </td>
                        <td className="py-2 pr-3">
                          <a
                            href={prod.pdsArchiveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--selene-accent-gold)] hover:underline"
                          >
                            <span>Open PDS RDR</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NASA/JPL HORIZONS EPHEMERIS CONSOLE */}
      {activeSubTab === 'jpl-horizons' && (
        <div className="space-y-4 font-mono text-xs">
          {/* Configurable Query Controls */}
          <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2.5">
              <div>
                <span className="font-bold text-[var(--selene-accent-gold)]">
                  NASA/JPL HORIZONS EPHEMERIS ENGINE (ssd.jpl.nasa.gov/api/horizons.api)
                </span>
                <span className="text-[11px] text-[var(--selene-text-muted)] ml-2">
                  · Supports OBSERVER, VECTORS &amp; ELEMENTS in ICRF / J2000 / IAU_MOON
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={syncLiveHorizonsGeometry}
                  disabled={syncingGeometry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--selene-accent-green)] text-white font-bold uppercase tracking-wider hover:opacity-90"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>
                    {syncingGeometry
                      ? 'Syncing DE441...'
                      : 'Sync 3D Sun/Earth Vectors with Live Horizons'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={runHorizonsQuery}
                  disabled={horizonsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] font-bold uppercase tracking-wider hover:opacity-90"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${horizonsLoading ? 'animate-spin' : ''}`} />
                  <span>Execute Horizons Query</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">COMMAND (TARGET)</label>
                <select
                  value={horizonsCommand}
                  onChange={(e) => setHorizonsCommand(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                >
                  <option value="301">301 — Moon (Luna)</option>
                  <option value="399">399 — Earth</option>
                  <option value="10">10 — Sun</option>
                  <option value="-85">-85 — LRO Spacecraft</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">CENTER (OBSERVER)</label>
                <select
                  value={horizonsCenter}
                  onChange={(e) => setHorizonsCenter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                >
                  <option value="500@399">500@399 (Geocentric)</option>
                  <option value="500@301">500@301 (Selenocentric)</option>
                  <option value="500@10">500@10 (Heliocentric)</option>
                  <option value="500@0">500@0 (Solar Sys Barycenter)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">EPHEM_TYPE</label>
                <select
                  value={horizonsEphemType}
                  onChange={(e) => setHorizonsEphemType(e.target.value as HorizonsEphemType)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] font-bold"
                >
                  <option value="VECTORS">VECTORS (State X,Y,Z,VX,VY,VZ)</option>
                  <option value="OBSERVER">OBSERVER (RA/Dec, Sub-Sun/Earth)</option>
                  <option value="ELEMENTS">ELEMENTS (Keplerian Orbit)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">REF_SYSTEM / UNITS</label>
                <div className="flex gap-1">
                  <select
                    value={horizonsRefSystem}
                    onChange={(e) => setHorizonsRefSystem(e.target.value as HorizonsRefSystem)}
                    className="w-1/2 px-1.5 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                  >
                    <option value="ICRF">ICRF</option>
                    <option value="J2000">J2000</option>
                  </select>
                  <select
                    value={horizonsOutUnits}
                    onChange={(e) => setHorizonsOutUnits(e.target.value as HorizonsOutUnits)}
                    className="w-1/2 px-1.5 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                  >
                    <option value="KM-S">KM-S</option>
                    <option value="AU-D">AU-D</option>
                    <option value="KM-D">KM-D</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">START_TIME (UTC/TDB)</label>
                <input
                  type="text"
                  value={horizonsStartTime}
                  onChange={(e) => setHorizonsStartTime(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">STOP_TIME</label>
                <input
                  type="text"
                  value={horizonsStopTime}
                  onChange={(e) => setHorizonsStopTime(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--selene-text-muted)] mb-1">STEP_SIZE</label>
                <select
                  value={horizonsStepSize}
                  onChange={(e) => setHorizonsStepSize(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)]"
                >
                  <option value="1 h">1 h</option>
                  <option value="6 h">6 h</option>
                  <option value="12 h">12 h</option>
                  <option value="1 d">1 d</option>
                </select>
              </div>
            </div>
          </div>

          {horizonsError && (
            <div className="p-3 bg-[var(--selene-accent-red)]/15 border border-[var(--selene-accent-red)] text-[var(--selene-accent-red)]">
              JPL Horizons Error: {horizonsError}
            </div>
          )}

          {horizonsData && (
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2">
                <div>
                  <span className="font-bold text-[var(--selene-accent-green)]">
                    VERIFIED JPL HORIZONS RESPONSE (v{horizonsData.signatureVersion})
                  </span>
                  <span className="text-[var(--selene-text)] ml-2">
                    Target: <strong>{horizonsData.targetBodyName}</strong> · Center:{' '}
                    <strong>{horizonsData.centerBodyName}</strong> · Kernel:{' '}
                    <strong className="text-[var(--selene-accent-gold)]">{horizonsData.sourceKernel}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-[var(--selene-accent-earth)]">
                  Frame: {horizonsData.referenceFrame} · Time Scale: {horizonsData.timeScale} ·{' '}
                  {horizonsData.provenance.cacheStatus}
                </span>
              </div>

              {/* Render VECTORS Table */}
              {horizonsData.vectorRecords && horizonsData.vectorRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[720px]">
                    <thead>
                      <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                        <th className="py-1.5 pr-3">JD(TDB) / Epoch</th>
                        <th className="py-1.5 pr-3">X ({horizonsData.query.outUnits})</th>
                        <th className="py-1.5 pr-3">Y ({horizonsData.query.outUnits})</th>
                        <th className="py-1.5 pr-3">Z ({horizonsData.query.outUnits})</th>
                        <th className="py-1.5 pr-3">VX</th>
                        <th className="py-1.5 pr-3">VY</th>
                        <th className="py-1.5 pr-3">VZ</th>
                        <th className="py-1.5 pr-3">Range |R|</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--selene-border)]">
                      {horizonsData.vectorRecords.map((rec) => (
                        <tr key={rec.jdTdb} className="hover:bg-[var(--selene-surface)]">
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-gold)]">
                            {rec.jdTdb.toFixed(5)} ({rec.calendarDateTdb.slice(0, 20)})
                          </td>
                          <td className="py-1.5 pr-3">{rec.position.x.toExponential(6)}</td>
                          <td className="py-1.5 pr-3">{rec.position.y.toExponential(6)}</td>
                          <td className="py-1.5 pr-3">{rec.position.z.toExponential(6)}</td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-earth)]">
                            {rec.velocity.vx.toExponential(5)}
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-earth)]">
                            {rec.velocity.vy.toExponential(5)}
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-earth)]">
                            {rec.velocity.vz.toExponential(5)}
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-green)]">
                            {rec.rangeModulus !== undefined
                              ? rec.rangeModulus.toFixed(2)
                              : Math.hypot(rec.position.x, rec.position.y, rec.position.z).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Render OBSERVER Table */}
              {horizonsData.observerRecords && horizonsData.observerRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[680px]">
                    <thead>
                      <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                        <th className="py-1.5 pr-3">UTC Timestamp</th>
                        <th className="py-1.5 pr-3">RA / Dec (ICRF)</th>
                        <th className="py-1.5 pr-3">Sub-Observer (Lon, Lat)</th>
                        <th className="py-1.5 pr-3">Sub-Solar (Lon, Lat)</th>
                        <th className="py-1.5 pr-3">Range (km)</th>
                        <th className="py-1.5 pr-3">Range-Rate (km/s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--selene-border)]">
                      {horizonsData.observerRecords.map((rec, i) => (
                        <tr key={`${rec.timestampUtc}-${i}`} className="hover:bg-[var(--selene-surface)]">
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-gold)]">{rec.timestampUtc}</td>
                          <td className="py-1.5 pr-3">
                            {rec.raDeg?.toFixed(4)}° / {rec.decDeg?.toFixed(4)}°
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-earth)]">
                            {rec.obsSubLonDeg?.toFixed(3)}°E, {rec.obsSubLatDeg?.toFixed(3)}°
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-amber)]">
                            {rec.sunSubLonDeg?.toFixed(3)}°E, {rec.sunSubLatDeg?.toFixed(3)}°
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-green)]">
                            {rec.deltaKm?.toLocaleString() ?? '—'} km
                          </td>
                          <td className="py-1.5 pr-3">{rec.deldotKmS?.toFixed(4) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Render ELEMENTS Table */}
              {horizonsData.elementRecords && horizonsData.elementRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] tabular-nums min-w-[720px]">
                    <thead>
                      <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)]">
                        <th className="py-1.5 pr-3">JD(TDB)</th>
                        <th className="py-1.5 pr-3">Semi-Major Axis (A)</th>
                        <th className="py-1.5 pr-3">Eccentricity (EC)</th>
                        <th className="py-1.5 pr-3">Inclination (IN)</th>
                        <th className="py-1.5 pr-3">Asc. Node (OM)</th>
                        <th className="py-1.5 pr-3">Arg. Periapsis (W)</th>
                        <th className="py-1.5 pr-3">True Anomaly (TA)</th>
                        <th className="py-1.5 pr-3">Period (Days)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--selene-border)]">
                      {horizonsData.elementRecords.map((rec) => (
                        <tr key={rec.jdTdb} className="hover:bg-[var(--selene-surface)]">
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-gold)]">{rec.jdTdb.toFixed(4)}</td>
                          <td className="py-1.5 pr-3">{rec.semiMajorAxisKmOrAu.toExponential(5)}</td>
                          <td className="py-1.5 pr-3">{rec.eccentricity.toFixed(6)}</td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-earth)]">
                            {rec.inclinationDeg.toFixed(4)}°
                          </td>
                          <td className="py-1.5 pr-3">
                            {rec.longitudeOfAscendingNodeDeg.toFixed(4)}°
                          </td>
                          <td className="py-1.5 pr-3">
                            {rec.argumentOfPeriapsisDeg.toFixed(4)}°
                          </td>
                          <td className="py-1.5 pr-3 text-[var(--selene-accent-green)]">
                            {rec.trueAnomalyDeg.toFixed(4)}°
                          </td>
                          <td className="py-1.5 pr-3">
                            {(rec.orbitalPeriodDays / 86400).toFixed(3)} d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PHYSICAL ILLUMINATION ENGINE (3-REGIME COMPARISON) */}
      {activeSubTab === 'illumination-engine' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--selene-surface-alt)] p-3.5 border border-[var(--selene-border)]">
            <div>
              <span className="font-bold text-[var(--selene-accent-gold)]">
                PHASE 7 — PHYSICALLY MEANINGFUL 3-REGIME LUNAR ILLUMINATION ENGINE
              </span>
              <span className="text-[var(--selene-text-muted)] ml-2">
                · JPL Horizons Sun Vector + LOLA DEM Surface Normals + 360° Horizon Mask
              </span>
            </div>
            <button
              type="button"
              onClick={runIlluminationEngine}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${illumLoading ? 'animate-spin' : ''}`} />
              <span>Re-Evaluate Illumination</span>
            </button>
          </div>

          {illumEval && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Regime 1 */}
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2.5">
                <div className="text-[11px] text-[var(--selene-text-muted)]">
                  REGIME 1 · SIMPLE SPHERICAL INCIDENCE
                </div>
                <div className="text-xl font-bold text-[var(--selene-text)] tabular-nums">
                  {illumEval.regime1SphericalIncidence.unshadowedIrradianceWm2} W/m²
                </div>
                <div className="text-[11px] text-[var(--selene-accent-earth)] tabular-nums">
                  Incidence i₀ = {illumEval.regime1SphericalIncidence.incidenceAngleDeg}° · cos(i₀) ={' '}
                  {illumEval.regime1SphericalIncidence.cosIncidence}
                </div>
                <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">
                  {illumEval.regime1SphericalIncidence.description}
                </p>
              </div>

              {/* Regime 2 */}
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-2.5">
                <div className="text-[11px] text-[var(--selene-text-muted)]">
                  REGIME 2 · LOCAL DEM SLOPE-CORRECTED NORMAL
                </div>
                <div className="text-xl font-bold text-[var(--selene-accent-gold)] tabular-nums">
                  {illumEval.regime2SlopeCorrectedIncidence.slopeIrradianceWm2} W/m²
                </div>
                <div className="text-[11px] text-[var(--selene-accent-earth)] tabular-nums">
                  Incidence i_DEM = {illumEval.regime2SlopeCorrectedIncidence.incidenceAngleDeg}° ·
                  cos(i_DEM) = {illumEval.regime2SlopeCorrectedIncidence.cosIncidence}
                </div>
                <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">
                  {illumEval.regime2SlopeCorrectedIncidence.description}
                </p>
              </div>

              {/* Regime 3 */}
              <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-accent-gold)] p-4 space-y-2.5">
                <div className="text-[11px] text-[var(--selene-accent-gold)] font-bold">
                  REGIME 3 · FULL TERRAIN-SHADOWED &amp; LIMB-DARKENED
                </div>
                <div className="text-xl font-bold text-[var(--selene-accent-green)] tabular-nums">
                  {illumEval.regime3FullTerrainShadowed.effectiveSlopeNormalIrradianceWm2} W/m²
                </div>
                <div className="text-[11px] text-[var(--selene-text)] tabular-nums">
                  Visible Solar Disk:{' '}
                  {(illumEval.regime3FullTerrainShadowed.visibleSolarDiskFraction * 100).toFixed(1)}%
                  · State: {illumEval.regime3FullTerrainShadowed.illuminationState}
                </div>
                <p className="text-[11px] text-[var(--selene-text-secondary)] leading-relaxed">
                  {illumEval.regime3FullTerrainShadowed.description}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LIVE 3-SOURCE INTEGRATION VERIFICATION REPORT */}
      {activeSubTab === 'verification-report' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--selene-surface-alt)] p-3.5 border border-[var(--selene-border)]">
            <div>
              <span className="font-bold text-[var(--selene-accent-green)]">
                PHASE 9 — LIVE 3-SOURCE SCIENTIFIC INTEGRATION &amp; VALIDATION REPORT
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runVerificationReport}
                disabled={verificationLoading}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verificationLoading ? 'animate-spin' : ''}`} />
                <span>Re-Run Live Audit</span>
              </button>
              {verificationReport && (
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(verificationReport, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `selene-nasa-integration-audit-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--selene-accent-gold)] text-[var(--selene-bg)] font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Audit JSON</span>
                </button>
              )}
            </div>
          </div>

          {verificationLoading && (
            <div className="p-6 text-center bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-gold)]">
              Testing live connections to NASA Moon Trek WMTS, NASA/JPL Horizons DE441, and LROC Lunaserv WMS...
            </div>
          )}

          {verificationReport && (
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--selene-border)] pb-2">
                <span className="font-bold text-[var(--selene-accent-green)]">
                  OVERALL STATUS: {String(verificationReport.overallStatus)}
                </span>
                <span className="text-[var(--selene-text-muted)]">
                  Executed: {String(verificationReport.executedAt)}
                </span>
              </div>

              <pre className="p-3 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[11px] text-[var(--selene-text)] overflow-x-auto max-h-96">
                {JSON.stringify(verificationReport.sources, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
