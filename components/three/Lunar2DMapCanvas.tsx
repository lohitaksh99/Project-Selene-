'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLASSIFICATION_META,
  LUNAR_GEOGRAPHIC_NOMENCLATURE,
  LUNAR_SURFACE_LOCATIONS,
  LunarLocationClassification,
  LunarSurfaceLocationEntry,
} from '@/lib/data/lunarBasesCatalog';
import { evaluateNaturalLunarAlbedo } from '@/lib/three/webglUtils';
import { sampleLunarTerrain } from '@/lib/terrain/lolaTerrainEngine';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  Compass,
  Crosshair,
  Eye,
  Grid,
  Layers,
  Maximize2,
  RotateCcw,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type Lunar2DProjectionMode = 'EQ' | 'SP' | 'NP';
export type Lunar2DOverlayMode = 'natural-wac' | 'lola-elevation' | 'slope-hazard' | 'psr-volatiles';

interface Lunar2DMapCanvasProps {
  sites?: LandingSiteRecord[];
  locations?: LunarSurfaceLocationEntry[];
  activeId: string;
  onSelectId: (id: string) => void;
  defaultProjection?: Lunar2DProjectionMode;
  controlledProjection?: Lunar2DProjectionMode;
  onProjectionChange?: (mode: Lunar2DProjectionMode) => void;
  heightClass?: string;
  filterClassifications?: LunarLocationClassification[];
}

function getEqMapDimensions(width: number, height: number, zoom: number) {
  const usableHeight = Math.max(200, height - 64);
  const mapW = Math.min(width * 0.9, usableHeight * 1.92) * zoom;
  const mapH = mapW / 2;
  return { mapW, mapH };
}

// Module-level cache for 2D basemap canvas & loaded NASA Moon Trek WMTS tile images
const basemapCanvasCache = new Map<string, HTMLCanvasElement>();
const loadedTileImages = new Map<string, HTMLImageElement>();

