'use client';

import React, { useMemo, useState } from 'react';
import NasaEyesEarthMoonViewer from '../three/NasaEyesEarthMoonViewer';
import HorizonPolarRadar from '../hud/HorizonPolarRadar';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  EngineeringConstraints,
  HorizonCoordinates,
  HorizonMaskSample,
} from '@/lib/astrodynamics/coordinateFrames';
import { computeCalibratedEphemeris } from '@/lib/astrodynamics/offlineCalibratedProvider';
import { MissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import {
  getMissionTimeSnapshot,
  validateHorizonsVsAnalyticalCompatibility,
} from '@/lib/services/missionTimeService';
import { useSeleneStore } from '@/lib/store/useSeleneStore';
import {
  SiteStatusBadge,
  TechnicalDataInspector,
} from '@/components/editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '@/components/editorial/DatasetIntegrationSlot';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface SimulatorWorkspaceProps {
  site: LandingSiteRecord;
  simulationEpochUtc: string;
  onChangeEpochUtc: (iso: string) => void;
  missionStartDateUtc: string;
  constraints: EngineeringConstraints;
  horizonProfile: HorizonMaskSample[];
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  timelineAnalysis: MissionTimelineAnalysis;
  activeSubsection?: string;
  onSelectSubsection?: (subId: string) => void;
  fullscreenViewport?: boolean;
}

type SimulatorDisplayMode = 'nasa-eyes-3d' | 'split-deck' | 'horizon-radar';

