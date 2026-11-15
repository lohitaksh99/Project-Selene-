'use client';

import React from 'react';
import { HorizonCoordinates, HorizonMaskSample } from '@/lib/astrodynamics/coordinateFrames';

interface HorizonPolarRadarProps {
  horizonProfile: HorizonMaskSample[];
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
  minSolarElevationDeg: number;
  minEarthElevationDeg: number;
  size?: number;
}

/**
 * Maps topocentric (azimuthDeg, elevationDeg) into 2D polar radar coordinates.
 * Outer ring = -6° elevation, Bold Horizon circle = 0° elevation, Center = +18° elevation (expanded polar horizon scale
 * so grazing lunar polar elevations between -5° and +15° are crystal-clear and inspectable).
 */
export default function HorizonPolarRadar({
  horizonProfile,
  solarHorizon,
  earthHorizon,
  minSolarElevationDeg,
  minEarthElevationDeg,
  size = 420,
}: HorizonPolarRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.39;

  // Map elevation [-6 deg .. +18 deg] -> radius [maxR .. 0]
  const elToRadius = (elDeg: number) => {
    const clamped = Math.max(-6, Math.min(18, elDeg));
    const norm = (18 - clamped) / 24.0; // +18° -> 0 (center), 0° -> 0.75 * maxR, -6° -> maxR
    return norm * maxR;
  };

  const azElToXY = (azDeg: number, elDeg: number) => {
    const r = elToRadius(elDeg);
    const rad = ((azDeg - 90) * Math.PI) / 180.0; // 0° Azimuth = True North (top)
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Build LOLA terrain obstacle polygon path (from outer -6° rim to terrain elevation)
  const terrainPoints = horizonProfile.map((pt) =>
    azElToXY(pt.azimuthDeg, pt.terrainElevationDeg)
  );
  const innerPolyStr = terrainPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ') + ' Z';

  const sunPt = azElToXY(solarHorizon.azimuthDeg, solarHorizon.elevationDeg);
  const earthPt = azElToXY(earthHorizon.azimuthDeg, earthHorizon.elevationDeg);
  const rZeroHorizon = elToRadius(0);
  const rSolarMin = elToRadius(minSolarElevationDeg);
  const rEarthMin = elToRadius(minEarthElevationDeg);

  return (
    <div className="flex flex-col items-center justify-center bg-[var(--selene-surface)] border border-[var(--selene-border)] p-4">
      <svg
        width={size}
        height={size}
        viewBox={`-16 -4 ${size + 32} ${size + 8}`}
        className="max-w-full h-auto select-none"
        role="img"
        aria-label="360-Degree Topocentric Celestial Horizon Polar Radar"
      >
        {/* Outer Radar Disk (-6° to +18° Topocentric Horizon Band) */}
        <circle
          cx={cx}
          cy={cy}
          r={maxR}
          fill="#0A0E17"
          stroke="#2B303B"
          strokeWidth={1.5}
        />

        {/* LOLA Topographic Horizon Mask Ring (shaded terrain outside inner sky aperture) */}
        <path
          d={`M ${cx - maxR} ${cy} A ${maxR} ${maxR} 0 1 0 ${cx + maxR} ${cy} A ${maxR} ${maxR} 0 1 0 ${cx - maxR} ${cy} Z ${innerPolyStr}`}
          fill="rgba(217, 84, 30, 0.18)"
          fillRule="evenodd"
        />
        <path
          d={innerPolyStr}
          fill="none"
          stroke="#D9541E"
          strokeWidth={1.75}
          strokeDasharray="3 2"
        />

        {/* Elevation Reference Circles (-4°, 0° Geometric Horizon, +5°, +10°, +15°) */}
        {[-4, 0, 5, 10, 15].map((el) => {
          const r = elToRadius(el);
          const isZero = el === 0;
          return (
            <g key={el}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={isZero ? '#F3EEE3' : '#2B303B'}
                strokeOpacity={isZero ? 0.65 : 0.85}
                strokeWidth={isZero ? 1.4 : 1}
                strokeDasharray={isZero ? undefined : '2 3'}
              />
              <text
                x={cx + 4}
                y={cy - r + 12}
                fill="#E9E6DE"
                fillOpacity={0.78}
                fontSize={10.5}
                fontFamily="monospace"
              >
                {el >= 0 ? `+${el}°` : `${el}°`}
              </text>
            </g>
          );
        })}

        {/* Engineering Minimum Threshold Circles */}
        <circle
          cx={cx}
          cy={cy}
          r={rSolarMin}
          fill="none"
          stroke="#F59E0B"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <circle
          cx={cx}
          cy={cy}
          r={rEarthMin}
          fill="none"
          stroke="#38BDF8"
          strokeOpacity={0.5}
          strokeWidth={1}
        />

        {/* Azimuth Spokes (every 45°) */}
        {[
          { az: 0, label: '0° N (EARTH)' },
          { az: 45, label: '45° NE' },
          { az: 90, label: '90° E' },
          { az: 135, label: '135° SE' },
          { az: 180, label: '180° S' },
          { az: 225, label: '225° SW' },
          { az: 270, label: '270° W' },
          { az: 315, label: '315° NW' },
        ].map(({ az, label }) => {
          const rad = ((az - 90) * Math.PI) / 180.0;
          const x2 = cx + maxR * Math.cos(rad);
          const y2 = cy + maxR * Math.sin(rad);
          const lx = cx + (maxR + 22) * Math.cos(rad);
          const ly = cy + (maxR + 16) * Math.sin(rad);
          return (
            <g key={az}>
              <line
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="#2B303B"
                strokeWidth={1}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={az === 0 ? '#38BDF8' : '#E9E6DE'}
                fillOpacity={az === 0 ? 1 : 0.82}
                fontSize={10.5}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Line from Center to Sun & Earth Reticles */}
        <line
          x1={cx}
          y1={cy}
          x2={sunPt.x}
          y2={sunPt.y}
          stroke="#D9541E"
          strokeWidth={1.5}
          strokeOpacity={0.75}
        />
        <line
          x1={cx}
          y1={cy}
          x2={earthPt.x}
          y2={earthPt.y}
          stroke="#38BDF8"
          strokeWidth={1.5}
          strokeOpacity={0.75}
        />

        {/* Sun Vector Target Marker */}
        <g transform={`translate(${sunPt.x}, ${sunPt.y})`}>
          <circle r={9} fill="#D9541E" fillOpacity={0.25} stroke="#D9541E" strokeWidth={1.5} />
          <circle r={4} fill="#F59E0B" />
          <text
            x={12}
            y={4}
            fill="#F3EEE3"
            fontSize={11}
            fontFamily="monospace"
            fontWeight="bold"
          >
            SUN ({solarHorizon.elevationDeg >= 0 ? '+' : ''}
            {solarHorizon.elevationDeg.toFixed(1)}°)
          </text>
        </g>

        {/* Earth Vector Target Marker */}
        <g transform={`translate(${earthPt.x}, ${earthPt.y})`}>
          <circle r={9} fill="#38BDF8" fillOpacity={0.22} stroke="#38BDF8" strokeWidth={1.5} />
          <circle r={4} fill="#22C55E" />
          <text
            x={12}
            y={-6}
            fill="#38BDF8"
            fontSize={11}
            fontFamily="monospace"
            fontWeight="bold"
          >
            EARTH ({earthHorizon.elevationDeg >= 0 ? '+' : ''}
            {earthHorizon.elevationDeg.toFixed(1)}°)
          </text>
        </g>

        {/* Center Topocentric Zenith Crosshair */}
        <circle cx={cx} cy={cy} r={2.5} fill="#F3EEE3" />
      </svg>

      {/* Legend Strip */}
      <div className="mt-3 pt-2.5 border-t border-[var(--selene-border)] w-full flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-[var(--selene-text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[var(--selene-accent-amber)] inline-block" />
          <span>Solar Vector (h☉)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[var(--selene-accent-earth)] inline-block" />
          <span>Earth DTE Vector (h⊕)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[var(--selene-accent-solar)] inline-block" />
          <span>LOLA 360° Horizon Mask</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[var(--selene-text-muted)] inline-block" />
          <span>0° Reference ({rZeroHorizon.toFixed(0)}px)</span>
        </span>
      </div>
    </div>
  );
}