function getOrCreateEquirectangularBasemap(overlay: Lunar2DOverlayMode): HTMLCanvasElement {
  const cached = basemapCanvasCache.get(`eq:${overlay}`);
  if (cached) return cached;

  const width = 720;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let py = 0; py < height; py++) {
    // py=0 -> +90°N, py=height -> -90°S
    const latDeg = 90 - (py / height) * 180;
    for (let px = 0; px < width; px++) {
      const lonDeg = (px / width) * 360 - 180;
      const idx = (py * width + px) * 4;

      let elevNorm = 0.5;
      let slopeDeg = 3.5;
      let isPsr = false;

      if (latDeg <= -78) {
        const sample = sampleLunarTerrain(latDeg, lonDeg);
        elevNorm = Math.max(0, Math.min(1, ((sample.elevationM ?? 0) + 3500) / 8800));
        slopeDeg = sample.slopeDeg ?? 4.0;
        isPsr = sample.psrStatus === 'PERMANENT_SHADOW_LPSR';
      } else {
        const n1 = Math.sin(latDeg * 0.09) * Math.cos(lonDeg * 0.09);
        const n2 = Math.sin(latDeg * 0.27 + lonDeg * 0.21) * 0.45;
        const n3 = Math.cos(latDeg * 0.55 - lonDeg * 0.48) * 0.25;
        elevNorm = Math.max(0, Math.min(1, 0.52 + n1 * 0.22 + n2 * 0.15 + n3 * 0.1));
        slopeDeg = Math.abs(n2) * 16.0;
      }

      const baseGray = evaluateNaturalLunarAlbedo(latDeg, lonDeg, elevNorm, slopeDeg, isPsr);

      let r = baseGray;
      let g = Math.max(18, baseGray - 1);
      let b = Math.max(15, baseGray - 3);

      if (overlay === 'lola-elevation') {
        // Subtle scientific hypsometric tint blended 45% over the natural grayscale relief
        const hr = elevNorm < 0.5 ? Math.round(30 * elevNorm * 2) : Math.round(30 + 220 * (elevNorm - 0.5) * 2);
        const hg = elevNorm < 0.5 ? Math.round(90 + 140 * elevNorm * 2) : Math.round(230 - 90 * (elevNorm - 0.5) * 2);
        const hb = elevNorm < 0.5 ? Math.round(215 - 60 * elevNorm * 2) : Math.round(140 * (1 - (elevNorm - 0.5) * 2));
        r = Math.round(baseGray * 0.52 + hr * 0.48);
        g = Math.round(baseGray * 0.52 + hg * 0.48);
        b = Math.round(baseGray * 0.52 + hb * 0.48);
      } else if (overlay === 'slope-hazard') {
        if (slopeDeg <= 7.0) {
          r = Math.round(baseGray * 0.65 + 16 * 0.35);
          g = Math.round(baseGray * 0.65 + 185 * 0.35);
          b = Math.round(baseGray * 0.65 + 129 * 0.35);
        } else if (slopeDeg <= 15.0) {
          r = Math.round(baseGray * 0.55 + 245 * 0.45);
          g = Math.round(baseGray * 0.55 + 158 * 0.45);
          b = Math.round(baseGray * 0.55 + 11 * 0.45);
        } else {
          r = Math.round(baseGray * 0.5 + 239 * 0.5);
          g = Math.round(baseGray * 0.5 + 68 * 0.5);
          b = Math.round(baseGray * 0.5 + 68 * 0.5);
        }
      } else if (overlay === 'psr-volatiles' && (isPsr || Math.abs(latDeg) >= 82)) {
        if (isPsr) {
          r = 56;
          g = 189;
          b = 248;
        } else {
          r = Math.round(baseGray * 0.7 + 99 * 0.3);
          g = Math.round(baseGray * 0.7 + 102 * 0.3);
          b = Math.round(baseGray * 0.7 + 241 * 0.3);
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  basemapCanvasCache.set(`eq:${overlay}`, canvas);
  return canvas;
}

export default function Lunar2DMapCanvas({
  sites,
  locations,
  activeId,
  onSelectId,
  defaultProjection = 'EQ',
  controlledProjection,
  onProjectionChange,
  heightClass = 'h-[600px]',
  filterClassifications,
}: Lunar2DMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalProjection, setInternalProjection] =
    useState<Lunar2DProjectionMode>(defaultProjection);
  const projection = controlledProjection ?? internalProjection;
  const setProjection = useCallback(
    (nextMode: Lunar2DProjectionMode) => {
      if (controlledProjection === undefined) {
        setInternalProjection(nextMode);
      }
      onProjectionChange?.(nextMode);
    },
    [controlledProjection, onProjectionChange]
  );

  const [overlayMode, setOverlayMode] = useState<Lunar2DOverlayMode>('natural-wac');
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [nomenclatureMode, setNomenclatureMode] = useState<'tiered' | 'all' | 'off'>('tiered');
  const [showSiteLabels, setShowSiteLabels] = useState<boolean>(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{
    latDeg: number;
    lonDeg: number;
    elevationM: number;
    slopeDeg: number;
  }>({
    latDeg: 0.0,
    lonDeg: 0.0,
    elevationM: -1200,
    slopeDeg: 2.4,
  });
  const [tileLoadTick, setTileLoadTick] = useState<number>(0);

  // Normalize input items (either `locations` from LunarBasesWorkspace or `sites` from ExplorerWorkspace)
  const unifiedItems = useMemo(() => {
    if (locations && locations.length > 0) {
      return filterClassifications && filterClassifications.length > 0
        ? locations.filter((l) => filterClassifications.includes(l.classification))
        : locations;
    }
    if (sites && sites.length > 0) {
      return sites.map((s): LunarSurfaceLocationEntry => {
        const mappedClass: LunarLocationClassification =
          s.site_status === 'HISTORICAL_LANDING'
            ? 'HISTORICAL_LANDING_SITE'
            : s.site_status === 'CONFIRMED_LANDING'
              ? 'CONFIRMED_MISSION_SITE'
              : s.site_status === 'PLANNED_TARGET'
                ? 'PLANNED_MISSION_TARGET'
                : 'CANDIDATE_BASE_REGION';
        return {
          id: s.id,
          name: s.name,
          shortLabel: s.name.split('(')[0]!.trim(),
          classification: mappedClass,
          classificationBadge: (s.site_status ?? 'CANDIDATE_REGION').replace(/_/g, ' '),
          isConceptOrProposal: false,
          countryOrAgency:
            s.mission_category === 'INTERNATIONAL'
              ? 'ISRO (India)'
              : s.mission_category === 'CLPS'
                ? 'Commercial CLPS (USA)'
                : 'NASA (USA)',
          missionOrProgram: s.designation,
          dateOrWindow: 'Active Dossier',
          regionZone: s.latitude <= -65 ? 'SOUTH_POLE' : 'EQUATORIAL_NEARSIDE',
          latitude: s.latitude,
          longitude: s.longitude,
          elevationKm: s.elevation_km,
          meanSlopeDeg: s.slope_deg,
          psrProximityKm: s.psr_proximity_km,
          meanIlluminationPct: s.latitude <= -80 ? 81.5 : 50.0,
          dteVisibilityPct: s.latitude <= -80 ? 74.0 : 100.0,
          divinerTempRangeK: s.latitude <= -80 ? '38–125 K' : '95–388 K',
          scientificSummary: s.description,
          engineeringAndHabitatContext: s.scientific_value,
          sourceAttribution: 'LRO LOLA LDEM & LROC WAC/NAC Dossier',
          measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
          labelPriorityTier:
            s.id === 'shackleton-rim' ||
            s.id === 'malapert-massif' ||
            s.id === 'apollo-11-tranquility' ||
            s.id === 'isro-chandrayaan3-shiv-shakti'
              ? 1
              : 2,
          linkedSeleneSiteId: s.id,
        };
      });
    }
    return LUNAR_SURFACE_LOCATIONS;
  }, [locations, sites, filterClassifications]);

  // Preload official NASA Moon Trek WMTS tiles (EQ z=0 & z=1, SP z=0, NP z=0) asynchronously
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlsToLoad: Array<{ key: string; url: string }> = [
      {
        key: 'eq:z0:0:0',
        url: '/api/lunar/wmts?action=tile&projection=EQ&layer=LRO_WAC_Mosaic_Global_303ppd_v02&z=0&row=0&col=0&ext=jpg',
      },
      {
        key: 'eq:z0:0:1',
        url: '/api/lunar/wmts?action=tile&projection=EQ&layer=LRO_WAC_Mosaic_Global_303ppd_v02&z=0&row=0&col=1&ext=jpg',
      },
      {
        key: 'sp:z0:0:0',
        url: '/api/lunar/wmts?action=tile&projection=SP&layer=LRO_NAC_AvgMosaic_SPole855_1mp&z=0&row=0&col=0&ext=png',
      },
      {
        key: 'np:z0:0:0',
        url: '/api/lunar/wmts?action=tile&projection=NP&layer=LRO_LOLA_Count_NPole75_30mp_v04&z=0&row=0&col=0&ext=png',
      },
    ];

    // When zoomed in on EQ (zoom >= 1.8), also load z=1 (4x2 tile matrix) for crisp multi-resolution detail
    if (projection === 'EQ' && zoom >= 1.7) {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          urlsToLoad.push({
            key: `eq:z1:${r}:${c}`,
            url: `/api/lunar/wmts?action=tile&projection=EQ&layer=LRO_WAC_Mosaic_Global_303ppd_v02&z=1&row=${r}&col=${c}&ext=jpg`,
          });
        }
      }
    }

    urlsToLoad.forEach(({ key, url }) => {
      if (loadedTileImages.has(key)) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedTileImages.set(key, img);
        setTileLoadTick((t) => t + 1);
      };
      img.src = url;
    });
  }, [projection, zoom]);

  // Project (latDeg, lonDeg) to normalized map coordinates [-1..+1] before zoom/pan
  const projectLatLonToMapNorm = useCallback(
    (latDeg: number, lonDeg: number): { nx: number; ny: number; visible: boolean } => {
      if (projection === 'EQ') {
        const nx = lonDeg / 180; // -1..+1
        const ny = -latDeg / 90; // -1 (+90°N top) .. +1 (-90°S bottom)
        return { nx, ny, visible: true };
      }
      if (projection === 'SP') {
        if (latDeg > -55) return { nx: 0, ny: 0, visible: false };
        const r = Math.min(1.0, (90 + latDeg) / 30); // 90°S=0, 60°S=1.0
        const rad = (lonDeg * Math.PI) / 180;
        // 0°E (Sub-Earth) at top (ny < 0)
        return {
          nx: r * Math.sin(rad),
          ny: -r * Math.cos(rad),
          visible: r <= 1.02,
        };
      }
      // NP: 60°N to 90°N
      if (latDeg < 55) return { nx: 0, ny: 0, visible: false };
      const r = Math.min(1.0, (90 - latDeg) / 30);
      const rad = (lonDeg * Math.PI) / 180;
      return {
        nx: r * Math.sin(rad),
        ny: r * Math.cos(rad),
        visible: r <= 1.02,
      };
    },
    [projection]
  );

  // Inverse project canvas pixel (px, py) to selenographic (latDeg, lonDeg)
  const unprojectPixelToLatLon = useCallback(
    (
      px: number,
      py: number,
      width: number,
      height: number
    ): { latDeg: number; lonDeg: number } | null => {
      const cx = width / 2 + pan.x;
      const cy = (height - 24) / 2 + pan.y;

      if (projection === 'EQ') {
        const { mapW, mapH } = getEqMapDimensions(width, height, zoom);
        const nx = (px - cx) / (mapW / 2);
        const ny = (py - cy) / (mapH / 2);
        if (Math.abs(nx) > 1.0 || Math.abs(ny) > 1.0) return null;
        return {
          latDeg: Math.max(-90, Math.min(90, -ny * 90)),
          lonDeg: Math.max(-180, Math.min(180, nx * 180)),
        };
      }

      const radiusPx = Math.min(width, height - 32) * 0.40 * zoom;
      const nx = (px - cx) / radiusPx;
      const ny = (py - cy) / radiusPx;
      const r = Math.hypot(nx, ny);
      if (r > 1.0) return null;

      if (projection === 'SP') {
        const latDeg = -90 + r * 30;
        const lonDeg = (Math.atan2(nx, -ny) * 180) / Math.PI;
        return { latDeg, lonDeg };
      } else {
        const latDeg = 90 - r * 30;
        const lonDeg = (Math.atan2(nx, ny) * 180) / Math.PI;
        return { latDeg, lonDeg };
      }
    },
    [pan.x, pan.y, projection, zoom]
  );

  // Track rendered marker hitboxes for click & hover detection
  const markerScreenBoxesRef = useRef<
    Array<{ id: string; x: number; y: number; radius: number; entry: LunarSurfaceLocationEntry }>
  >([]);

  // Main 2D Canvas Render Loop (executes on state change — zero idle CPU spinning!)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(260, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Deep Lunar Vacuum Background (#101214)
    ctx.fillStyle = '#101214';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2 + pan.x;
    const cy = (height - 24) / 2 + pan.y;

    if (projection === 'EQ') {
      const { mapW, mapH } = getEqMapDimensions(width, height, zoom);
      const left = cx - mapW / 2;
      const top = cy - mapH / 2;

      // Draw synthesized natural/scientific basemap
      const baseCanvas = getOrCreateEquirectangularBasemap(overlayMode);
      ctx.drawImage(baseCanvas, left, top, mapW, mapH);

      // Composite live NASA Moon Trek WMTS LROC WAC tiles on top
      const tileAlpha = overlayMode === 'natural-wac' ? 0.88 : 0.45;
      ctx.save();
      ctx.globalAlpha = tileAlpha;

      const hasZ1 =
        zoom >= 1.7 &&
        loadedTileImages.has('eq:z1:0:0') &&
        loadedTileImages.has('eq:z1:0:1') &&
        loadedTileImages.has('eq:z1:1:0') &&
        loadedTileImages.has('eq:z1:1:1');

      if (hasZ1) {
        const tw = mapW / 4;
        const th = mapH / 2;
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            const img = loadedTileImages.get(`eq:z1:${r}:${c}`);
            if (img) {
              ctx.drawImage(img, left + c * tw, top + r * th, tw, th);
            }
          }
        }
      } else {
        const imgW = loadedTileImages.get('eq:z0:0:0');
        const imgE = loadedTileImages.get('eq:z0:0:1');
        if (imgW) ctx.drawImage(imgW, left, top, mapW / 2, mapH);
        if (imgE) ctx.drawImage(imgE, left + mapW / 2, top, mapW / 2, mapH);
      }
      ctx.restore();

      // Highlight South Polar Study Band (-80°S to -90°S) subtly
      const spTop = top + mapH * ((90 - -80) / 180);
      ctx.fillStyle = 'rgba(214, 195, 106, 0.09)';
      ctx.fillRect(left, spTop, mapW, top + mapH - spTop);
      ctx.strokeStyle = 'rgba(214, 195, 106, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(left, spTop);
      ctx.lineTo(left + mapW, spTop);
      ctx.stroke();
      ctx.setLineDash([]);

      // Optional Selenographic Graticule Grid
      if (showGraticule) {
        ctx.strokeStyle = 'rgba(233, 230, 222, 0.14)';
        ctx.lineWidth = 1;
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(184, 178, 165, 0.72)';

        for (let lon = -180; lon <= 180; lon += 30) {
          const x = left + ((lon + 180) / 360) * mapW;
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, top + mapH);
          ctx.stroke();
          if (lon % 60 === 0 && x >= 24 && x <= width - 24) {
            ctx.fillText(`${lon > 0 ? `+${lon}°E` : `${lon}°`}`, x - 14, top - 5);
          }
        }
        for (let lat = -60; lat <= 60; lat += 30) {
          const y = top + ((90 - lat) / 180) * mapH;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + mapW, y);
          ctx.stroke();
          if (left >= 36) {
            ctx.fillText(
              lat === 0 ? '0° EQ' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`,
              left - 34,
              y + 3
            );
          }
        }
      }

      // Crisp Map Frame Border
      ctx.strokeStyle = 'rgba(233, 230, 222, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left, top, mapW, mapH);
    } else {
      // Polar Stereographic Disk (SP or NP)
      const radiusPx = Math.min(width, height - 32) * 0.40 * zoom;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.clip();

      // Base polar fill
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radiusPx);
      grad.addColorStop(0, '#5A5E64');
      grad.addColorStop(0.6, '#42464B');
      grad.addColorStop(1, '#26292E');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radiusPx, cy - radiusPx, radiusPx * 2, radiusPx * 2);

      // Draw live NASA Moon Trek Polar WMTS tile if loaded
      const polarImg = loadedTileImages.get(projection === 'SP' ? 'sp:z0:0:0' : 'np:z0:0:0');
      if (polarImg) {
        ctx.globalAlpha = 0.72;
        ctx.drawImage(
          polarImg,
          cx - radiusPx * 0.75,
          cy - radiusPx * 0.75,
          radiusPx * 1.5,
          radiusPx * 1.5
        );
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();

      // Polar Graticule Rings (85°, 80°, 70°, 60°)
      if (showGraticule) {
        [85, 80, 70, 60].forEach((absLat) => {
          const rRing = ((90 - absLat) / 30) * radiusPx;
          ctx.strokeStyle =
            absLat === 85
              ? 'rgba(214, 195, 106, 0.65)'
              : absLat === 80
                ? 'rgba(56, 189, 248, 0.5)'
                : 'rgba(233, 230, 222, 0.18)';
          ctx.lineWidth = absLat >= 80 ? 1.4 : 1;
          ctx.beginPath();
          ctx.arc(cx, cy, rRing, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = absLat >= 80 ? '#D6C36A' : 'rgba(184, 178, 165, 0.75)';
          ctx.font = '9px monospace';
          ctx.fillText(
            `${absLat}°${projection === 'SP' ? 'S' : 'N'}`,
            cx + 4,
            cy - rRing + 10
          );
        });

        for (let az = 0; az < 360; az += 45) {
          const rad = (az * Math.PI) / 180;
          ctx.strokeStyle = 'rgba(233, 230, 222, 0.15)';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.sin(rad) * radiusPx, cy - Math.cos(rad) * radiusPx);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = 'rgba(214, 195, 106, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ============================================================================
    // 2. COLLISION-FREE ZOOM-AWARE LABEL & MARKER ENGINE (Fixes Screenshot 9)
    // ============================================================================
    const placedBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const intersectsAny = (box: { x1: number; y1: number; x2: number; y2: number }) =>
      placedBoxes.some(
        (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
      );

    const normToPixel = (nx: number, ny: number) => {
      if (projection === 'EQ') {
        const { mapW, mapH } = getEqMapDimensions(width, height, zoom);
        return { x: cx + nx * (mapW / 2), y: cy + ny * (mapH / 2) };
      }
      const radiusPx = Math.min(width, height - 32) * 0.40 * zoom;
      return { x: cx + nx * radiusPx, y: cy + ny * radiusPx };
    };

    const nextMarkerBoxes: Array<{
      id: string;
      x: number;
      y: number;
      radius: number;
      entry: LunarSurfaceLocationEntry;
    }> = [];

    // Sort locations so Active & Hovered sites are placed FIRST, followed by Tier 1, Tier 2, Tier 3
    const sortedLocations = [...unifiedItems].sort((a, b) => {
      const aActive = a.id === activeId || a.linkedSeleneSiteId === activeId ? -10 : 0;
      const bActive = b.id === activeId || b.linkedSeleneSiteId === activeId ? -10 : 0;
      const aHov = a.id === hoveredId ? -5 : 0;
      const bHov = b.id === hoveredId ? -5 : 0;
      return aActive + aHov + a.labelPriorityTier - (bActive + bHov + b.labelPriorityTier);
    });

    // Pass 1: Draw all geometric site symbols & reserve their icon hitboxes
    sortedLocations.forEach((loc) => {
      const proj = projectLatLonToMapNorm(loc.latitude, loc.longitude);
      if (!proj.visible) return;
      const { x, y } = normToPixel(proj.nx, proj.ny);
      if (x < 8 || x > width - 8 || y < 8 || y > height - 8) return;

      const isSelected = loc.id === activeId || loc.linkedSeleneSiteId === activeId;
      const isHovered = loc.id === hoveredId;
      const meta = CLASSIFICATION_META[loc.classification];
      const color = isSelected ? '#D6C36A' : meta.colorHex;
      const radius = isSelected ? 7.5 : isHovered ? 6.5 : 4.8;

      nextMarkerBoxes.push({ id: loc.id, x, y, radius: Math.max(10, radius + 4), entry: loc });

      // Reserve symbol box so labels don't draw directly over markers
      placedBoxes.push({
        x1: x - radius - 2,
        y1: y - radius - 2,
        x2: x + radius + 2,
        y2: y + radius + 2,
      });

      // Selected / Hovered Outer Target Halo
      if (isSelected || isHovered) {
        ctx.save();
        ctx.strokeStyle = isSelected ? '#D6C36A' : '#38BDF8';
        ctx.fillStyle = isSelected ? 'rgba(214, 195, 106, 0.22)' : 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Draw Category-Distinct Symbol Shape
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#101214';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      if (meta.symbolShape === 'diamond') {
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (meta.symbolShape === 'triangle') {
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y + radius * 0.85);
        ctx.lineTo(x - radius, y + radius * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (meta.symbolShape === 'square') {
        ctx.rect(x - radius * 0.8, y - radius * 0.8, radius * 1.6, radius * 1.6);
        ctx.fill();
        ctx.stroke();
      } else if (meta.symbolShape === 'ring') {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });

    markerScreenBoxesRef.current = nextMarkerBoxes;

    // Pass 2: Place Site Labels with strict bounding-box collision culling
    if (showSiteLabels) {
      ctx.font = 'bold 10px monospace';
      sortedLocations.forEach((loc) => {
        const isSelected = loc.id === activeId || loc.linkedSeleneSiteId === activeId;
        const isHovered = loc.id === hoveredId;

        // Zoom threshold filter for non-selected sites
        if (!isSelected && !isHovered) {
          if (loc.labelPriorityTier === 2 && zoom < 1.35 && projection === 'EQ') return;
          if (loc.labelPriorityTier === 3 && zoom < 2.1 && projection === 'EQ') return;
        }

        const proj = projectLatLonToMapNorm(loc.latitude, loc.longitude);
        if (!proj.visible) return;
        const { x, y } = normToPixel(proj.nx, proj.ny);
        if (x < 20 || x > width - 20 || y < 20 || y > height - 20) return;

        const labelText = isSelected ? `★ ${loc.shortLabel}` : loc.shortLabel;
        const textWidth = ctx.measureText(labelText).width;
        const boxW = textWidth + 10;
        const boxH = 16;

        // Candidate positions around marker (Right, Left, Top, Bottom)
        const candidates = [
          { lx: x + 10, ly: y - 8 },
          { lx: x - boxW - 10, ly: y - 8 },
          { lx: x - boxW / 2, ly: y - 24 },
          { lx: x - boxW / 2, ly: y + 10 },
        ];

        let chosen: { lx: number; ly: number } | null = null;
        for (const cand of candidates) {
          const testBox = {
            x1: cand.lx - 2,
            y1: cand.ly - 2,
            x2: cand.lx + boxW + 2,
            y2: cand.ly + boxH + 2,
          };
          if (
            testBox.x1 >= 6 &&
            testBox.x2 <= width - 6 &&
            testBox.y1 >= 6 &&
            testBox.y2 <= height - 6 &&
            (!intersectsAny(testBox) || isSelected || isHovered)
          ) {
            chosen = cand;
            placedBoxes.push(testBox);
            break;
          }
        }

        if (chosen) {
          const meta = CLASSIFICATION_META[loc.classification];
          ctx.fillStyle = isSelected
            ? 'rgba(214, 195, 106, 0.95)'
            : 'rgba(16, 18, 20, 0.88)';
          ctx.strokeStyle = isSelected ? '#D6C36A' : meta.colorHex;
          ctx.lineWidth = 1;
          ctx.fillRect(chosen.lx, chosen.ly, boxW, boxH);
          ctx.strokeRect(chosen.lx, chosen.ly, boxW, boxH);

          ctx.fillStyle = isSelected ? '#101214' : '#E9E6DE';
          ctx.fillText(labelText, chosen.lx + 5, chosen.ly + 11.5);
        }
      });
    }

    // Pass 3: Place IAU Geographic Nomenclature Labels (Maria, Basins, Craters) with collision avoidance
    if (nomenclatureMode !== 'off') {
      ctx.font = 'italic 10px serif';
      LUNAR_GEOGRAPHIC_NOMENCLATURE.forEach((nom) => {
        if (nomenclatureMode === 'tiered') {
          if (nom.priorityTier === 2 && zoom < 1.45 && projection === 'EQ') return;
          if (nom.priorityTier === 3 && zoom < 2.2 && projection === 'EQ') return;
        }
        const proj = projectLatLonToMapNorm(nom.latitude, nom.longitude);
        if (!proj.visible) return;
        const { x, y } = normToPixel(proj.nx, proj.ny);
        if (x < 30 || x > width - 30 || y < 24 || y > height - 24) return;

        const label = nom.name.toUpperCase();
        const tw = ctx.measureText(label).width;
        const testBox = {
          x1: x - tw / 2 - 4,
          y1: y - 8,
          x2: x + tw / 2 + 4,
          y2: y + 8,
        };

        if (!intersectsAny(testBox)) {
          placedBoxes.push(testBox);
          ctx.fillStyle = 'rgba(16, 18, 20, 0.65)';
          ctx.fillRect(testBox.x1, testBox.y1, tw + 8, 14);
          ctx.fillStyle =
            nom.featureType === 'MARE' || nom.featureType === 'BASIN'
              ? 'rgba(214, 195, 106, 0.78)'
              : 'rgba(184, 178, 165, 0.82)';
          ctx.fillText(label, x - tw / 2, y + 3);
        }
      });
    }

    ctx.restore();
  }, [
    activeId,
    hoveredId,
    nomenclatureMode,
    overlayMode,
    pan.x,
    pan.y,
    projectLatLonToMapNorm,
    projection,
    showGraticule,
    showSiteLabels,
    tileLoadTick,
    unifiedItems,
    zoom,
  ]);

  // Pointer Drag, Hover & Click Handlers
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
      return;
    }

    // Check marker hover
    const hit = markerScreenBoxesRef.current.find(
      (m) => Math.hypot(px - m.x, py - m.y) <= m.radius
    );
    setHoveredId(hit ? hit.id : null);

    // Update live selenographic coordinate & LOLA DEM readout
    const coords = unprojectPixelToLatLon(px, py, rect.width, rect.height);
    if (coords) {
      const sample = sampleLunarTerrain(coords.latDeg, coords.lonDeg);
      setCursorCoords({
        latDeg: coords.latDeg,
        lonDeg: coords.lonDeg,
        elevationM: sample.elevationM ?? 0,
        slopeDeg: sample.slopeDeg ?? 3.5,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const movedDist = Math.hypot(
      e.clientX - dragRef.current.startX,
      e.clientY - dragRef.current.startY
    );
    dragRef.current.active = false;

    if (movedDist < 5) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const hit = markerScreenBoxesRef.current.find(
        (m) => Math.hypot(px - m.x, py - m.y) <= m.radius
      );
      if (hit) {
        onSelectId(hit.entry.linkedSeleneSiteId || hit.entry.id);
      }
    }
  };

  const handleFlyToActive = () => {
    const target =
      unifiedItems.find((i) => i.id === activeId || i.linkedSeleneSiteId === activeId) ??
      unifiedItems[0];
    if (!target) return;
    if (target.latitude <= -75 && projection !== 'SP') {
      setProjection('SP');
      setZoom(1.4);
      setPan({ x: 0, y: 0 });
    } else {
      setProjection('EQ');
      setZoom(2.2);
      setPan({ x: 0, y: 0 });
    }
  };

  const hoveredEntry = unifiedItems.find((i) => i.id === hoveredId);

  return (
    <div
      className={`relative w-full ${heightClass} bg-[var(--selene-surface)] border border-[var(--selene-border)] overflow-hidden select-none flex flex-col`}
      data-testid="lunar-2d-map-canvas"
    >
      {/* Top Scientific GIS Control Bar */}
      <div className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono z-10 shrink-0">
        {/* Projection Selector */}
        <div className="flex flex-wrap items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-[var(--selene-accent-gold)] mr-1" />
          {(
            [
              { id: 'EQ', label: 'Global Equirectangular (WAC)' },
              { id: 'SP', label: 'South Polar Stereo (60°S–90°S)' },
              { id: 'NP', label: 'North Polar Stereo (60°N–90°N)' },
            ] as const
          ).map((proj) => (
            <button
              key={proj.id}
              type="button"
              onClick={() => {
                setProjection(proj.id);
                setPan({ x: 0, y: 0 });
                setZoom(1.0);
              }}
              className={`px-2 py-1 border transition-colors ${
                projection === proj.id
                  ? 'bg-[var(--selene-accent-yellow)] text-[#111111] border-[#111111] font-bold'
                  : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-secondary)] border-[var(--selene-border)] hover:text-[var(--selene-text)]'
              }`}
            >
              {proj.label}
            </button>
          ))}
        </div>

        {/* Basemap & Overlay Mode Selector */}
        <div className="flex flex-wrap items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-[var(--selene-accent-earth)] mr-1" />
          {(
            [
              { id: 'natural-wac', label: 'Natural WAC Basemap' },
              { id: 'lola-elevation', label: 'LOLA Elevation' },
              { id: 'slope-hazard', label: 'Slope Screening' },
              { id: 'psr-volatiles', label: 'PSR & Volatiles' },
            ] as const
          ).map((ov) => (
            <button
              key={ov.id}
              type="button"
              onClick={() => setOverlayMode(ov.id)}
              className={`px-2 py-1 border transition-colors ${
                overlayMode === ov.id
                  ? 'bg-[#007A91]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-bold'
                  : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-secondary)] border-[var(--selene-border)] hover:text-[var(--selene-text)]'
              }`}
            >
              {ov.label}
            </button>
          ))}
        </div>

        {/* Label Decluttering & Graticule Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGraticule(!showGraticule)}
            className={`inline-flex items-center gap-1 px-2 py-1 border ${
              showGraticule
                ? 'bg-[#22C55E]/15 text-[var(--selene-accent-green)] border-[#22C55E]/50 font-semibold'
                : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-muted)] border-[var(--selene-border)]'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setNomenclatureMode((prev) =>
                prev === 'tiered' ? 'all' : prev === 'all' ? 'off' : 'tiered'
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)]"
          >
            <Tag className="w-3 h-3 text-[var(--selene-accent-gold)]" />
            <span>IAU Names: {nomenclatureMode.toUpperCase()}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSiteLabels(!showSiteLabels)}
            className={`inline-flex items-center gap-1 px-2 py-1 border ${
              showSiteLabels
                ? 'bg-[var(--selene-accent-yellow)] text-[#111111] border-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] text-[var(--selene-text-muted)] border-[var(--selene-border)]'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Site Labels</span>
          </button>
        </div>
      </div>

      {/* Interactive 2D Canvas Stage */}
      <div className="relative flex-1 min-h-0 selene-3d-canvas-stage">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.18 : 0.85;
            setZoom((z) => Math.max(0.9, Math.min(6.0, Number((z * delta).toFixed(2)))));
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Zoom & Fly-To Compact Stack */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 bg-[#14171A]/95 border border-[#E9E6DE]/20 p-1.5 font-mono text-xs">
          <button
            type="button"
            title="Zoom In"
            onClick={() => setZoom((z) => Math.min(6.0, Number((z * 1.25).toFixed(2))))}
            className="p-1.5 bg-[#101214] text-[#E9E6DE] hover:border-[#D6C36A] border border-[#E9E6DE]/20"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom Out"
            onClick={() => setZoom((z) => Math.max(0.9, Number((z * 0.8).toFixed(2))))}
            className="p-1.5 bg-[#101214] text-[#E9E6DE] hover:border-[#D6C36A] border border-[#E9E6DE]/20"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Reset View"
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 bg-[#101214] text-[#B8B2A5] hover:text-[#E9E6DE] border border-[#E9E6DE]/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Fly To Active Target"
            onClick={handleFlyToActive}
            className="px-2 py-1 bg-[#F1F52E] text-[#111111] font-bold text-[10px] uppercase tracking-wider"
          >
            Fly To
          </button>
        </div>

        {/* Hovered Location Callout Tooltip */}
        {hoveredEntry && (
          <div className="absolute top-3 left-3 max-w-xs bg-[#101214]/95 border border-[#D6C36A] p-3 space-y-1 font-mono text-xs pointer-events-none shadow-xl">
            <div className="text-[10px] text-[#D6C36A] font-bold uppercase">
              {hoveredEntry.classificationBadge}
            </div>
            <div className="font-bold text-[#E9E6DE]">{hoveredEntry.name}</div>
            <div className="text-[11px] text-[#38BDF8] tabular-nums">
              {hoveredEntry.latitude < 0
                ? `${Math.abs(hoveredEntry.latitude).toFixed(2)}°S`
                : `${hoveredEntry.latitude.toFixed(2)}°N`}
              , {hoveredEntry.longitude.toFixed(2)}°E · Elev {hoveredEntry.elevationKm >= 0 ? '+' : ''}
              {hoveredEntry.elevationKm.toFixed(2)} km
            </div>
            <div className="text-[10px] text-[#B8B2A5]">
              {hoveredEntry.countryOrAgency} · {hoveredEntry.missionOrProgram}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Docked Telemetry & Symbol Legend Bar (Outside Canvas) */}
      <div className="bg-[var(--selene-surface-alt)] border-t border-[var(--selene-border)] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--selene-text-muted)] shrink-0">
        <div className="flex flex-wrap items-center gap-2 tabular-nums">
          <Crosshair className="w-3 h-3 text-[var(--selene-accent-earth)]" />
          <span className="text-[var(--selene-text)] font-bold">
            CURSOR:{' '}
            {cursorCoords.latDeg < 0
              ? `${Math.abs(cursorCoords.latDeg).toFixed(2)}°S`
              : `${cursorCoords.latDeg.toFixed(2)}°N`}
            , {cursorCoords.lonDeg.toFixed(2)}°E
          </span>
          <span>·</span>
          <span>LDEM: {cursorCoords.elevationM} m</span>
          <span>·</span>
          <span>Slope: {cursorCoords.slopeDeg.toFixed(1)}°</span>
          <span>·</span>
          <span className="text-[var(--selene-accent-gold)] font-semibold">Zoom: {zoom.toFixed(2)}×</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#10B981] inline-block" /> Historical
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rotate-45 bg-[#38BDF8] inline-block" /> Confirmed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#F4C542] inline-block" /> Planned
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border-2 border-[#D6C36A] inline-block" /> Candidate Region
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#A855F7] inline-block" /> Proposed/Concept
          </span>
        </div>
      </div>
    </div>
  );
}