export default function SimulatorWorkspace({
  site,
  simulationEpochUtc,
  onChangeEpochUtc,
  missionStartDateUtc,
  constraints,
  horizonProfile,
  solarHorizon,
  earthHorizon,
  timelineAnalysis,
  activeSubsection = 'orbital',
  onSelectSubsection,
  fullscreenViewport = false,
}: SimulatorWorkspaceProps) {
  const [displayMode, setDisplayMode] = useState<SimulatorDisplayMode>(
    activeSubsection === 'frames' ? 'split-deck' : 'nasa-eyes-3d'
  );
  const liveHorizonsOverride = useSeleneStore((s) => s.liveHorizonsOverride);

  const [prevSubsection, setPrevSubsection] = useState(activeSubsection);

  if (activeSubsection !== prevSubsection) {
    setPrevSubsection(activeSubsection);
    if (activeSubsection === 'frames') {
      setDisplayMode('split-deck');
    } else if (activeSubsection === 'orbital') {
      setDisplayMode('nasa-eyes-3d');
    }
  }

  const dualSeriesData = useMemo(
    () =>
      timelineAnalysis.points.map((pt) => ({
        hour: `T+${pt.epochHour}h`,
        solarEl: pt.solarElevationDeg,
        earthEl: pt.earthElevationDeg,
        spacBand: pt.isSpac ? 12 : -10,
        powerKw: pt.effectivePowerKw,
      })),
    [timelineAnalysis.points]
  );

  const timeSnapshot = useMemo(
    () => getMissionTimeSnapshot(simulationEpochUtc),
    [simulationEpochUtc]
  );

  const analyticalEph = useMemo(
    () =>
      computeCalibratedEphemeris(
        simulationEpochUtc,
        site.latitude,
        site.longitude,
        site.elevation_km
      ),
    [simulationEpochUtc, site]
  );

  const crossValidation = useMemo(
    () =>
      validateHorizonsVsAnalyticalCompatibility({
        horizonsSubSolar: liveHorizonsOverride
          ? {
              latDeg: liveHorizonsOverride.subSolarLatDeg,
              lonDeg: liveHorizonsOverride.subSolarLonDeg,
            }
          : undefined,
        analyticalSubSolar: {
          latDeg: analyticalEph.subSolarLatDeg,
          lonDeg: analyticalEph.subSolarLonDeg,
        },
        horizonsSubEarth: liveHorizonsOverride
          ? {
              latDeg: liveHorizonsOverride.subEarthLatDeg,
              lonDeg: liveHorizonsOverride.subEarthLonDeg,
            }
          : undefined,
        analyticalSubEarth: {
          latDeg: analyticalEph.subEarthLatDeg,
          lonDeg: analyticalEph.subEarthLonDeg,
        },
      }),
    [liveHorizonsOverride, analyticalEph]
  );

  return (
    <div className="space-y-5 min-w-0">
      {/* 1. Compact Orbit Lab Toolbar & Subsection Switcher */}
      {!fullscreenViewport && (
        <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="font-bold text-[var(--selene-accent-earth)]">{site.designation}</span>
              <SiteStatusBadge site={site} />
              <span className="text-[var(--selene-text-muted)] tabular-nums">
                ET {timeSnapshot.scales.etSecondsJ2000.toFixed(1)}s · {timeSnapshot.lunarPhase.phaseName} (
                {timeSnapshot.lunarPhase.illuminatedPercent}%)
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[var(--selene-text)] tracking-tight">
              Mission Planner — {site.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onSelectSubsection && (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
                {[
                  { id: 'orbital', label: 'Orbital' },
                  { id: 'ephemeris', label: 'Ephemeris' },
                  { id: 'frames', label: 'Frames' },
                  { id: 'vectors', label: 'Vectors' },
                  { id: 'timeline', label: 'Timeline' },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onSelectSubsection(sub.id)}
                    className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                      activeSubsection === sub.id
                        ? 'bg-[var(--selene-accent-yellow)] text-[#111111] font-bold'
                        : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)]">
              {(
                [
                  { id: 'nasa-eyes-3d', label: '3D Rig' },
                  { id: 'split-deck', label: 'Split Deck' },
                  { id: 'horizon-radar', label: 'Radar' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDisplayMode(mode.id)}
                  className={`px-2.5 py-1 text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    displayMode === mode.id
                      ? 'bg-[var(--selene-accent-solar)] text-white font-semibold'
                      : 'text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. Primary Simulation Stage */}
      {displayMode === 'nasa-eyes-3d' && (
        <NasaEyesEarthMoonViewer
          site={site}
          simulationEpochUtc={simulationEpochUtc}
          onChangeEpochUtc={onChangeEpochUtc}
          missionStartDateUtc={missionStartDateUtc}
          constraints={constraints}
          compact={activeSubsection === 'ephemeris' || activeSubsection === 'vectors'}
        />
      )}

      {displayMode === 'split-deck' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 min-w-0">
            <NasaEyesEarthMoonViewer
              site={site}
              simulationEpochUtc={simulationEpochUtc}
              onChangeEpochUtc={onChangeEpochUtc}
              missionStartDateUtc={missionStartDateUtc}
              constraints={constraints}
              compact
            />
          </div>
          <div className="lg:col-span-5 flex items-center justify-center bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4 min-w-0">
            <HorizonPolarRadar
              horizonProfile={horizonProfile}
              solarHorizon={solarHorizon}
              earthHorizon={earthHorizon}
              minSolarElevationDeg={constraints.minSolarElevationDeg}
              minEarthElevationDeg={constraints.minEarthElevationDeg}
              size={370}
            />
          </div>
        </div>
      )}

      {displayMode === 'horizon-radar' && (
        <div className="max-w-xl mx-auto bg-[var(--selene-surface)] border border-[var(--selene-border)] p-6 flex justify-center">
          <HorizonPolarRadar
            horizonProfile={horizonProfile}
            solarHorizon={solarHorizon}
            earthHorizon={earthHorizon}
            minSolarElevationDeg={constraints.minSolarElevationDeg}
            minEarthElevationDeg={constraints.minEarthElevationDeg}
            size={460}
          />
        </div>
      )}

      {/* 3A. Ephemeris Explorer: Time Scales & SPICE Kernel Load Ledger */}
      {activeSubsection === 'ephemeris' && (
        <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--selene-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--selene-text)]">
                SPICE Time Scales (UTC / TAI / TT / TDB / ET) &amp; Ephemeris Kernel Stack
              </h2>
              <p className="text-xs font-mono text-[var(--selene-text-muted)] mt-0.5">
                {crossValidation.note}
              </p>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-mono border border-[var(--selene-border)] bg-[var(--selene-surface-alt)] text-[var(--selene-accent-earth)] font-semibold">
              {liveHorizonsOverride ? 'JPL HORIZONS OVERRIDE ACTIVE' : 'DE441 ANALYTICAL ACTIVE'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">UTC ISO-8601</div>
              <div className="font-bold text-[var(--selene-text)] mt-1 truncate">
                {timeSnapshot.scales.utcIso}
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">SPICE ET (s past J2000)</div>
              <div className="font-bold text-[var(--selene-accent-earth)] mt-1">
                {timeSnapshot.scales.etSecondsJ2000.toFixed(3)} s
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">JD(UTC)</div>
              <div className="font-bold text-[var(--selene-text)] mt-1">
                {timeSnapshot.scales.jdUtc.toFixed(6)}
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">JD(TT) (ΔT={timeSnapshot.scales.deltaTtSeconds}s)</div>
              <div className="font-bold text-[var(--selene-accent-green)] mt-1">
                {timeSnapshot.scales.jdTt.toFixed(6)}
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">JD(TDB)</div>
              <div className="font-bold text-[var(--selene-accent-solar)] mt-1">
                {timeSnapshot.scales.jdTdb.toFixed(6)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs tabular-nums min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--selene-border)] text-[var(--selene-text-muted)] text-[11px]">
                  <th className="py-2 pr-3">LOAD ORDER</th>
                  <th className="py-2 pr-3">KERNEL / PRODUCT</th>
                  <th className="py-2 pr-3">VERSION</th>
                  <th className="py-2 pr-3">VALID COVERAGE</th>
                  <th className="py-2">FRAMES / PURPOSE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--selene-border)]">
                {timeSnapshot.kernels.map((k) => (
                  <tr key={k.id}>
                    <td className="py-2 pr-3 font-bold text-[var(--selene-accent-gold)]">
                      #{k.loadOrder}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-[var(--selene-text)]">
                      {k.filename}
                    </td>
                    <td className="py-2 pr-3 text-[var(--selene-accent-earth)]">{k.version}</td>
                    <td className="py-2 pr-3 text-[var(--selene-text-secondary)]">
                      {k.validCoverage}
                    </td>
                    <td className="py-2 text-[var(--selene-text-muted)]">{k.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TechnicalDataInspector
            title="Astronomical Time Scales & SPICE Kernel Stack"
            summaryBadge={`JD(TDB) ${timeSnapshot.scales.jdTdb.toFixed(4)} · ΔAT=${timeSnapshot.scales.taiMinusUtcSeconds}s`}
            provenance="NAIF SPICE naif0012.tls + JPL DE441 + moon_pa_de440_200625.bpc"
            sourceDatasets={timeSnapshot.kernels.map((k) => `${k.filename} (${k.version})`)}
            units="Seconds past J2000 (ET), Julian Date (days), Leap Seconds (s)"
            methodology="Converts human ISO-8601 UTC to International Atomic Time (TAI = UTC + ΔAT), Terrestrial Time (TT = TAI + 32.184s), and Barycentric Dynamical Time (TDB/ET) with relativistic periodic terms."
            assumptions={[
              `TAI - UTC leap-second offset ΔAT = ${timeSnapshot.scales.taiMinusUtcSeconds}s`,
              `TT - UTC total offset ΔT = ${timeSnapshot.scales.deltaTtSeconds}s`,
              crossValidation.note,
            ]}
            uncertainty="Relativistic TDB-TT periodic conversion accuracy < 50 µs; analytical vs Horizons ephemeris cross-validated explicitly."
            metadata={[
              { key: 'UTC ISO-8601', value: timeSnapshot.scales.utcIso },
              { key: 'SPICE ET (J2000)', value: `${timeSnapshot.scales.etSecondsJ2000.toFixed(3)} s` },
              { key: 'JD(UTC)', value: timeSnapshot.scales.jdUtc.toFixed(6) },
              { key: 'JD(TT)', value: timeSnapshot.scales.jdTt.toFixed(6) },
              { key: 'JD(TDB)', value: timeSnapshot.scales.jdTdb.toFixed(6) },
            ]}
          />
        </section>
      )}

      {/* 3B. Reference Frames Breakdown */}
      {activeSubsection === 'frames' && (
        <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
          <h2 className="text-sm font-bold text-[var(--selene-text)]">
            Reference Frame Transformation Pipeline (ICRF &rarr; MOON_PA &rarr; MOON_ME &rarr; Topocentric ENU)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
              <div className="text-[10.5px] text-[var(--selene-accent-earth)] font-bold">
                1. INERTIAL ICRF / J2000
              </div>
              <div className="text-[var(--selene-text)] font-semibold">Barycentric State Vectors</div>
              <p className="text-[11px] text-[var(--selene-text-muted)]">
                Earth-Moon distance: {analyticalEph.earthMoonDistanceKm.toLocaleString()} km (DE441).
              </p>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
              <div className="text-[10.5px] text-[var(--selene-accent-gold)] font-bold">
                2. IAU MOON_PA (DE440)
              </div>
              <div className="text-[10.5px] text-[var(--selene-text)] font-semibold">
                moon_pa_de440_200625.bpc
              </div>
              <p className="text-[11px] text-[var(--selene-text-muted)]">
                Lunar Principal Axes dynamical libration frame prior to ME rotation.
              </p>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
              <div className="text-[10.5px] text-[var(--selene-accent-solar)] font-bold">
                3. IAU MOON_ME (LOLA)
              </div>
              <div className="text-[var(--selene-text)] font-semibold">
                {site.latitude.toFixed(3)}°, {site.longitude.toFixed(3)}°E
              </div>
              <p className="text-[11px] text-[var(--selene-text-muted)]">
                Mean Earth / Polar Axis datum (R₀ = 1737.4 km, Δr = {site.elevation_km.toFixed(2)} km).
              </p>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3.5 space-y-1">
              <div className="text-[10.5px] text-[var(--selene-accent-green)] font-bold">
                4. TOPOCENTRIC ENU
              </div>
              <div className="text-[var(--selene-text)] font-semibold">
                Sun {solarHorizon.elevationDeg.toFixed(2)}° · Earth {earthHorizon.elevationDeg.toFixed(2)}°
              </div>
              <p className="text-[11px] text-[var(--selene-text-muted)]">
                East-North-Up tangent plane raycast against 360° LOLA horizon mask.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3C. Position & Velocity / Sub-Solar & Sub-Earth State Vectors */}
      {activeSubsection === 'vectors' && (
        <section className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
          <h2 className="text-sm font-bold text-[var(--selene-text)]">
            Instantaneous Topocentric &amp; Selenographic State Vectors
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs tabular-nums">
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">EARTH-MOON RANGE</div>
              <div className="font-bold text-[var(--selene-accent-earth)] mt-1">
                {analyticalEph.earthMoonDistanceKm.toLocaleString()} km
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">SUB-SOLAR (ME)</div>
              <div className="font-bold text-[var(--selene-accent-solar)] mt-1">
                {analyticalEph.subSolarLatDeg.toFixed(2)}°, {analyticalEph.subSolarLonDeg.toFixed(1)}°E
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">SUB-EARTH LIBRATION</div>
              <div className="font-bold text-[var(--selene-accent-green)] mt-1">
                {analyticalEph.subEarthLatDeg.toFixed(2)}°, {analyticalEph.subEarthLonDeg.toFixed(2)}°E
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">SOLAR ENU (AZ/EL)</div>
              <div className="font-bold text-[var(--selene-text)] mt-1">
                {solarHorizon.azimuthDeg.toFixed(1)}° / {solarHorizon.elevationDeg.toFixed(2)}°
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">EARTH ENU (AZ/EL)</div>
              <div className="font-bold text-[var(--selene-text)] mt-1">
                {earthHorizon.azimuthDeg.toFixed(1)}° / {earthHorizon.elevationDeg.toFixed(2)}°
              </div>
            </div>
            <div className="bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] p-3">
              <div className="text-[10.5px] text-[var(--selene-text-muted)]">LUNAR PHASE</div>
              <div className="font-bold text-[var(--selene-accent-gold)] mt-1">
                {timeSnapshot.lunarPhase.phaseAngleDeg.toFixed(1)}° ({timeSnapshot.lunarPhase.illuminatedPercent}%)
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Dual Synchronized Time-Series Graph: Solar Elevation vs Earth Elevation with Shaded SPAC Windows */}
      {!fullscreenViewport && (
        <div className="bg-[var(--selene-surface)] border border-[var(--selene-border)] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--selene-text)]">
                Synchronized Solar Elevation (h☉) vs. Earth Elevation (h⊕) &amp; Shaded SPAC Windows
              </h3>
              <p className="text-xs font-mono text-[var(--selene-text-muted)]">
                Shaded Green Envelope Indicates Active Simultaneous Power &amp; Direct-to-Earth Communication (SPAC)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
              <span className="text-[var(--selene-accent-solar)] font-semibold">Solar El (°)</span>
              <span className="text-[var(--selene-accent-earth)] font-semibold">Earth El (°)</span>
              <span className="text-[var(--selene-accent-green)] font-semibold">SPAC Window Active</span>
            </div>
          </div>

          <div className="h-60 bg-[var(--selene-chart-bg)] border border-[var(--selene-border)] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dualSeriesData}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[-8, 12]}
                  tick={{ fill: 'var(--selene-chart-tick)', fontSize: 10.5, fontFamily: 'monospace' }}
                  unit="°"
                  width={36}
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
                <ReferenceLine y={0} stroke="var(--selene-chart-tick)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="stepAfter"
                  dataKey="spacBand"
                  baseValue={-8}
                  fill="#188038"
                  fillOpacity={0.14}
                  stroke="none"
                  name="SPAC Window"
                />
                <Line
                  type="monotone"
                  dataKey="solarEl"
                  stroke="#D9541E"
                  strokeWidth={2}
                  dot={false}
                  name="Solar Elevation (°)"
                />
                <Line
                  type="monotone"
                  dataKey="earthEl"
                  stroke="#00838F"
                  strokeWidth={2}
                  dot={false}
                  name="Earth Elevation (°)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Contextual Dataset Integration Slot */}
      {!fullscreenViewport && (
        <DatasetIntegrationSlot
          domain="ILLUMINATION_HORIZON_MASK"
          activeSourceLabel="JPL DE441-MOON_ME + Topocentric 360° Raycast Horizon Profile"
        />
      )}
    </div>
  );
}
