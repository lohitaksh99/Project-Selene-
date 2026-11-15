'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { detectSoftwareGl, scheduleAfterDraw } from '@/lib/three/webglUtils';
import { MoonTrekGisLayer, useSeleneStore } from '@/lib/store/useSeleneStore';
import {
  SOUTH_POLE_FEATURES,
  TerrainSample,
  latLonToPolarStereo,
  polarStereoToLatLon,
  sampleLunarTerrain,
} from '@/lib/terrain/lolaTerrainEngine';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Info,
  MapPin,
  Ruler,
  ShieldAlert,
} from 'lucide-react';

interface MoonTrekViewerProps {
  layers: MoonTrekGisLayer[];
  highlightedLayerId: string | null;
  projection: 'stereographic' | 'globe3d';
  showGraticule: boolean;
  solarAzimuthDeg: number;
  sites: LandingSiteRecord[];
  activeSiteId: string;
  onSelectSite: (siteId: string) => void;
}

const STEREO_MAX_RADIUS_M = 310000; // ~80°S boundary in South Polar Stereographic meters
const WORLD_DISK_RADIUS = 5.6;

// Module-level canvas cache for GIS layers so switching tabs or toggling views is instantaneous
const gisLayerCanvasCache = new Map<string, HTMLCanvasElement>();

/**
 * Generates a dedicated 256x256 South Polar Stereographic GIS layer texture
 * using the calibrated LOLA terrain engine & verified crater/feature catalog.
 */
