'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Brush,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  ElevationTransectPoint,
  LANDER_THRESHOLD_PRESETS,
  LanderSlopeThresholds,
  TopographicScreeningSummary,
  evaluateSiteEllipseScreening,
  extractElevationTransect,
} from '@/lib/terrain/lolaTerrainEngine';
import { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import { useSeleneStore } from '@/lib/store/useSeleneStore';
import { TechnicalDataInspector } from '@/components/editorial/WorkspacePrimitives';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BatteryCharging,
  Download,
  Mountain,
  Radio,
  ShieldCheck,
  Sun,
} from 'lucide-react';

export type ScientificChartTabId =
  | 'elevation-profile'
  | 'solar-illumination'
  | 'earth-dte'
  | 'solar-power'
  | 'slope-distribution';

function triggerDownload(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. ElevationProfileChart — LOLA LDEM Cross-Section, ADJ_ERR Ribbon, LDSM Slope & 5-Tier LDEC Confidence
 */
export function ElevationProfileChart({
  transectPoints,
  onHoverPoint,
}: {
  transectPoints: ElevationTransectPoint[];
  onHoverPoint?: (pt: ElevationTransectPoint | null) => void;
}) {
  const [showSlope, setShowSlope] = useState(true);
  const [showUncertainty, setShowUncertainty] = useState(true);

  const exportCsv = () => {
    const header =
      'index,distance_km,lat_deg,lon_deg,elevation_m,adj_err_m,slope_deg,roughness_100m_m,ldec_float,adj_effres_m,confidence_tier,confidence_label\n';
    const rows = transectPoints
      .map(
        (p) =>
          `${p.index},${p.distanceKm},${p.latDeg},${p.lonDeg},${p.elevationM},${p.verticalUncertaintyM},${p.slopeDeg},${p.roughness100mM},${p.ldecCount},${p.effectiveResolutionM},${p.confidenceTier},"${p.confidenceLabel}"`
      )
      .join('\n');
    triggerDownload('selene_lola_transect_profile.csv', header + rows, 'text/csv');
  };

  const exportJson = () => {
    triggerDownload(
      'selene_lola_transect_profile.json',
      JSON.stringify(
        {
          productSource: 'NASA GSFC PGDA LDEM_83S_10MPP_ADJ / LDEC / ADJ_ERR / LDSM',
          referenceFrame: 'MOON_ME (DE421)',
          pixelRegistration: 'PIXEL_IS_AREA (Cell-Center)',
          samples: transectPoints,
        },
        null,
        2
      ),
      'application/json'
    );
  };

  const tier1Count = transectPoints.filter((p) => p.confidenceTier === 1).length;
  const tier2Count = transectPoints.filter((p) => p.confidenceTier === 2).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--selene-accent-gold)] font-bold">
            LOLA DEM TRANSECT PROFILE (A &rarr; B)
          </span>
          <span className="px-2 py-0.5 bg-[var(--selene-accent-green)]/12 border border-[var(--selene-accent-green)]/50 text-[var(--selene-accent-green)] text-[11px]">
            Tier 1 (LDEC &gt; 0): {tier1Count}/{transectPoints.length}
          </span>
          {tier2Count > 0 && (
            <span className="px-2 py-0.5 bg-[var(--selene-accent-amber)]/12 border border-[var(--selene-accent-amber)]/50 text-[var(--selene-accent-amber)] text-[11px]">
              Tier 2 (Gap Interp LDEC=0): {tier2Count}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSlope(!showSlope)}
            className={`px-2 py-1 text-[11px] border transition-colors ${
              showSlope
                ? 'bg-[var(--selene-accent-red)]/15 border-[var(--selene-accent-red)] text-[var(--selene-accent-red)] font-semibold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)]'
            }`}
          >
            Slope (LDSM)
          </button>
          <button
            type="button"
            onClick={() => setShowUncertainty(!showUncertainty)}
            className={`px-2 py-1 text-[11px] border transition-colors ${
              showUncertainty
                ? 'bg-[var(--selene-accent-earth)]/15 border-[var(--selene-accent-earth)] text-[var(--selene-accent-earth)] font-semibold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)]'
            }`}
          >
            &plusmn;1&sigma; ADJ_ERR
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
          >
            <Download className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>

      <div className="h-56 w-full bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={transectPoints}
            onMouseMove={(state) => {
              const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1;
              if (idx >= 0 && transectPoints[idx]) {
                onHoverPoint?.(transectPoints[idx]!);
              }
            }}
            onMouseLeave={() => onHoverPoint?.(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--selene-chart-grid)" />
            <XAxis
              dataKey="distanceKm"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit=" km"
            />
            <YAxis
              yAxisId="elev"
              tick={{ fill: 'var(--selene-accent-gold)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit=" m"
              width={52}
            />
            {showSlope && (
              <YAxis
                yAxisId="slope"
                orientation="right"
                domain={[0, 35]}
                tick={{ fill: 'var(--selene-accent-red)', fontSize: 10.5, fontFamily: 'monospace' }}
                unit="°"
                width={38}
              />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const pt = payload[0]?.payload as ElevationTransectPoint | undefined;
                if (!pt) return null;
                return (
                  <div className="bg-[var(--selene-chart-tooltip-bg)] border border-[var(--selene-chart-tooltip-border)] p-2.5 text-[11px] font-mono text-[var(--selene-text)] space-y-1">
                    <div className="text-[var(--selene-accent-gold)] font-bold">
                      DIST: {pt.distanceKm.toFixed(2)} km ({pt.latDeg.toFixed(3)}°S, {pt.lonDeg.toFixed(2)}°E)
                    </div>
                    <div>
                      LDEM ELEV: <strong>{pt.elevationM.toFixed(1)} m</strong> (&plusmn;{pt.verticalUncertaintyM} m ADJ_ERR)
                    </div>
                    <div>
                      LDSM SLOPE: <strong className="text-[var(--selene-accent-red)]">{pt.slopeDeg.toFixed(2)}°</strong> · ROUGHNESS(100m): {pt.roughness100mM} m
                    </div>
                    <div>
                      LDEC SUPPORT: <strong className="text-[var(--selene-accent-green)]">{pt.ldecCount.toFixed(2)} spots</strong> · EFFRES: {pt.effectiveResolutionM} m
                    </div>
                    <div className="text-[10px] text-[var(--selene-accent-earth)]">{pt.confidenceLabel}</div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--selene-text-secondary)' }} />
            <ReferenceLine yAxisId="elev" y={0} stroke="var(--selene-chart-tick)" strokeDasharray="3 3" strokeOpacity={0.45} />
            <Area
              yAxisId="elev"
              type="monotone"
              dataKey="elevationM"
              name="LDEM Elevation (m)"
              stroke="var(--selene-accent-gold)"
              fill="var(--selene-accent-gold)"
              fillOpacity={0.22}
              isAnimationActive={false}
            />
            {showUncertainty && (
              <Line
                yAxisId="elev"
                type="monotone"
                dataKey="elevationUpperErrM"
                name="+1σ ADJ_ERR (m)"
                stroke="var(--selene-accent-earth)"
                strokeDasharray="2 2"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {showSlope && (
              <Line
                yAxisId="slope"
                type="monotone"
                dataKey="slopeDeg"
                name="LDSM Slope (°)"
                stroke="var(--selene-accent-red)"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <TechnicalDataInspector
        title="01. LOLA DEM Transect"
        summaryBadge={`${transectPoints.length} samples · Tier 1: ${tier1Count}`}
        provenance="NASA GSFC PGDA LDEM_83S_10MPP_ADJ / LDEC / ADJ_ERR / LDSM"
        sourceDatasets={[
          'LRO LOLA LDEM_83S_10MPP_ADJ (Polar Stereographic Altimetry)',
          'LRO LOLA LDEC (Laser Altimetry Spot Support Count)',
          'LRO LOLA ADJ_ERR (Vertical ±1σ Geodetic Uncertainty)',
          'LRO LOLA LDSM (100m Baseline Bidirectional Slope)',
        ]}
        units="Distance (km), Elevation (m), Slope (°), Roughness (m)"
        methodology="Samples 64 equidistant stations along the configured A → B transect in IAU2000:30120 polar coordinates using PIXEL_IS_AREA cell-center registration relative to R₀ = 1737.4 km."
        assumptions={[
          'Reference Sphere: IAU_MOON_ME (DE421), R₀ = 1737.4 km',
          'Tier 1 classification requires LDEC spot support > 0; LDEC = 0 indicates gap-interpolated pixels',
        ]}
        uncertainty={`Vertical ±1σ ADJ_ERR range: ${Math.min(...transectPoints.map((p) => p.verticalUncertaintyM)).toFixed(2)}m to ${Math.max(...transectPoints.map((p) => p.verticalUncertaintyM)).toFixed(2)}m`}
        metrics={[
          { label: 'Stations', value: `${transectPoints.length}`, accent: 'default' },
          { label: 'Min / Max Elev', value: `${Math.min(...transectPoints.map((p) => p.elevationM)).toFixed(0)} / ${Math.max(...transectPoints.map((p) => p.elevationM)).toFixed(0)} m`, accent: 'gold' },
          { label: 'Peak LDSM Slope', value: `${Math.max(...transectPoints.map((p) => p.slopeDeg)).toFixed(2)}°`, accent: 'solar' },
          { label: 'Tier 1 Supported', value: `${tier1Count}/${transectPoints.length}`, accent: 'green' },
        ]}
        tableHeaders={['Dist (km)', 'Lat (°)', 'Lon (°E)', 'Elev (m)', '±1σ (m)', 'Slope (°)', 'LDEC', 'Tier']}
        tableRows={transectPoints
          .filter((_, i) => i % Math.max(1, Math.floor(transectPoints.length / 16)) === 0)
          .map((p) => [
            p.distanceKm.toFixed(2),
            p.latDeg.toFixed(3),
            p.lonDeg.toFixed(2),
            p.elevationM.toFixed(1),
            `±${p.verticalUncertaintyM.toFixed(2)}`,
            p.slopeDeg.toFixed(2),
            p.ldecCount.toFixed(2),
            `T${p.confidenceTier}`,
          ])}
      />
    </div>
  );
}

/**
 * 2. SolarIlluminationChart — Limb-Darkened Solar Disk Visibility, Terrain Mask & Synchronized ET Playhead
 */
export function SolarIlluminationChart({
  timelineAnalysis,
  currentEtSeconds,
  onSelectEpochUtc,
}: {
  timelineAnalysis: MissionTimelineAnalysis;
  currentEtSeconds: number;
  onSelectEpochUtc: (utcIso: string) => void;
}) {
  const [showHorizonMask, setShowHorizonMask] = useState(true);
  const [showDiskFraction, setShowDiskFraction] = useState(true);

  const activePoint = useMemo(() => {
    let best = timelineAnalysis.points[0];
    let minDiff = Infinity;
    for (const pt of timelineAnalysis.points) {
      const d = Math.abs(pt.etSecondsJ2000 - currentEtSeconds);
      if (d < minDiff) {
        minDiff = d;
        best = pt;
      }
    }
    return best;
  }, [timelineAnalysis.points, currentEtSeconds]);

  const chartData = useMemo(
    () =>
      timelineAnalysis.points.map((pt) => ({
        ...pt,
        diskPct: Number((pt.solarDiskFraction * 100).toFixed(1)),
      })),
    [timelineAnalysis.points]
  );

  const exportCsv = () => {
    const header =
      'epoch_hour,timestamp_utc,spice_et_s,solar_el_deg,solar_az_deg,terrain_horizon_deg,limb_darkened_disk_fraction,disk_min,disk_max,solar_irradiance_wm2\n';
    const rows = timelineAnalysis.points
      .map(
        (p) =>
          `${p.epochHour},${p.timestampUtc},${p.etSecondsJ2000},${p.solarElevationDeg},${p.solarAzimuthDeg},${p.solarTerrainHorizonDeg},${p.solarDiskFraction},${p.solarDiskFractionMin},${p.solarDiskFractionMax},${p.solarIrradianceWm2}`
      )
      .join('\n');
    triggerDownload('selene_solar_illumination_series.csv', header + rows, 'text/csv');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Sun className="w-3.5 h-3.5 text-[var(--selene-accent-amber)]" />
          <span className="text-[var(--selene-accent-gold)] font-bold">
            2D LIMB-DARKENED SOLAR ILLUMINATION &amp; LOLA HORIZON OCCULTATION
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHorizonMask(!showHorizonMask)}
            className={`px-2 py-1 text-[11px] border ${
              showHorizonMask
                ? 'bg-[var(--selene-accent-gold)]/15 border-[var(--selene-accent-gold)] text-[var(--selene-accent-gold)] font-semibold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)]'
            }`}
          >
            LOLA Horizon Mask
          </button>
          <button
            type="button"
            onClick={() => setShowDiskFraction(!showDiskFraction)}
            className={`px-2 py-1 text-[11px] border ${
              showDiskFraction
                ? 'bg-[var(--selene-accent-green)]/15 border-[var(--selene-accent-green)] text-[var(--selene-accent-green)] font-semibold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)]'
            }`}
          >
            Visible Solar Disk (%)
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      <div className="h-60 w-full bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            onClick={(state) => {
              const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1;
              if (idx >= 0 && chartData[idx]) {
                onSelectEpochUtc(chartData[idx]!.timestampUtc);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--selene-chart-grid)" />
            <XAxis
              dataKey="epochHour"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="h"
            />
            <YAxis
              yAxisId="deg"
              tick={{ fill: 'var(--selene-accent-solar)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="°"
              width={42}
            />
            {showDiskFraction && (
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: 'var(--selene-accent-green)', fontSize: 10.5, fontFamily: 'monospace' }}
                unit="%"
                width={42}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--selene-chart-tooltip-bg)',
                borderColor: 'var(--selene-chart-tooltip-border)',
                color: 'var(--selene-text)',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--selene-text-secondary)' }} />
            <ReferenceLine yAxisId="deg" y={0} stroke="var(--selene-chart-tick)" strokeDasharray="3 3" strokeOpacity={0.45} />
            {activePoint && (
              <ReferenceLine
                yAxisId="deg"
                x={activePoint.epochHour}
                stroke="var(--selene-accent-gold)"
                strokeWidth={2}
                label={{
                  value: `ET T+${activePoint.epochHour}h`,
                  fill: 'var(--selene-accent-gold)',
                  fontSize: 10.5,
                }}
              />
            )}
            <Area
              yAxisId="deg"
              type="monotone"
              dataKey="solarElevationDeg"
              name="Solar Elevation (°)"
              stroke="var(--selene-accent-solar)"
              fill="var(--selene-accent-solar)"
              fillOpacity={0.22}
              isAnimationActive={false}
            />
            {showHorizonMask && (
              <Line
                yAxisId="deg"
                type="monotone"
                dataKey="solarTerrainHorizonDeg"
                name="LOLA Horizon at Sun Az (°)"
                stroke="var(--selene-accent-red)"
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {showDiskFraction && (
              <Line
                yAxisId="pct"
                type="stepAfter"
                dataKey="diskPct"
                name="Limb-Darkened Solar Disk (%)"
                stroke="var(--selene-accent-green)"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Brush
              dataKey="epochHour"
              height={18}
              stroke="var(--selene-accent-gold)"
              fill="var(--selene-surface-alt)"
              travellerWidth={8}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <TechnicalDataInspector
        title="02. Solar Disk & Mask"
        summaryBadge={`Peak +${timelineAnalysis.metrics.peakSolarElevationDeg}° · ${timelineAnalysis.metrics.sunlitFractionPct}% Sunlit`}
        provenance="JPL DE441-MOON_ME + 2D Eddington Limb-Darkened Disk + LOLA 360° Horizon Mask"
        sourceDatasets={[
          'JPL DE441 Lunar & Solar State Vectors (IAU_MOON_ME)',
          'LRO LOLA 360° Topographic Horizon Azimuth Mask',
          'NAIF naif0012.tls Leap-Second Kernel (ΔAT = 37s)',
        ]}
        units="Elevation (°), Azimuth (°), Disk Fraction (%), Flux (W/m²)"
        methodology="Computes apparent topocentric solar elevation and intersects the finite 0.266° solar angular radius against the 360° LOLA terrain horizon mask using 2D discretized Eddington limb-darkening quadrature."
        assumptions={[
          'Solar mean angular radius R☉ ≈ 0.266° at 1 AU',
          'Horizon occultation step evaluated at configured mission cadence',
          'Topographic horizon mask derived from LOLA LDEM polar grid',
        ]}
        uncertainty="Horizon elevation ±0.03° ephemeris dispersion; finite-disk partial occultation bracketed by [disk_min, disk_max]"
        metrics={[
          { label: 'Sunlit Window', value: `${timelineAnalysis.metrics.sunlitFractionPct}% (${timelineAnalysis.metrics.totalSunlitHours}h)`, accent: 'solar' },
          { label: 'Peak Solar El', value: `+${timelineAnalysis.metrics.peakSolarElevationDeg}°`, accent: 'gold' },
          { label: 'Max Continuous Sun', value: `${timelineAnalysis.metrics.longestContinuousSunlightHours} h`, accent: 'green' },
          { label: 'Max Eclipse', value: `${timelineAnalysis.metrics.longestContinuousDarknessHours} h`, accent: 'default' },
        ]}
        tableHeaders={['UTC Epoch', 'T+h', 'Sun El (°)', 'LOLA Mask (°)', 'Disk (%)', 'Min..Max', 'Flux (W/m²)']}
        tableRows={timelineAnalysis.points
          .filter((_, i) => i % Math.max(1, Math.floor(timelineAnalysis.points.length / 16)) === 0)
          .map((p) => [
            p.timestampUtc.slice(0, 16) + 'Z',
            p.epochHour.toFixed(1),
            p.solarElevationDeg.toFixed(2),
            p.solarTerrainHorizonDeg.toFixed(2),
            (p.solarDiskFraction * 100).toFixed(1),
            `${(p.solarDiskFractionMin * 100).toFixed(0)}–${(p.solarDiskFractionMax * 100).toFixed(0)}%`,
            p.solarIrradianceWm2.toFixed(0),
          ])}
      />
    </div>
  );
}

/**
 * 3. EarthDteChart — 3-Stage Direct-to-Earth Visibility & Ka-Band (32 GHz) Link Margin
 */
export function EarthDteChart({
  timelineAnalysis,
  currentEtSeconds,
  onSelectEpochUtc,
}: {
  timelineAnalysis: MissionTimelineAnalysis;
  currentEtSeconds: number;
  onSelectEpochUtc: (utcIso: string) => void;
}) {
  const activePoint = useMemo(() => {
    let best = timelineAnalysis.points[0];
    let minDiff = Infinity;
    for (const pt of timelineAnalysis.points) {
      const d = Math.abs(pt.etSecondsJ2000 - currentEtSeconds);
      if (d < minDiff) {
        minDiff = d;
        best = pt;
      }
    }
    return best;
  }, [timelineAnalysis.points, currentEtSeconds]);

  const exportCsv = () => {
    const header =
      'epoch_hour,timestamp_utc,spice_et_s,earth_el_deg,earth_az_deg,terrain_horizon_deg,stage1_geom_vis,stage2_terrain_vis,stage3_link_feasible,kaband_margin_db\n';
    const rows = timelineAnalysis.points
      .map(
        (p) =>
          `${p.epochHour},${p.timestampUtc},${p.etSecondsJ2000},${p.earthElevationDeg},${p.earthAzimuthDeg},${p.earthTerrainHorizonDeg},${p.earthGeometricVis},${p.earthTerrainVis},${p.dteLinkFeasible},${p.dteLinkMarginDb}`
      )
      .join('\n');
    triggerDownload('selene_dte_kaband_link_series.csv', header + rows, 'text/csv');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-[var(--selene-accent-earth)]" />
          <span className="text-[var(--selene-accent-earth)] font-bold">
            3-STAGE EARTH DTE VISIBILITY &amp; KA-BAND (32.0 GHz) LINK BUDGET
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--selene-text-muted)]">
            EIRP=55.6 dBW · DSN 34m G/T=54.2 dB/K · Req Margin &ge;3.0 dB
          </span>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      <div className="h-60 w-full bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineAnalysis.points}
            onClick={(state) => {
              const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1;
              if (idx >= 0 && timelineAnalysis.points[idx]) {
                onSelectEpochUtc(timelineAnalysis.points[idx]!.timestampUtc);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--selene-chart-grid)" />
            <XAxis
              dataKey="epochHour"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="h"
            />
            <YAxis
              yAxisId="deg"
              tick={{ fill: 'var(--selene-accent-earth)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="°"
              width={42}
            />
            <YAxis
              yAxisId="db"
              orientation="right"
              domain={[-5, 16]}
              tick={{ fill: 'var(--selene-accent-green)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit=" dB"
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--selene-chart-tooltip-bg)',
                borderColor: 'var(--selene-chart-tooltip-border)',
                color: 'var(--selene-text)',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--selene-text-secondary)' }} />
            <ReferenceLine
              yAxisId="db"
              y={3.0}
              stroke="var(--selene-accent-green)"
              strokeDasharray="3 3"
              label={{ value: '3.0 dB Min Margin', fill: 'var(--selene-accent-green)', fontSize: 10.5 }}
            />
            {activePoint && (
              <ReferenceLine
                yAxisId="deg"
                x={activePoint.epochHour}
                stroke="var(--selene-accent-gold)"
                strokeWidth={2}
              />
            )}
            <Area
              yAxisId="deg"
              type="monotone"
              dataKey="earthElevationDeg"
              name="Stage 1: Earth Elevation (°)"
              stroke="var(--selene-accent-earth)"
              fill="var(--selene-accent-earth)"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
            <Line
              yAxisId="deg"
              type="monotone"
              dataKey="earthTerrainHorizonDeg"
              name="Stage 2: LOLA Horizon at Earth Az (°)"
              stroke="var(--selene-accent-amber)"
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="db"
              type="monotone"
              dataKey="dteLinkMarginDb"
              name="Stage 3: Ka-Band Margin (dB)"
              stroke="var(--selene-accent-green)"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            <Brush
              dataKey="epochHour"
              height={18}
              stroke="var(--selene-accent-earth)"
              fill="var(--selene-surface-alt)"
              travellerWidth={8}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <TechnicalDataInspector
        title="03. 3-Stage Ka-Band DTE"
        summaryBadge={`${timelineAnalysis.metrics.commsFractionPct}% DTE · Max +${timelineAnalysis.metrics.maxEarthElevationDegObserved}°`}
        provenance="NAIF SPICE moon_pa_de440 + Topocentric ENU + 32.0 GHz Ka-Band Link Budget"
        sourceDatasets={[
          'NAIF moon_pa_de440_200625.bpc Lunar Libration Orientation Kernel',
          'JPL DE441 Earth-Moon Topocentric Geometry',
          'LRO LOLA 360° Northern Horizon Obstruction Mask',
        ]}
        units="Elevation (°), Azimuth (°), Link Margin (dB)"
        methodology="Evaluates Direct-to-Earth (DTE) feasibility in 3 sequential stages: (1) geometric sub-horizon check, (2) LOLA ridge clearance at Earth azimuth, and (3) 32.0 GHz Ka-band link margin vs. 3.0 dB threshold."
        assumptions={[
          'Terminal EIRP = 55.6 dBW at 32.0 GHz Ka-band',
          'Ground Station: NASA DSN 34m BWG (G/T = 54.2 dB/K)',
          'Required operational link margin ≥ 3.0 dB above carrier threshold',
        ]}
        uncertainty="Atmospheric attenuation & pointing loss margin bounded within ±0.8 dB across lunar libration cycle"
        metrics={[
          { label: 'DTE Availability', value: `${timelineAnalysis.metrics.commsFractionPct}% (${timelineAnalysis.metrics.totalCommsHours}h)`, accent: 'earth' },
          { label: 'Earth El Range', value: `${timelineAnalysis.metrics.minEarthElevationDegObserved}° .. +${timelineAnalysis.metrics.maxEarthElevationDegObserved}°`, accent: 'default' },
          { label: 'Max Continuous DTE', value: `${timelineAnalysis.metrics.longestContinuousCommsHours} h`, accent: 'green' },
          { label: 'Min Required Margin', value: '3.0 dB', accent: 'gold' },
        ]}
        tableHeaders={['UTC Epoch', 'Earth El (°)', 'LOLA Mask (°)', 'Geom', 'Terrain', 'Margin (dB)', 'Link']}
        tableRows={timelineAnalysis.points
          .filter((_, i) => i % Math.max(1, Math.floor(timelineAnalysis.points.length / 16)) === 0)
          .map((p) => [
            p.timestampUtc.slice(0, 16) + 'Z',
            p.earthElevationDeg.toFixed(2),
            p.earthTerrainHorizonDeg.toFixed(2),
            p.earthGeometricVis ? 'PASS' : 'OCC',
            p.earthTerrainVis ? 'PASS' : 'MASK',
            p.dteLinkMarginDb.toFixed(1),
            p.dteLinkFeasible ? 'READY' : 'LOST',
          ])}
      />
    </div>
  );
}

/**
 * 4. SolarPowerChart — PV Generation, Mission Load, Clamped Battery SoC (%) & Eclipse Survival Deficit
 */
export function SolarPowerChart({
  timelineAnalysis,
  currentEtSeconds,
  onSelectEpochUtc,
}: {
  timelineAnalysis: MissionTimelineAnalysis;
  currentEtSeconds: number;
  onSelectEpochUtc: (utcIso: string) => void;
}) {
  const activePoint = useMemo(() => {
    let best = timelineAnalysis.points[0];
    let minDiff = Infinity;
    for (const pt of timelineAnalysis.points) {
      const d = Math.abs(pt.etSecondsJ2000 - currentEtSeconds);
      if (d < minDiff) {
        minDiff = d;
        best = pt;
      }
    }
    return best;
  }, [timelineAnalysis.points, currentEtSeconds]);

  const exportCsv = () => {
    const header =
      'epoch_hour,timestamp_utc,spice_et_s,effective_power_kw,mission_load_kw,net_power_kw,battery_soc_pct,cumulative_energy_kwh,unmet_deficit_kwh\n';
    const rows = timelineAnalysis.points
      .map(
        (p) =>
          `${p.epochHour},${p.timestampUtc},${p.etSecondsJ2000},${p.effectivePowerKw},${p.missionLoadKw},${p.netPowerKw},${p.batterySocPct},${p.cumulativeEnergyKwh},${p.unmetEnergyDeficitKwh}`
      )
      .join('\n');
    triggerDownload('selene_solar_power_battery_soc.csv', header + rows, 'text/csv');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <BatteryCharging className="w-3.5 h-3.5 text-[var(--selene-accent-green)]" />
          <span className="text-[var(--selene-accent-green)] font-bold">
            SOLAR POWER GENERATION, LOAD &amp; CLAMPED BATTERY STATE-OF-CHARGE (SoC)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--selene-text-muted)]">
            &eta;_chg=0.94 · &eta;_dis=0.95 · Min SoC={timelineAnalysis.metrics.minBatterySocPct}% · Gen={timelineAnalysis.metrics.totalEnergyGeneratedKwh} kWh
          </span>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-gold)]"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      <div className="h-60 w-full bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineAnalysis.points}
            onClick={(state) => {
              const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1;
              if (idx >= 0 && timelineAnalysis.points[idx]) {
                onSelectEpochUtc(timelineAnalysis.points[idx]!.timestampUtc);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--selene-chart-grid)" />
            <XAxis
              dataKey="epochHour"
              tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="h"
            />
            <YAxis
              yAxisId="kw"
              tick={{ fill: 'var(--selene-accent-green)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit=" kW"
              width={48}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: 'var(--selene-accent-gold)', fontSize: 10.5, fontFamily: 'monospace' }}
              unit="%"
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--selene-chart-tooltip-bg)',
                borderColor: 'var(--selene-chart-tooltip-border)',
                color: 'var(--selene-text)',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--selene-text-secondary)' }} />
            <ReferenceLine
              yAxisId="soc"
              y={20}
              stroke="var(--selene-accent-red)"
              strokeDasharray="3 3"
              label={{ value: '20% Min Safe SoC (80% DoD)', fill: 'var(--selene-accent-red)', fontSize: 10.5 }}
            />
            {activePoint && (
              <ReferenceLine
                yAxisId="kw"
                x={activePoint.epochHour}
                stroke="var(--selene-accent-gold)"
                strokeWidth={2}
              />
            )}
            <Area
              yAxisId="kw"
              type="monotone"
              dataKey="effectivePowerKw"
              name="Array Generation (kW)"
              stroke="var(--selene-accent-green)"
              fill="var(--selene-accent-green)"
              fillOpacity={0.22}
              isAnimationActive={false}
            />
            <Line
              yAxisId="kw"
              type="monotone"
              dataKey="missionLoadKw"
              name="Mission Load + Heaters (kW)"
              stroke="var(--selene-accent-red)"
              strokeDasharray="3 2"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="batterySocPct"
              name="Battery SoC (%)"
              stroke="var(--selene-accent-gold)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Brush
              dataKey="epochHour"
              height={18}
              stroke="var(--selene-accent-green)"
              fill="var(--selene-surface-alt)"
              travellerWidth={8}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <TechnicalDataInspector
        title="04. Power & Battery SoC"
        summaryBadge={`Avg ${timelineAnalysis.metrics.avgElectricalPowerKw} kW · Min SoC ${timelineAnalysis.metrics.minBatterySocPct}%`}
        provenance="Limb-Darkened Solar Flux + Cosine PV Array Model + Clamped Battery Integrator"
        sourceDatasets={[
          'Topocentric Solar Irradiance Time Series (W/m²)',
          'Configured PV Array Area & Efficiency Parameters',
          'Battery Charge/Discharge State-of-Charge Integrator',
        ]}
        units="Power (kW), State-of-Charge (%), Energy (kWh)"
        methodology="Integrates net array power minus mission & cryogenic survival heater load across discrete mission steps using round-trip battery efficiencies and hard 0–100% SoC clamping."
        assumptions={[
          'Battery charge efficiency η_chg = 0.94; discharge efficiency η_dis = 0.95',
          'Safe minimum battery SoC floor = 20% (80% maximum Depth-of-Discharge)',
          'Unmet energy deficit tracks shortfall when SoC reaches depletion floor',
        ]}
        uncertainty="PV incidence & thermal derating uncertainty ±4% at grazing solar elevations (<2°)"
        metrics={[
          { label: 'Mean Array Output', value: `${timelineAnalysis.metrics.avgElectricalPowerKw} kW`, accent: 'green' },
          { label: 'Total Generated', value: `${timelineAnalysis.metrics.totalEnergyGeneratedKwh} kWh`, accent: 'gold' },
          { label: 'Minimum Battery SoC', value: `${timelineAnalysis.metrics.minBatterySocPct}%`, accent: 'solar' },
          { label: 'Unmet Energy Deficit', value: `${timelineAnalysis.metrics.totalUnmetEnergyDeficitKwh} kWh`, accent: 'default' },
        ]}
        tableHeaders={['UTC Epoch', 'Gen (kW)', 'Load (kW)', 'Net (kW)', 'SoC (%)', 'Cum (kWh)', 'Deficit (kWh)']}
        tableRows={timelineAnalysis.points
          .filter((_, i) => i % Math.max(1, Math.floor(timelineAnalysis.points.length / 16)) === 0)
          .map((p) => [
            p.timestampUtc.slice(0, 16) + 'Z',
            p.effectivePowerKw.toFixed(2),
            p.missionLoadKw.toFixed(2),
            p.netPowerKw.toFixed(2),
            p.batterySocPct.toFixed(1),
            p.cumulativeEnergyKwh.toFixed(1),
            p.unmetEnergyDeficitKwh.toFixed(2),
          ])}
      />
    </div>
  );
}

/**
 * 5. SlopeDistributionChart — Configurable Topographic Screening vs. Flight Certification Disclaimer
 */
export function SlopeDistributionChart({
  screening,
  thresholds,
  onChangeThresholds,
}: {
  screening: TopographicScreeningSummary;
  thresholds: LanderSlopeThresholds;
  onChangeThresholds: (partial: Partial<LanderSlopeThresholds>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-[var(--selene-accent-gold)]" />
          <span className="text-[var(--selene-text)] font-bold">
            ELLIPSE TOPOGRAPHIC SLOPE ECDF &amp; SCREENING (S50={screening.medianSlopeDeg}° · S95={screening.p95SlopeDeg}° · Max={screening.maxSlopeDeg}°)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {LANDER_THRESHOLD_PRESETS.map((preset) => {
            const active =
              Math.abs(thresholds.slopeSafeMaxDeg - preset.slopeSafeMaxDeg) < 0.1;
            return (
              <button
                key={preset.profileName}
                type="button"
                onClick={() => onChangeThresholds(preset)}
                className={`px-2 py-0.5 text-[10.5px] border transition-colors ${
                  active
                    ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-bold'
                    : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]'
                }`}
              >
                {preset.slopeSafeMaxDeg}°/{preset.slopeCautionMaxDeg}°
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-8 h-52 bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={screening.histogramBins}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--selene-chart-grid)" />
              <XAxis
                dataKey="binLabel"
                tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
              />
              <YAxis
                yAxisId="pct"
                tick={{ fill: 'var(--selene-accent-green)', fontSize: 10.5, fontFamily: 'monospace' }}
                unit="%"
                width={40}
              />
              <YAxis
                yAxisId="cdf"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: 'var(--selene-accent-gold)', fontSize: 10.5, fontFamily: 'monospace' }}
                unit="%"
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--selene-chart-tooltip-bg)',
                  borderColor: 'var(--selene-chart-tooltip-border)',
                  color: 'var(--selene-text)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--selene-text-secondary)' }} />
              <Bar
                yAxisId="pct"
                dataKey="cellPercentage"
                name="DEM Cell Share (%)"
                fill="var(--selene-accent-green)"
                fillOpacity={0.72}
                isAnimationActive={false}
              />
              <Line
                yAxisId="cdf"
                type="monotone"
                dataKey="cumulativePct"
                name="Cumulative ECDF (%)"
                stroke="var(--selene-accent-gold)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-4 bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-3 space-y-2 text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[var(--selene-text-muted)]">SCREENING STATUS:</span>
            {screening.screeningStatus === 'WITHIN_TOPOGRAPHIC_SCREENING_THRESHOLDS' ? (
              <span className="inline-flex items-center gap-1 text-[var(--selene-accent-green)] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> WITHIN SCREEN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--selene-accent-amber)] font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> MARGINAL / RISK
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
            <div className="bg-[var(--selene-surface-alt)] p-1.5">
              <span className="text-[var(--selene-text-muted)] block">95th-PCT (S95)</span>
              <strong className="text-[var(--selene-text)]">{screening.p95SlopeDeg}° (Mean {screening.meanSlopeDeg}°)</strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-1.5">
              <span className="text-[var(--selene-text-muted)] block">LDEC &gt; 0 CELLS</span>
              <strong className="text-[var(--selene-accent-green)]">{(screening.measurementSupportedFraction * 100).toFixed(0)}% Supported</strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-1.5">
              <span className="text-[var(--selene-text-muted)] block">100m ROUGHNESS</span>
              <strong className="text-[var(--selene-accent-earth)]">{screening.meanRoughness100mM} m RMS</strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-1.5">
              <span className="text-[var(--selene-text-muted)] block">MAX ADJ_ERR</span>
              <strong className="text-[var(--selene-accent-gold)]">&plusmn;{screening.maxVerticalUncertaintyM} m</strong>
            </div>
          </div>
          <div className="text-[10.5px] text-[var(--selene-text-secondary)] leading-snug pt-1 border-t border-[var(--selene-border)]">
            {screening.certificationDisclaimer}
          </div>
        </div>
      </div>

      <TechnicalDataInspector
        title="05. Slope ECDF Screening"
        summaryBadge={`S50 ${screening.medianSlopeDeg}° · S95 ${screening.p95SlopeDeg}°`}
        provenance="LRO LOLA LDEM 3×3 Horn Gradient + LDEC Spot Support Weighting"
        sourceDatasets={[
          'LRO LOLA LDEM Polar Altimetry Grid (5–20 m/px south polar)',
          'LRO LOLA LDEC Measurement Support Map',
          'LRO LOLA ADJ_ERR Geodetic Uncertainty Map',
        ]}
        units="Slope (°), Cell Share (%), Cumulative ECDF (%), Roughness (m RMS)"
        methodology="Evaluates topographic landing slope distributions inside a 250 m radius landing ellipse using 3×3 Horn finite-difference gradients, computing S50/S95 quantiles and cumulative ECDF."
        assumptions={[
          `Active Safe Slope Max: ≤ ${thresholds.slopeSafeMaxDeg}°; Caution Ceiling: ≤ ${thresholds.slopeCautionMaxDeg}°`,
          `Screening Disclaimer: ${screening.certificationDisclaimer}`,
        ]}
        uncertainty={`Max vertical ADJ_ERR ±${screening.maxVerticalUncertaintyM} m; LDEC > 0 measurement support ${(screening.measurementSupportedFraction * 100).toFixed(0)}%`}
        metrics={[
          { label: 'Median Slope (S50)', value: `${screening.medianSlopeDeg}°`, accent: 'green' },
          { label: '95th-Pct (S95)', value: `${screening.p95SlopeDeg}°`, accent: 'gold' },
          { label: 'Max Slope', value: `${screening.maxSlopeDeg}°`, accent: 'solar' },
          { label: '100m Roughness', value: `${screening.meanRoughness100mM} m RMS`, accent: 'earth' },
        ]}
        tableHeaders={['Slope Bin', 'DEM Cell Share (%)', 'Cumulative ECDF (%)']}
        tableRows={screening.histogramBins.map((b) => [
          b.binLabel,
          `${b.cellPercentage.toFixed(1)}%`,
          `${b.cumulativePct.toFixed(1)}%`,
        ])}
      />
    </div>
  );
}

/**
 * Unified Tabbed Scientific Recharts Deck
 */
export default function ScientificRechartsDeck({
  siteLatDeg,
  siteLonDeg,
  timelineAnalysis,
  defaultTab = 'elevation-profile',
}: {
  siteLatDeg: number;
  siteLonDeg: number;
  timelineAnalysis: MissionTimelineAnalysis;
  defaultTab?: ScientificChartTabId;
}) {
  const {
    simulationEpochET,
    setSimulationEpochUtc,
    activeTransectLine,
    setHoveredSpatialPoint,
    landerSlopeThresholds,
    setLanderSlopeThresholds,
  } = useSeleneStore();

  const [activeChartTab, setActiveChartTab] = useState<ScientificChartTabId>(defaultTab);

  const transectPoints = useMemo(
    () =>
      extractElevationTransect(
        activeTransectLine.latA,
        activeTransectLine.lonA,
        activeTransectLine.latB,
        activeTransectLine.lonB,
        64
      ),
    [activeTransectLine]
  );

  const ellipseScreening = useMemo(
    () => evaluateSiteEllipseScreening(siteLatDeg, siteLonDeg, 250, landerSlopeThresholds),
    [siteLatDeg, siteLonDeg, landerSlopeThresholds]
  );

  const tabs: { id: ScientificChartTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'elevation-profile', label: '01. LOLA DEM Transect', icon: Mountain },
    { id: 'solar-illumination', label: '02. Solar Disk & Mask', icon: Sun },
    { id: 'earth-dte', label: '03. 3-Stage Ka-Band DTE', icon: Radio },
    { id: 'solar-power', label: '04. Power & Battery SoC', icon: BatteryCharging },
    { id: 'slope-distribution', label: '05. Slope ECDF Screening', icon: Activity },
  ];

  return (
    <div
      className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 space-y-4"
      data-testid="scientific-recharts-deck"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--selene-border)]">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeChartTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveChartTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border transition-colors ${
                  active
                    ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-bold'
                    : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-mono text-[var(--selene-text-muted)]">
          SYNC CLOCK: ET {simulationEpochET.toFixed(0)}s · CLICK CURVE TO SCRUB
        </span>
      </div>

      {activeChartTab === 'elevation-profile' && (
        <ElevationProfileChart
          transectPoints={transectPoints}
          onHoverPoint={(pt) =>
            setHoveredSpatialPoint(
              pt
                ? {
                    latDeg: pt.latDeg,
                    lonDeg: pt.lonDeg,
                    elevationM: pt.elevationM,
                    slopeDeg: pt.slopeDeg,
                    ldecCount: pt.ldecCount,
                    verticalUncertaintyM: pt.verticalUncertaintyM,
                    confidenceTier: pt.confidenceTier,
                    label: `Transect ${pt.distanceKm} km`,
                  }
                : null
            )
          }
        />
      )}

      {activeChartTab === 'solar-illumination' && (
        <SolarIlluminationChart
          timelineAnalysis={timelineAnalysis}
          currentEtSeconds={simulationEpochET}
          onSelectEpochUtc={setSimulationEpochUtc}
        />
      )}

      {activeChartTab === 'earth-dte' && (
        <EarthDteChart
          timelineAnalysis={timelineAnalysis}
          currentEtSeconds={simulationEpochET}
          onSelectEpochUtc={setSimulationEpochUtc}
        />
      )}

      {activeChartTab === 'solar-power' && (
        <SolarPowerChart
          timelineAnalysis={timelineAnalysis}
          currentEtSeconds={simulationEpochET}
          onSelectEpochUtc={setSimulationEpochUtc}
        />
      )}

      {activeChartTab === 'slope-distribution' && (
        <SlopeDistributionChart
          screening={ellipseScreening}
          thresholds={landerSlopeThresholds}
          onChangeThresholds={setLanderSlopeThresholds}
        />
      )}
    </div>
  );
}