function generateGisLayerTexture(
  layerId: string,
  isHighlighted: boolean,
  renderer: THREE.WebGLRenderer,
  safeMaxSlopeDeg = 7.0,
  cautionMaxSlopeDeg = 15.0
): THREE.CanvasTexture {
  const cacheKey = `${layerId}:${isHighlighted ? 'hl' : 'std'}:${safeMaxSlopeDeg.toFixed(1)}:${cautionMaxSlopeDeg.toFixed(1)}`;
  const cachedCanvas = gisLayerCanvasCache.get(cacheKey);
  if (cachedCanvas) {
    const tex = new THREE.CanvasTexture(cachedCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const half = size / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px - half) / half;
      const ny = (half - py) / half;
      const rNorm = Math.sqrt(nx * nx + ny * ny);
      const idx = (py * size + px) * 4;

      if (rNorm > 1.0) {
        data[idx + 3] = 0;
        continue;
      }

      const xM = nx * STEREO_MAX_RADIUS_M;
      const yM = ny * STEREO_MAX_RADIUS_M;
      const { latDeg, lonDeg } = polarStereoToLatLon(xM, yM);
      const sample = sampleLunarTerrain(latDeg, lonDeg);
      const elevM = sample.elevationM ?? 0;
      const elevNorm = Math.max(0, Math.min(1, (elevM + 3200) / 8400));
      const slopeDeg = sample.slopeDeg ?? 4.0;
      const ldec = sample.measurementSupportLdec ?? 0;
      const isPsr = sample.psrStatus === 'PERMANENT_SHADOW_LPSR';

      let r = 120,
        g = 120,
        b = 125,
        a = 235;

      if (layerId === 'lroc-wac-mosaic') {
        const shade = isPsr ? 24 : Math.round(72 + elevNorm * 145 - slopeDeg * 1.2);
        r = shade;
        g = shade;
        b = shade + 4;
        a = 255;
      } else if (layerId === 'lroc-nac-controlled') {
        // High-resolution controlled NAC ROI within 85°S-90°S (rNorm < 0.52)
        if (rNorm < 0.55) {
          const fine = Math.round(95 + elevNorm * 145 + Math.sin(px * 0.8) * 12);
          r = fine;
          g = fine - 2;
          b = fine - 6;
          a = 235;
        } else {
          a = 0;
        }
      } else if (layerId === 'lroc-nac-uncontrolled') {
        // Discrete narrow NAC strip footprints across Shackleton/Haworth/Cabeus
        const inStrip = Math.abs(nx - 0.08) < 0.14 && Math.abs(ny - 0.12) < 0.45;
        if (inStrip) {
          r = 245;
          g = 185;
          b = 75;
          a = 200;
        } else {
          a = 0;
        }
      } else if (layerId === 'lola-dem-hypsometric') {
        if (elevNorm < 0.25) {
          const t = elevNorm / 0.25;
          r = Math.round(35 * (1 - t));
          g = Math.round(85 * t);
          b = Math.round(160 + 95 * t);
        } else if (elevNorm < 0.5) {
          const t = (elevNorm - 0.25) / 0.25;
          r = Math.round(30 * t);
          g = Math.round(85 + 160 * t);
          b = Math.round(250 * (1 - t * 0.55));
        } else if (elevNorm < 0.75) {
          const t = (elevNorm - 0.5) / 0.25;
          r = Math.round(30 + 225 * t);
          g = Math.round(245 - 45 * t);
          b = Math.round(100 * (1 - t));
        } else {
          const t = (elevNorm - 0.75) / 0.25;
          r = 255;
          g = Math.round(200 - 105 * (1 - t * 0.5));
          b = Math.round(185 * t);
        }
        a = 225;
      } else if (layerId === 'lola-slope-hazard') {
        if (slopeDeg <= safeMaxSlopeDeg) {
          r = 16;
          g = 185;
          b = 129;
          a = 140;
        } else if (slopeDeg <= cautionMaxSlopeDeg) {
          r = 245;
          g = 158;
          b = 11;
          a = 195;
        } else {
          r = 239;
          g = 68;
          b = 68;
          a = 235;
        }
      } else if (layerId === 'lola-ldec-uncertainty') {
        if (ldec > 0) {
          r = 16;
          g = 185;
          b = 129;
          a = 180;
        } else {
          // LDEC == 0 gap-interpolated cell
          r = 245;
          g = 158;
          b = 11;
          a = 235;
        }
      } else if (layerId === 'psr-cold-traps') {
        if (isPsr) {
          r = 99;
          g = 102;
          b = 241;
          a = isHighlighted ? 245 : 215;
        } else {
          a = 0;
        }
      } else if (layerId === 'diviner-bolometric-temp') {
        if (sample.divinerMaxTempK <= 110) {
          r = 168;
          g = 85;
          b = 247;
          a = 215;
        } else {
          r = 234;
          g = 88;
          b = 12;
          a = 95;
        }
      } else if (layerId === 'lcross-lend-ice') {
        const weh = sample.lendWehWtPct;
        if (weh >= 1.2) {
          r = 56;
          g = 189;
          b = 248;
          a = Math.min(235, Math.round(weh * 110));
        } else {
          a = 0;
        }
      } else if (layerId === 'grail-bouguer-gravity') {
        const gVal = Math.sin(nx * 4.5 + ny * 3.2) * 0.5 + 0.5;
        r = Math.round(214 * gVal + 40 * (1 - gVal));
        g = Math.round(195 * gVal + 90 * (1 - gVal));
        b = Math.round(106 * gVal + 210 * (1 - gVal));
        a = 165;
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Overlay crisp crater rim vectors & LCROSS Cabeus impact marker when highlighted
  if (isHighlighted || layerId === 'lcross-lend-ice' || layerId === 'grail-bouguer-gravity') {
    SOUTH_POLE_FEATURES.forEach((feat) => {
      const st = latLonToPolarStereo(feat.latDeg, feat.lonDeg);
      const cx = half + (st.xM / STEREO_MAX_RADIUS_M) * half;
      const cy = half - (st.yM / STEREO_MAX_RADIUS_M) * half;
      const radPx = Math.max(4, ((feat.diameterKm * 500) / STEREO_MAX_RADIUS_M) * half);

      ctx.strokeStyle = isHighlighted ? '#D6C36A' : 'rgba(233, 230, 222, 0.55)';
      ctx.lineWidth = isHighlighted ? 2.0 : 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.stroke();

      if (feat.id === 'feat-cabeus' && layerId === 'lcross-lend-ice') {
        ctx.fillStyle = '#F4C542';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  gisLayerCanvasCache.set(cacheKey, canvas);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export default function MoonTrekViewer({
  layers,
  highlightedLayerId,
  projection,
  showGraticule,
  solarAzimuthDeg,
  sites,
  activeSiteId,
  onSelectSite,
}: MoonTrekViewerProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const {
    hoveredSpatialPoint,
    setHoveredSpatialPoint,
    activeTransectLine,
    setActiveTransectLine,
    selectedFeatureId,
    setSelectedFeatureId,
    landerSlopeThresholds,
    activeLiveWmtsLayer,
    activeLiveLrocWmsLayer,
  } = useSeleneStore();

  const [gisToolMode, setGisToolMode] = useState<'inspect' | 'transect-a' | 'transect-b'>('inspect');
  const [cursorSample, setCursorSample] = useState<TerrainSample>(() =>
    sampleLunarTerrain(-89.67, 129.78)
  );
  const [showDossier, setShowDossier] = useState(true);

  const selectedFeature = useMemo(
    () =>
      SOUTH_POLE_FEATURES.find((f) => f.id === selectedFeatureId) ??
      SOUTH_POLE_FEATURES[0]!,
    [selectedFeatureId]
  );

  const activeGeodeticWarnings = useMemo(
    () =>
      layers.filter((l) => l.visible && l.geodeticControlWarning),
    [layers]
  );

  const propsRef = useRef({
    layers,
    highlightedLayerId,
    projection,
    showGraticule,
    solarAzimuthDeg,
    sites,
    activeSiteId,
    onSelectSite,
    gisToolMode,
    activeTransectLine,
    hoveredSpatialPoint,
    landerSlopeThresholds,
  });

  useEffect(() => {
    propsRef.current = {
      layers,
      highlightedLayerId,
      projection,
      showGraticule,
      solarAzimuthDeg,
      sites,
      activeSiteId,
      onSelectSite,
      gisToolMode,
      activeTransectLine,
      hoveredSpatialPoint,
      landerSlopeThresholds,
    };
  });

  const runtimeRef = useRef<{
    layerMeshes: Map<string, { stereoMat: THREE.MeshStandardMaterial; globeMat: THREE.MeshStandardMaterial }>;
    liveOverlayStereoMat?: THREE.MeshStandardMaterial;
    liveOverlayGlobeMat?: THREE.MeshStandardMaterial;
    stereoGroup?: THREE.Group;
    globeGroup?: THREE.Group;
    graticuleGroup?: THREE.Group;
    transectLineMesh?: THREE.Line;
    crosshairMesh?: THREE.Mesh;
    renderer?: THREE.WebGLRenderer;
    lastHighlightedId: string | null;
    lastSafeSlope: number;
  }>({
    layerMeshes: new Map(),
    lastHighlightedId: null,
    lastSafeSlope: 7.0,
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101214);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 250);
    camera.position.set(0, 14.0, 5.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.5;
    controls.maxDistance = 26.0;
    controls.target.set(0, 0, 0);
    controls.update();

    const grazingSunLight = new THREE.DirectionalLight(0xfff4e0, 3.0);
    grazingSunLight.position.set(16, 4.0, 16);
    scene.add(grazingSunLight);

    const earthshineAmbient = new THREE.AmbientLight(0xd6c36a, 0.22);
    scene.add(earthshineAmbient);

    const stereoGroup = new THREE.Group();
    scene.add(stereoGroup);

    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];

    const bezelGeo = new THREE.RingGeometry(5.62, 5.92, 64);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x202428,
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    disposableGeos.push(bezelGeo);
    disposableMats.push(bezelMat);
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.rotation.x = -Math.PI / 2;
    stereoGroup.add(bezelMesh);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const layerMap = new Map<
      string,
      { stereoMat: THREE.MeshStandardMaterial; globeMat: THREE.MeshStandardMaterial }
    >();

    // True LOLA DEM Displaced South Polar Stereographic Plane Geometry
    const gridSegs = isSoftwareGl ? 64 : 112;
    const baseStereoGeo = new THREE.PlaneGeometry(
      WORLD_DISK_RADIUS * 2,
      WORLD_DISK_RADIUS * 2,
      gridSegs,
      gridSegs
    );
    baseStereoGeo.rotateX(-Math.PI / 2);
    disposableGeos.push(baseStereoGeo);

    const posAttr = baseStereoGeo.attributes.position!;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const rWorld = Math.sqrt(vx * vx + vz * vz);
      if (rWorld <= WORLD_DISK_RADIUS) {
        const xM = (vx / WORLD_DISK_RADIUS) * STEREO_MAX_RADIUS_M;
        const yM = (-vz / WORLD_DISK_RADIUS) * STEREO_MAX_RADIUS_M;
        const { latDeg, lonDeg } = polarStereoToLatLon(xM, yM);
        const sample = sampleLunarTerrain(latDeg, lonDeg);
        const elevKm = (sample.elevationM ?? 0) / 1000.0;
        posAttr.setY(i, elevKm * 0.085);
      } else {
        // Clamp outside circle rim
        const scale = WORLD_DISK_RADIUS / Math.max(1e-5, rWorld);
        posAttr.setX(i, vx * scale);
        posAttr.setZ(i, vz * scale);
        posAttr.setY(i, 0);
      }
    }
    baseStereoGeo.computeVertexNormals();

    propsRef.current.layers.forEach((layer, idx) => {
      const tex = generateGisLayerTexture(
        layer.id,
        propsRef.current.highlightedLayerId === layer.id,
        renderer,
        propsRef.current.landerSlopeThresholds.slopeSafeMaxDeg,
        propsRef.current.landerSlopeThresholds.slopeCautionMaxDeg
      );

      const initialAlpha = layer.visible ? layer.opacity / 100 : 0;

      const stereoMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        transparent: true,
        opacity: initialAlpha,
        roughness: 0.82,
        metalness: 0.06,
        depthWrite: idx === 0,
        polygonOffset: true,
        polygonOffsetFactor: -idx,
        polygonOffsetUnits: -idx,
      });
      disposableMats.push(stereoMat);
      const stereoMesh = new THREE.Mesh(baseStereoGeo, stereoMat);
      stereoMesh.position.y = idx * 0.014;
      stereoMesh.renderOrder = idx;
      stereoGroup.add(stereoMesh);

      const globeGeo = new THREE.SphereGeometry(4.6 + idx * 0.01, 48, 36);
      const globeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        transparent: true,
        opacity: initialAlpha,
        roughness: 0.82,
        metalness: 0.06,
        depthWrite: idx === 0,
      });
      disposableGeos.push(globeGeo);
      disposableMats.push(globeMat);
      const globeMesh = new THREE.Mesh(globeGeo, globeMat);
      globeMesh.renderOrder = idx;
      globeGroup.add(globeMesh);

      layerMap.set(layer.id, { stereoMat, globeMat });
    });

    // Dedicated Live NASA Moon Trek WMTS / LROC Lunaserv WMS Draping Layer
    const liveOverlayStereoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      visible: false,
      roughness: 0.78,
      metalness: 0.05,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -12,
      polygonOffsetUnits: -12,
    });
    disposableMats.push(liveOverlayStereoMat);
    const liveOverlayStereoMesh = new THREE.Mesh(baseStereoGeo, liveOverlayStereoMat);
    liveOverlayStereoMesh.position.y = 0.16;
    liveOverlayStereoMesh.renderOrder = 15;
    stereoGroup.add(liveOverlayStereoMesh);

    const liveOverlayGlobeGeo = new THREE.SphereGeometry(4.74, 48, 36);
    const liveOverlayGlobeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      visible: false,
      roughness: 0.78,
      metalness: 0.05,
      depthWrite: false,
    });
    disposableGeos.push(liveOverlayGlobeGeo);
    disposableMats.push(liveOverlayGlobeMat);
    const liveOverlayGlobeMesh = new THREE.Mesh(liveOverlayGlobeGeo, liveOverlayGlobeMat);
    liveOverlayGlobeMesh.renderOrder = 15;
    globeGroup.add(liveOverlayGlobeMesh);

    // Coordinate Graticule Grid Group (88°S, 85°S, 80°S & Meridians)
    const graticuleGroup = new THREE.Group();
    graticuleGroup.position.y = 0.28;
    scene.add(graticuleGroup);

    [-88, -85, -80].forEach((latDeg, idx) => {
      const st = latLonToPolarStereo(latDeg, 0);
      const radius = (st.rM / STEREO_MAX_RADIUS_M) * WORLD_DISK_RADIUS;
      const ringGeo = new THREE.RingGeometry(radius - 0.016, radius + 0.016, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0xd6c36a : 0x38bdf8,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      disposableGeos.push(ringGeo);
      disposableMats.push(ringMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      graticuleGroup.add(ring);
    });

    for (let az = 0; az < 180; az += 45) {
      const rad = (az * Math.PI) / 180;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-Math.cos(rad) * 5.6, 0.02, -Math.sin(rad) * 5.6),
        new THREE.Vector3(Math.cos(rad) * 5.6, 0.02, Math.sin(rad) * 5.6),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: az === 90 ? 0x10b981 : 0x38bdf8,
        transparent: true,
        opacity: 0.4,
      });
      disposableGeos.push(lineGeo);
      disposableMats.push(lineMat);
      graticuleGroup.add(new THREE.Line(lineGeo, lineMat));
    }

    // Interactive Transect Line (A -> B) & Cross-Highlight Marker
    const transectGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, 0.35, -1),
      new THREE.Vector3(1, 0.35, 1),
    ]);
    const transectMat = new THREE.LineBasicMaterial({ color: 0xf4c542, linewidth: 2 });
    disposableGeos.push(transectGeo);
    disposableMats.push(transectMat);
    const transectLineMesh = new THREE.Line(transectGeo, transectMat);
    stereoGroup.add(transectLineMesh);

    const crossGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xf4c542 });
    disposableGeos.push(crossGeo);
    disposableMats.push(crossMat);
    const crosshairMesh = new THREE.Mesh(crossGeo, crossMat);
    crosshairMesh.visible = false;
    stereoGroup.add(crosshairMesh);

    // Candidate Landing Site Low-Profile Surface Reticles on Stereographic Map (Part 3 Cleanup)
    const sitePinsGroup = new THREE.Group();
    sitePinsGroup.position.y = 0.25;
    stereoGroup.add(sitePinsGroup);

    const latLonToWorldStereo = (latDeg: number, lonDeg: number) => {
      const st = latLonToPolarStereo(latDeg, lonDeg);
      const wx = (st.xM / STEREO_MAX_RADIUS_M) * WORLD_DISK_RADIUS;
      const wz = -(st.yM / STEREO_MAX_RADIUS_M) * WORLD_DISK_RADIUS;
      return { wx, wz };
    };

    const sharedReticleRingGeo = new THREE.RingGeometry(0.11, 0.15, 24);
    sharedReticleRingGeo.rotateX(-Math.PI / 2);
    const sharedReticleDotGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const matReticleGold = new THREE.MeshBasicMaterial({
      color: 0xd6c36a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const matReticleCyan = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    disposableGeos.push(sharedReticleRingGeo, sharedReticleDotGeo);
    disposableMats.push(matReticleGold, matReticleCyan);

    propsRef.current.sites
      .filter((s) => s.latitude <= -78)
      .forEach((site) => {
        const { wx, wz } = latLonToWorldStereo(site.latitude, site.longitude);
        const pinGroup = new THREE.Group();
        pinGroup.position.set(wx, 0, wz);

        const isSelected = site.id === propsRef.current.activeSiteId;
        const ring = new THREE.Mesh(
          sharedReticleRingGeo,
          isSelected ? matReticleGold : matReticleCyan
        );
        ring.position.y = 0.02;
        const dot = new THREE.Mesh(
          sharedReticleDotGeo,
          isSelected ? matReticleGold : matReticleCyan
        );
        dot.position.y = 0.04;
        pinGroup.add(ring, dot);
        sitePinsGroup.add(pinGroup);
      });

    runtimeRef.current = {
      layerMeshes: layerMap,
      liveOverlayStereoMat,
      liveOverlayGlobeMat,
      stereoGroup,
      globeGroup,
      graticuleGroup,
      transectLineMesh,
      crosshairMesh,
      renderer,
      lastHighlightedId: propsRef.current.highlightedLayerId,
      lastSafeSlope: propsRef.current.landerSlopeThresholds.slopeSafeMaxDeg,
    };

    // Raycast on pointer move / click for live LOLA DEM inspection & Transect A->B placement
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const baseTargetMesh = stereoGroup.children[1] as THREE.Mesh | undefined;

    const handlePointerDown = (ev: MouseEvent) => {
      if (!baseTargetMesh || propsRef.current.projection !== 'stereographic') return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(baseTargetMesh, false);
      if (hits.length > 0) {
        const pt = hits[0]!.point;
        const xM = (pt.x / WORLD_DISK_RADIUS) * STEREO_MAX_RADIUS_M;
        const yM = (-pt.z / WORLD_DISK_RADIUS) * STEREO_MAX_RADIUS_M;
        const { latDeg, lonDeg } = polarStereoToLatLon(xM, yM);
        const sample = sampleLunarTerrain(latDeg, lonDeg);
        setCursorSample(sample);

        // Select nearest feature in dossier
        const matchFeat = SOUTH_POLE_FEATURES.find(
          (f) => f.name === sample.nearestFeatureName
        );
        if (matchFeat) {
          setSelectedFeatureId(matchFeat.id);
        }

        const mode = propsRef.current.gisToolMode;
        if (mode === 'transect-a') {
          setActiveTransectLine({
            ...propsRef.current.activeTransectLine,
            latA: sample.latDeg,
            lonA: sample.lonDeg,
          });
          setGisToolMode('transect-b');
        } else if (mode === 'transect-b') {
          setActiveTransectLine({
            ...propsRef.current.activeTransectLine,
            latB: sample.latDeg,
            lonB: sample.lonDeg,
          });
          setGisToolMode('inspect');
        } else {
          setHoveredSpatialPoint({
            latDeg: sample.latDeg,
            lonDeg: sample.lonDeg,
            elevationM: sample.elevationM ?? undefined,
            slopeDeg: sample.slopeDeg ?? undefined,
            ldecCount: sample.measurementSupportLdec ?? undefined,
            verticalUncertaintyM: sample.verticalUncertaintyM ?? undefined,
            confidenceTier: sample.confidenceTier,
            label: sample.nearestFeatureName,
          });
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let isDisposed = false;
    let lastTime = performance.now();
    let frameId = 0;
    let timerId = 0;

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const {
        layers: curLayers,
        highlightedLayerId: curHighlight,
        projection: curProj,
        showGraticule: curGrat,
        solarAzimuthDeg: curSunAz,
        activeTransectLine: curTransect,
        hoveredSpatialPoint: curHover,
        landerSlopeThresholds: curThresh,
      } = propsRef.current;

      stereoGroup.visible = curProj === 'stereographic';
      globeGroup.visible = curProj === 'globe3d';
      graticuleGroup.visible = curGrat && curProj === 'stereographic';

      // Update Transect A -> B visual line on stereographic plane
      if (transectLineMesh) {
        const pA = latLonToWorldStereo(curTransect.latA, curTransect.lonA);
        const pB = latLonToWorldStereo(curTransect.latB, curTransect.lonB);
        transectLineMesh.geometry.setFromPoints([
          new THREE.Vector3(pA.wx, 0.38, pA.wz),
          new THREE.Vector3(pB.wx, 0.38, pB.wz),
        ]);
      }

      // Update cross-highlight sphere from Recharts hover
      if (crosshairMesh && curHover) {
        const pH = latLonToWorldStereo(curHover.latDeg, curHover.lonDeg);
        crosshairMesh.position.set(pH.wx, 0.4, pH.wz);
        crosshairMesh.visible = true;
      } else if (crosshairMesh) {
        crosshairMesh.visible = false;
      }

      const sunRad = (curSunAz * Math.PI) / 180.0;
      grazingSunLight.position.set(
        Math.sin(sunRad) * 18,
        3.2,
        -Math.cos(sunRad) * 18
      );

      if (
        runtimeRef.current.lastHighlightedId !== curHighlight ||
        runtimeRef.current.lastSafeSlope !== curThresh.slopeSafeMaxDeg
      ) {
        runtimeRef.current.lastHighlightedId = curHighlight;
        runtimeRef.current.lastSafeSlope = curThresh.slopeSafeMaxDeg;
        curLayers.forEach((layer) => {
          const entry = layerMap.get(layer.id);
          if (entry) {
            const newTex = generateGisLayerTexture(
              layer.id,
              curHighlight === layer.id,
              renderer,
              curThresh.slopeSafeMaxDeg,
              curThresh.slopeCautionMaxDeg
            );
            entry.stereoMat.map?.dispose();
            entry.stereoMat.map = newTex;
            entry.globeMat.map = newTex;
            entry.stereoMat.needsUpdate = true;
            entry.globeMat.needsUpdate = true;
          }
        });
      }

      const lerpFactor = Math.min(1, delta * 12.0);
      curLayers.forEach((layer) => {
        const entry = layerMap.get(layer.id);
        if (!entry) return;
        const targetAlpha = layer.visible ? layer.opacity / 100.0 : 0.0;
        const nextAlpha =
          entry.stereoMat.opacity + (targetAlpha - entry.stereoMat.opacity) * lerpFactor;
        entry.stereoMat.opacity = nextAlpha;
        entry.globeMat.opacity = nextAlpha;
        entry.stereoMat.visible = nextAlpha > 0.005;
        entry.globeMat.visible = nextAlpha > 0.005;
      });

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleAfterDraw(renderer, tick, (id) => {
          timerId = id;
        });
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      layerMap.forEach((entry) => {
        entry.stereoMat.map?.dispose();
      });
      liveOverlayStereoMat.map?.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      runtimeRef.current.layerMeshes.clear();
      runtimeRef.current.liveOverlayStereoMat = undefined;
      runtimeRef.current.liveOverlayGlobeMat = undefined;
      runtimeRef.current.renderer = undefined;
      container.innerHTML = '';
    };
  }, [setActiveTransectLine, setHoveredSpatialPoint, setSelectedFeatureId]);

  // Dynamically load live NASA Moon Trek WMTS or LROC Lunaserv WMS texture onto 3D polar terrain mesh
  useEffect(() => {
    const { liveOverlayStereoMat, liveOverlayGlobeMat, renderer } = runtimeRef.current;
    if (!liveOverlayStereoMat || !liveOverlayGlobeMat || !renderer) return;

    const liveUrl = activeLiveLrocWmsLayer.enabled
      ? `/api/imagery/lroc?action=map&layers=${encodeURIComponent(activeLiveLrocWmsLayer.layerName)}&srs=${encodeURIComponent(activeLiveLrocWmsLayer.srs)}&width=512&height=512`
      : activeLiveWmtsLayer.enabled
        ? `/api/lunar/wmts?action=tile&layer=${encodeURIComponent(activeLiveWmtsLayer.layerId)}&proj=${activeLiveWmtsLayer.projection}&z=0&row=0&col=0`
        : null;

    const liveAlpha = activeLiveLrocWmsLayer.enabled
      ? activeLiveLrocWmsLayer.opacity / 100
      : activeLiveWmtsLayer.enabled
        ? 0.9
        : 0;

    if (!liveUrl || liveAlpha <= 0.01) {
      liveOverlayStereoMat.opacity = 0;
      liveOverlayGlobeMat.opacity = 0;
      liveOverlayStereoMat.visible = false;
      liveOverlayGlobeMat.visible = false;
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      liveUrl,
      (loadedTex) => {
        if (cancelled || runtimeRef.current.liveOverlayStereoMat !== liveOverlayStereoMat) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (liveOverlayStereoMat.map) liveOverlayStereoMat.map.dispose();
        liveOverlayStereoMat.map = loadedTex;
        liveOverlayGlobeMat.map = loadedTex;
        liveOverlayStereoMat.opacity = liveAlpha;
        liveOverlayGlobeMat.opacity = liveAlpha;
        liveOverlayStereoMat.visible = true;
        liveOverlayGlobeMat.visible = true;
        liveOverlayStereoMat.needsUpdate = true;
        liveOverlayGlobeMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep silent if remote tile returns 404 outside polar coverage
      }
    );
    return () => {
      cancelled = true;
    };
  }, [
    activeLiveWmtsLayer.enabled,
    activeLiveWmtsLayer.layerId,
    activeLiveWmtsLayer.projection,
    activeLiveLrocWmsLayer.enabled,
    activeLiveLrocWmsLayer.layerName,
    activeLiveLrocWmsLayer.srs,
    activeLiveLrocWmsLayer.opacity,
  ]);

  const highlightedLayer = layers.find((l) => l.id === highlightedLayerId);

  const getShortFeatureLabel = (name: string) =>
    name.replace(/\s+(Crater|Massif|Rim|Bench|Ridge)$/i, '');

  return (
    <div
      className="flex flex-col w-full bg-[var(--selene-surface)] border border-[var(--selene-border)] overflow-hidden select-none"
      data-testid="moon-trek-viewport"
    >
      {/* Top Docked GIS Telemetry & Interactive Measurement Bar */}
      <div className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3.5 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[11px] font-mono text-[var(--selene-accent-gold)] font-bold">
            NASA MOON TREK GIS · SOUTH POLAR STEREOGRAPHIC (80°S–90°S · MOON_ME DE421)
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono text-[var(--selene-text-secondary)] tabular-nums">
            <span>SOLAR AZ: {solarAzimuthDeg.toFixed(0)}° · PIXEL_IS_AREA</span>
            {highlightedLayer && (
              <span className="text-[var(--selene-accent-earth)] font-semibold">
                ACTIVE: {highlightedLayer.name.toUpperCase()} ({highlightedLayer.pgdaProductCode})
              </span>
            )}
            {activeLiveWmtsLayer.enabled && (
              <span className="text-[var(--selene-accent-green)] font-semibold">
                LIVE WMTS: {activeLiveWmtsLayer.layerId}
              </span>
            )}
            {activeLiveLrocWmsLayer.enabled && (
              <span className="text-[var(--selene-accent-earth)] font-semibold">
                LIVE WMS: {activeLiveLrocWmsLayer.layerName}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono shrink-0">
          <button
            type="button"
            onClick={() => setGisToolMode('inspect')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border transition-colors ${
              gisToolMode === 'inspect'
                ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            <Crosshair className="w-3 h-3" /> Inspect DEM
          </button>
          <button
            type="button"
            onClick={() => setGisToolMode('transect-a')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border transition-colors ${
              gisToolMode !== 'inspect'
                ? 'bg-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            <Ruler className="w-3 h-3" />{' '}
            {gisToolMode === 'transect-a'
              ? 'Click Map: Point A'
              : gisToolMode === 'transect-b'
                ? 'Click Map: Point B'
                : 'Transect A→B'}
          </button>
          <button
            type="button"
            aria-expanded={showDossier}
            onClick={() => setShowDossier(!showDossier)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] text-[var(--selene-text)] border border-[var(--selene-border)] hover:border-[var(--selene-accent-earth)]"
          >
            <Info className="w-3 h-3 text-[var(--selene-accent-gold)]" />{' '}
            {showDossier ? 'Hide Dossier' : 'Feature Dossier'}
          </button>
        </div>
      </div>

      {/* Geodetic Control & LEND Footprint Warnings (Docked above canvas, never occluding terrain) */}
      {activeGeodeticWarnings.length > 0 && (
        <div className="bg-[var(--selene-surface-alt)] border-b border-[var(--selene-border)] px-3.5 py-2 space-y-1">
          {activeGeodeticWarnings.map((layer) => (
            <div
              key={layer.id}
              className="flex items-start gap-2 text-[11px] font-mono text-[var(--selene-accent-amber)]"
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>{layer.shortCode}:</strong> {layer.geodeticControlWarning}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Unobstructed WebGL Terrain Canvas Stage */}
      <div className="relative w-full h-[460px] sm:h-[520px] selene-3d-canvas-stage overflow-hidden">
        <div ref={canvasMountRef} className="w-full h-full cursor-crosshair" />

        {/* Compact Bottom-Left Cursor Sample Pill on Canvas */}
        <div className="absolute bottom-2.5 left-2.5 pointer-events-none bg-[#101214]/90 border border-[#E9E6DE]/20 px-2.5 py-1 text-[11px] font-mono text-[#E9E6DE] tabular-nums">
          SAMPLE {Math.abs(cursorSample.latDeg).toFixed(3)}°S, {cursorSample.lonDeg.toFixed(2)}°E ·{' '}
          <strong className="text-[#D6C36A]">{cursorSample.elevationM} m</strong> (&plusmn;{cursorSample.verticalUncertaintyM}m) ·{' '}
          LDEC {cursorSample.measurementSupportLdec?.toFixed(2)}
        </div>
      </div>

      {/* Docked Candidate Site Quick-Selector Bar */}
      <div className="bg-[var(--selene-surface-alt)] border-t border-[var(--selene-border)] px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] font-mono text-[var(--selene-text-muted)] whitespace-nowrap shrink-0 flex items-center gap-1 mr-1">
          <MapPin className="w-3 h-3 text-[var(--selene-accent-gold)]" /> SITES:
        </span>
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => onSelectSite(site.id)}
            className={`px-2 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
              site.id === activeSiteId
                ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
            }`}
          >
            {site.name} ({site.latitude < 0 ? `${Math.abs(site.latitude).toFixed(1)}°S` : `${site.latitude.toFixed(1)}°N`})
          </button>
        ))}
      </div>

      {/* Docked IAU / PGDA Feature Dossier Panel (Below Map, Theme-Synchronized) */}
      {showDossier && (
        <div className="bg-[var(--selene-surface)] border-t border-[var(--selene-border)] p-4 space-y-3 text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--selene-border)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[var(--selene-accent-gold)] font-bold">
                IAU / PGDA FEATURE DOSSIER
              </span>
              <span className="text-[var(--selene-text-muted)]">·</span>
              <h4 className="text-sm font-bold text-[var(--selene-text)]">{selectedFeature.name}</h4>
              <span className="px-2 py-0.5 text-[11px] bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)]">
                {selectedFeature.featureType}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {SOUTH_POLE_FEATURES.slice(0, 6).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedFeatureId(f.id);
                    setCursorSample(sampleLunarTerrain(f.latDeg, f.lonDeg));
                  }}
                  className={`px-2 py-0.5 text-[11px] border transition-colors ${
                    f.id === selectedFeature.id
                      ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                      : 'bg-[var(--selene-surface-alt)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                  }`}
                >
                  {getShortFeatureLabel(f.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] tabular-nums">
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">IAU COORDS</span>
              <strong className="text-[var(--selene-text)]">
                {Math.abs(selectedFeature.latDeg).toFixed(2)}°S, {selectedFeature.lonDeg.toFixed(1)}°E
              </strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">DIA / DEPTH</span>
              <strong className="text-[var(--selene-accent-gold)]">
                {selectedFeature.diameterKm} km / {selectedFeature.depthKm} km
              </strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">RIM SLOPE (MEAN/S95)</span>
              <strong className="text-[var(--selene-accent-green)]">
                {selectedFeature.meanRimSlopeDeg}° / S95={selectedFeature.p95RimSlopeDeg}°
              </strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">DIVINER T_BOL</span>
              <strong className="text-[var(--selene-text)]">
                {selectedFeature.divinerMinTempK}–{selectedFeature.divinerMaxTempK} K
              </strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">LEND WEH (~10km)</span>
              <strong className="text-[var(--selene-accent-earth)]">{selectedFeature.lendWehWtPct} wt% H2O-eq</strong>
            </div>
            <div className="bg-[var(--selene-surface-alt)] p-2.5 border border-[var(--selene-border)]">
              <span className="text-[10px] text-[var(--selene-text-muted)] block">PEAK SUN / DTE</span>
              <strong className="text-[var(--selene-accent-amber)]">
                {selectedFeature.avgPeakIlluminationPct}% / {selectedFeature.avgDteVisibilityPct}%
              </strong>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[var(--selene-text-secondary)] leading-relaxed font-sans max-w-4xl">
              {selectedFeature.geologicSummary}
            </p>
            <div className="text-[11px] font-mono text-[var(--selene-accent-green)] shrink-0">
              {cursorSample.confidenceLabel} · EffRes {cursorSample.effectiveResolutionM}m
            </div>
          </div>

          {selectedFeature.lcrossConfirmedIce && (
            <div className="p-2.5 bg-[#007A91]/10 border border-[var(--selene-accent-earth)]/40 text-xs text-[var(--selene-accent-earth)]">
              <strong>DIRECT LCROSS CONFIRMATION:</strong> {selectedFeature.lcrossConfirmedIce}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
