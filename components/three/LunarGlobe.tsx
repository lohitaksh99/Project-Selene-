'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createLunarShaderTexture,
  detectSoftwareGl,
  enhanceNaturalMoonWithLiveWacTiles,
  scheduleAfterDraw,
} from '@/lib/three/webglUtils';
import { LunarShaderMode, useSeleneStore } from '@/lib/store/useSeleneStore';
import {
  TerrainSample,
  sampleLunarTerrain,
} from '@/lib/terrain/lolaTerrainEngine';
import type { LandingSiteRecord } from '@/server/db/database';
import { Compass, Eye, Layers, MapPin, RotateCcw } from 'lucide-react';

export type LunarCameraPreset =
  | 'south-pole'
  | 'shackleton-rim'
  | 'connecting-ridge'
  | 'malapert-massif'
  | 'haworth-crater'
  | 'oblique'
  | 'equatorial';

interface LunarGlobeProps {
  sites: LandingSiteRecord[];
  activeSiteId: string;
  onSelectSite: (siteId: string) => void;
  shaderMode: LunarShaderMode;
  onChangeShaderMode: (mode: LunarShaderMode) => void;
  subSolarLatDeg?: number;
  subSolarLonDeg?: number;
  subEarthLatDeg?: number;
  subEarthLonDeg?: number;
  compact?: boolean;
}

export default function LunarGlobe({
  sites,
  activeSiteId,
  onSelectSite,
  shaderMode,
  onChangeShaderMode,
  subSolarLatDeg = -1.35,
  subSolarLonDeg = 45.0,
  subEarthLatDeg = -5.2,
  subEarthLonDeg = 2.4,
  compact = false,
}: LunarGlobeProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<LunarCameraPreset>('south-pole');
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [inspectedTerrain, setInspectedTerrain] = useState<TerrainSample | null>(() =>
    sampleLunarTerrain(-89.78, 120.45)
  );

  const {
    hoveredSpatialPoint,
    setHoveredSpatialPoint,
    activeLiveWmtsLayer,
    activeLiveLrocWmsLayer,
    liveHorizonsOverride,
    showAllGlobeMarkers,
    setShowAllGlobeMarkers,
  } = useSeleneStore();

  const propsRef = useRef({
    sites,
    activeSiteId,
    onSelectSite,
    shaderMode,
    subSolarLatDeg,
    subSolarLonDeg,
    subEarthLatDeg,
    subEarthLonDeg,
    cameraPreset,
    hoveredSpatialPoint,
    showAllGlobeMarkers,
  });

  useEffect(() => {
    propsRef.current = {
      sites,
      activeSiteId,
      onSelectSite,
      shaderMode,
      subSolarLatDeg,
      subSolarLonDeg,
      subEarthLatDeg,
      subEarthLonDeg,
      cameraPreset,
      hoveredSpatialPoint,
      showAllGlobeMarkers,
    };
  });

  const sceneHandlesRef = useRef<{
    moonMat?: THREE.MeshStandardMaterial;
    renderer?: THREE.WebGLRenderer;
    sunKeyLight?: THREE.DirectionalLight;
    crosshairBeacon?: THREE.Mesh;
    targetCamPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    transitionActive: boolean;
    rebuildPins?: () => void;
  }>({
    targetCamPos: new THREE.Vector3(0, 9.2, 6.8),
    targetLookAt: new THREE.Vector3(0, 0.75, 0),
    transitionActive: false,
  });

  useEffect(() => {
    const { moonMat, renderer } = sceneHandlesRef.current;
    if (!moonMat || !renderer) return;

    const liveUrl = activeLiveLrocWmsLayer.enabled
      ? `/api/imagery/lroc?action=map&layers=${encodeURIComponent(activeLiveLrocWmsLayer.layerName)}&srs=${encodeURIComponent(activeLiveLrocWmsLayer.srs)}&width=512&height=512`
      : activeLiveWmtsLayer.enabled
        ? `/api/lunar/wmts?action=tile&layer=${encodeURIComponent(activeLiveWmtsLayer.layerId)}&projection=${activeLiveWmtsLayer.projection}&z=0&row=0&col=0`
        : null;

    if (liveUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        liveUrl,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          if (moonMat.map) moonMat.map.dispose();
          moonMat.map = loadedTex;
          moonMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Keep current shader texture if remote tile is out-of-bounds
        }
      );
      return;
    }

    const { colorMap, bumpMap } = createLunarShaderTexture(shaderMode, renderer);
    if (moonMat.map) moonMat.map.dispose();
    if (moonMat.bumpMap) moonMat.bumpMap.dispose();
    moonMat.map = colorMap;
    moonMat.bumpMap = bumpMap;
    moonMat.needsUpdate = true;

    if (shaderMode === 'albedo') {
      enhanceNaturalMoonWithLiveWacTiles((liveWacTex) => {
        if (propsRef.current.shaderMode === 'albedo' && sceneHandlesRef.current.moonMat) {
          sceneHandlesRef.current.moonMat.map?.dispose();
          sceneHandlesRef.current.moonMat.map = liveWacTex;
          sceneHandlesRef.current.moonMat.needsUpdate = true;
        }
      }, renderer);
    }
  }, [
    shaderMode,
    activeLiveWmtsLayer.enabled,
    activeLiveWmtsLayer.layerId,
    activeLiveWmtsLayer.projection,
    activeLiveLrocWmsLayer.enabled,
    activeLiveLrocWmsLayer.layerName,
    activeLiveLrocWmsLayer.srs,
  ]);

  useEffect(() => {
    sceneHandlesRef.current.rebuildPins?.();
  }, [sites, activeSiteId, showAllGlobeMarkers]);

  // 7 Scientific & Cinematic Camera Presets
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    switch (cameraPreset) {
      case 'south-pole':
        handles.targetCamPos.set(0, 9.2, 6.8);
        handles.targetLookAt.set(0, 0.75, 0);
        break;
      case 'shackleton-rim':
        handles.targetCamPos.set(-1.2, 6.8, 1.9);
        handles.targetLookAt.set(-0.08, 4.45, -0.12);
        break;
      case 'connecting-ridge':
        handles.targetCamPos.set(-1.6, 6.9, 1.6);
        handles.targetLookAt.set(-0.15, 4.46, 0.15);
        break;
      case 'malapert-massif':
        handles.targetCamPos.set(1.8, 7.2, 2.2);
        handles.targetLookAt.set(0.38, 4.42, -0.09);
        break;
      case 'haworth-crater':
        handles.targetCamPos.set(2.1, 7.0, -1.8);
        handles.targetLookAt.set(0.2, 4.42, 0.05);
        break;
      case 'oblique':
        handles.targetCamPos.set(6.8, 7.8, 7.2);
        handles.targetLookAt.set(0, 0.6, 0);
        break;
      case 'equatorial':
        handles.targetCamPos.set(0, 2.2, 13.0);
        handles.targetLookAt.set(0, 0, 0);
        break;
    }
    handles.transitionActive = true;
  }, [cameraPreset]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    // Deep Lunar Vacuum backdrop (#101214) — Zero Rayleigh atmosphere
    scene.background = new THREE.Color(0x101214);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 300);
    camera.position.set(0, 9.2, 6.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5.4;
    controls.maxDistance = 28;
    controls.target.set(0, 0.75, 0);
    controls.update();

    controls.addEventListener('start', () => {
      sceneHandlesRef.current.transitionActive = false;
    });

    // Zero-Atmosphere Vacuum Solar Lighting Rig driven by live MOON_ME sub-solar coordinates
    const sunKeyLight = new THREE.DirectionalLight(0xfff8ed, 3.0);
    sunKeyLight.position.set(18, 14, 16);
    scene.add(sunKeyLight);

    // Subtle Earthshine / secondary crater wall reflection fill so shadowed hemispheres remain inspectable
    const earthshineFill = new THREE.AmbientLight(0xd6c36a, 0.22);
    scene.add(earthshineFill);

    // Starfield InstancedMesh (1 draw call for all 180 stars)
    const starCount = 180;
    const starGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe9e6de });
    const starInst = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const dummyMat = new THREE.Matrix4();
    for (let i = 0; i < starCount; i++) {
      const theta = ((i * 73.1) % 360) * (Math.PI / 180);
      const phi = Math.acos(2 * ((i * 0.6180339) % 1) - 1);
      const r = 68 + (i % 25);
      dummyMat.makeTranslation(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      starInst.setMatrixAt(i, dummyMat);
    }
    starInst.computeBoundingSphere();
    scene.add(starInst);

    // Lunar Globe Group (South-Up Polar Presentation so -90°S sits at the top crown +Y)
    const LUNAR_R = 4.5;
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const { colorMap, bumpMap } = createLunarShaderTexture(
      propsRef.current.shaderMode,
      renderer
    );

    // High-resolution sphere with physical LOLA DEM vertex displacement on the South Polar Crown
    const segW = isSoftwareGl ? 64 : 112;
    const segH = isSoftwareGl ? 48 : 84;
    const moonGeo = new THREE.SphereGeometry(LUNAR_R, segW, segH);
    const posAttr = moonGeo.attributes.position!;
    const vTemp = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vTemp.fromBufferAttribute(posAttr, i);
      const rOrig = vTemp.length();
      if (rOrig > 0.001) {
        const ny = Math.max(-1, Math.min(1, vTemp.y / rOrig));
        // In South-Up presentation: +Y corresponds to -90°S
        const latDeg = -(Math.asin(ny) * 180.0) / Math.PI;
        const lonDeg = (Math.atan2(-vTemp.z, vTemp.x) * 180.0) / Math.PI;

        if (latDeg <= -75.0) {
          const sample = sampleLunarTerrain(latDeg, lonDeg);
          const elevKm = (sample.elevationM ?? 0) / 1000.0;
          const displacedR = LUNAR_R + elevKm * 0.032;
          vTemp.normalize().multiplyScalar(displacedR);
          posAttr.setXYZ(i, vTemp.x, vTemp.y, vTemp.z);
        }
      }
    }
    moonGeo.computeVertexNormals();

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: colorMap,
      bumpMap,
      bumpScale: 0.11,
      roughness: 0.88,
      metalness: 0.03,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    if (propsRef.current.shaderMode === 'albedo') {
      enhanceNaturalMoonWithLiveWacTiles((liveWacTex) => {
        if (propsRef.current.shaderMode === 'albedo') {
          moonMat.map?.dispose();
          moonMat.map = liveWacTex;
          moonMat.needsUpdate = true;
        }
      }, renderer);
    }

    const disposableGeos: THREE.BufferGeometry[] = [starGeo, moonGeo];
    const disposableMats: THREE.Material[] = [starMat, moonMat];

    // PRESERVED & REFINED HIGHLIGHTED LUNAR REGION (Part 2 Requirement):
    // Keeps the South Polar Study Region boundary (-80°S outer ring & -85°S inner Artemis polar ring)
    // visible by default with clean scientific outlines and a subtle translucent polar cap glow.
    const polarCapHaloGeo = new THREE.RingGeometry(0.01, LUNAR_R * Math.sin((10 * Math.PI) / 180) * 1.01, 64);
    const polarCapHaloMat = new THREE.MeshBasicMaterial({
      color: 0xd6c36a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    disposableGeos.push(polarCapHaloGeo);
    disposableMats.push(polarCapHaloMat);
    const polarCapHaloMesh = new THREE.Mesh(polarCapHaloGeo, polarCapHaloMat);
    polarCapHaloMesh.rotation.x = Math.PI / 2;
    polarCapHaloMesh.position.y = LUNAR_R * Math.cos((10 * Math.PI) / 180) * 1.011;
    moonGroup.add(polarCapHaloMesh);

    [-80, -85].forEach((latDeg) => {
      const polarAngleRad = ((90 - Math.abs(latDeg)) * Math.PI) / 180;
      const ringRadius = LUNAR_R * Math.sin(polarAngleRad) * 1.012;
      const ringY = LUNAR_R * Math.cos(polarAngleRad) * 1.012;
      const ringGeo = new THREE.RingGeometry(ringRadius - 0.014, ringRadius + 0.014, 72);
      const ringMat = new THREE.MeshBasicMaterial({
        color: latDeg === -85 ? 0xd6c36a : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: latDeg === -85 ? 0.72 : 0.48,
        depthWrite: false,
      });
      disposableGeos.push(ringGeo);
      disposableMats.push(ringMat);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = ringY;
      moonGroup.add(ringMesh);
    });

    // Cross-Highlight Beacon (syncs with Recharts hover & GIS cursor)
    const crossGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xf4c542 });
    disposableGeos.push(crossGeo);
    disposableMats.push(crossMat);
    const crosshairBeacon = new THREE.Mesh(crossGeo, crossMat);
    crosshairBeacon.visible = false;
    moonGroup.add(crosshairBeacon);

    /**
     * PART 3 — SCIENTIFIC SURFACE MARKERS & SELECTED REGION HIGHLIGHT:
     * Previously, every landing site in `sites` spawned a 0.52-unit tall 3-part vertical antenna mast,
     * which clustered at the South Pole like a forest of antennas.
     * We replace those tall vertical poles with shared, low-profile flush surface reticles:
     *   - Selected Site: Prominent concentric Gold (#D6C36A) target highlight ring + soft regional illumination halo + compact 0.12-unit precision surface marker.
     *   - Other Registered Sites: Low-profile flush Cyan (#38BDF8) / Emerald (#10B981) surface rings (toggleable via `showAllGlobeMarkers`).
     */
    const pinsGroup = new THREE.Group();
    moonGroup.add(pinsGroup);
    const interactablePins: THREE.Object3D[] = [];

    // Shared geometries & materials for zero-waste instancing/reuse (Part 8 Optimization)
    const sharedSelectedOuterRingGeo = new THREE.RingGeometry(0.22, 0.26, 48);
    sharedSelectedOuterRingGeo.rotateX(-Math.PI / 2);
    const sharedSelectedHaloGeo = new THREE.CircleGeometry(0.22, 48);
    sharedSelectedHaloGeo.rotateX(-Math.PI / 2);
    const sharedSelectedInnerRingGeo = new THREE.RingGeometry(0.09, 0.12, 32);
    sharedSelectedInnerRingGeo.rotateX(-Math.PI / 2);
    const sharedSelectedBeaconGeo = new THREE.CylinderGeometry(0.016, 0.04, 0.11, 16);
    const sharedSelectedTipGeo = new THREE.OctahedronGeometry(0.045, 1);

    const sharedCandidateRingGeo = new THREE.RingGeometry(0.055, 0.08, 24);
    sharedCandidateRingGeo.rotateX(-Math.PI / 2);
    const sharedCandidateCoreGeo = new THREE.SphereGeometry(0.032, 12, 12);

    const matSelectedGold = new THREE.MeshBasicMaterial({
      color: 0xd6c36a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const matSelectedHalo = new THREE.MeshBasicMaterial({
      color: 0xd6c36a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const matSelectedBeacon = new THREE.MeshStandardMaterial({
      color: 0xd6c36a,
      emissive: 0xd6c36a,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.5,
    });
    const matCandidateCyan = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
    });
    const matConfirmedEmerald = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });

    disposableGeos.push(
      sharedSelectedOuterRingGeo,
      sharedSelectedHaloGeo,
      sharedSelectedInnerRingGeo,
      sharedSelectedBeaconGeo,
      sharedSelectedTipGeo,
      sharedCandidateRingGeo,
      sharedCandidateCoreGeo
    );
    disposableMats.push(
      matSelectedGold,
      matSelectedHalo,
      matSelectedBeacon,
      matCandidateCyan,
      matConfirmedEmerald
    );

    const latLonToSouthUpSphereVec = (latDeg: number, lonDeg: number, elevKm = 0) => {
      const phi = (-latDeg * Math.PI) / 180;
      const lam = (lonDeg * Math.PI) / 180;
      const r = LUNAR_R + (latDeg <= -75 ? elevKm * 0.032 : 0);
      return new THREE.Vector3(
        r * Math.cos(phi) * Math.cos(lam),
        r * Math.sin(phi),
        -r * Math.cos(phi) * Math.sin(lam)
      );
    };

    const rebuildPins = () => {
      while (pinsGroup.children.length > 0) {
        pinsGroup.remove(pinsGroup.children[0]!);
      }
      interactablePins.length = 0;

      const currentSites = propsRef.current.sites;
      const currentActiveId = propsRef.current.activeSiteId;
      const showAll = propsRef.current.showAllGlobeMarkers;

      currentSites.forEach((site) => {
        const isSelected = site.id === currentActiveId;
        if (!isSelected && !showAll) {
          return;
        }

        const pos = latLonToSouthUpSphereVec(site.latitude, site.longitude, site.elevation_km);
        const normal = pos.clone().normalize();

        const beaconGroup = new THREE.Group();
        beaconGroup.position.copy(pos);
        beaconGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        beaconGroup.userData = { siteId: site.id };

        if (isSelected) {
          const halo = new THREE.Mesh(sharedSelectedHaloGeo, matSelectedHalo);
          halo.position.y = 0.018;
          halo.userData = { siteId: site.id };

          const outerRing = new THREE.Mesh(sharedSelectedOuterRingGeo, matSelectedGold);
          outerRing.position.y = 0.02;
          outerRing.userData = { siteId: site.id };

          const innerRing = new THREE.Mesh(sharedSelectedInnerRingGeo, matSelectedGold);
          innerRing.position.y = 0.022;
          innerRing.userData = { siteId: site.id };

          const stem = new THREE.Mesh(sharedSelectedBeaconGeo, matSelectedBeacon);
          stem.position.y = 0.06;
          stem.userData = { siteId: site.id };

          const tip = new THREE.Mesh(sharedSelectedTipGeo, matSelectedBeacon);
          tip.position.y = 0.135;
          tip.userData = { siteId: site.id };

          beaconGroup.add(halo, outerRing, innerRing, stem, tip);
          interactablePins.push(halo, outerRing, innerRing, stem, tip);
        } else {
          const isHistoricalOrConfirmed =
            site.site_status === 'HISTORICAL_LANDING' || site.site_status === 'CONFIRMED_LANDING';
          const mat = isHistoricalOrConfirmed ? matConfirmedEmerald : matCandidateCyan;

          const surfaceRing = new THREE.Mesh(sharedCandidateRingGeo, mat);
          surfaceRing.position.y = 0.018;
          surfaceRing.userData = { siteId: site.id };

          const coreDot = new THREE.Mesh(sharedCandidateCoreGeo, mat);
          coreDot.position.y = 0.024;
          coreDot.userData = { siteId: site.id };

          beaconGroup.add(surfaceRing, coreDot);
          interactablePins.push(surfaceRing, coreDot);
        }

        pinsGroup.add(beaconGroup);
      });
    };

    rebuildPins();
    sceneHandlesRef.current.moonMat = moonMat;
    sceneHandlesRef.current.renderer = renderer;
    sceneHandlesRef.current.sunKeyLight = sunKeyLight;
    sceneHandlesRef.current.crosshairBeacon = crosshairBeacon;
    sceneHandlesRef.current.rebuildPins = rebuildPins;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const pinHits = raycaster.intersectObjects(interactablePins, false);
      if (pinHits.length > 0) {
        let obj: THREE.Object3D | null = pinHits[0]!.object;
        while (obj && !obj.userData?.siteId) {
          obj = obj.parent;
        }
        if (obj?.userData?.siteId) {
          propsRef.current.onSelectSite(String(obj.userData.siteId));
          return;
        }
      }

      // Inspect arbitrary LOLA DEM surface point on click
      const surfaceHits = raycaster.intersectObject(moonMesh, false);
      if (surfaceHits.length > 0) {
        const pt = surfaceHits[0]!.point;
        const r = pt.length();
        const latDeg = -(Math.asin(Math.max(-1, Math.min(1, pt.y / r))) * 180) / Math.PI;
        const lonDeg = (Math.atan2(-pt.z, pt.x) * 180) / Math.PI;
        const sample = sampleLunarTerrain(latDeg, lonDeg);
        setInspectedTerrain(sample);
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
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    let frameId = 0;
    let timerId = 0;
    let lastSunLat = Number.NaN;
    let lastSunLon = Number.NaN;
    let lastHovKey = '';

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Update live directional Sun vector only when subSolar coordinates change
      const sLat = propsRef.current.subSolarLatDeg ?? -1.35;
      const sLon = propsRef.current.subSolarLonDeg ?? 45.0;
      if (sLat !== lastSunLat || sLon !== lastSunLon) {
        lastSunLat = sLat;
        lastSunLon = sLon;
        const sunVec = latLonToSouthUpSphereVec(sLat, sLon, 0).normalize().multiplyScalar(28);
        sunVec.y = Math.max(2.6, sunVec.y + 4.2);
        sunKeyLight.position.copy(sunVec);
      }

      // Update cross-highlight beacon only when hovered spatial point changes
      const hov = propsRef.current.hoveredSpatialPoint;
      const hovKey = hov ? `${hov.latDeg.toFixed(4)},${hov.lonDeg.toFixed(4)},${hov.elevationM ?? 1500}` : '';
      if (hovKey !== lastHovKey) {
        lastHovKey = hovKey;
        if (hov && crosshairBeacon) {
          const hovPos = latLonToSouthUpSphereVec(
            hov.latDeg,
            hov.lonDeg,
            (hov.elevationM ?? 1500) / 1000.0
          );
          crosshairBeacon.position.copy(hovPos);
          crosshairBeacon.visible = true;
        } else if (crosshairBeacon) {
          crosshairBeacon.visible = false;
        }
      }

      if (sceneHandlesRef.current.transitionActive) {
        const k = 1 - Math.exp(-6.0 * Math.max(dt, 0.016));
        camera.position.lerp(sceneHandlesRef.current.targetCamPos, k);
        controls.target.lerp(sceneHandlesRef.current.targetLookAt, k);
        if (camera.position.distanceTo(sceneHandlesRef.current.targetCamPos) < 0.05) {
          sceneHandlesRef.current.transitionActive = false;
        }
      }

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
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      moonMat.map?.dispose();
      moonMat.bumpMap?.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, [setHoveredSpatialPoint]);

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0];

  return (
    <div
      className="flex flex-col w-full bg-[var(--selene-surface)] border border-[var(--selene-border)] overflow-hidden select-none"
      data-testid="lunar-globe-viewport"
    >
      {/* Top Compact Telemetry Readout Strip */}
        <div className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] text-[var(--selene-accent-gold)] font-bold">
              {liveHorizonsOverride
                ? `LIVE JPL HORIZONS (${liveHorizonsOverride.sourceKernel})`
                : 'LOLA DEM 3D ENGINE · IAU MOON_ME (DE421)'}
            </span>
            <span className="text-[var(--selene-text-muted)]">·</span>
            <span className="text-[11px] text-[var(--selene-text-muted)] tabular-nums">
              SUB-SOLAR: {subSolarLatDeg.toFixed(2)}°, {subSolarLonDeg.toFixed(1)}°E
            </span>
          </div>

          {activeSite && (
            <div className="text-[11px] text-[var(--selene-text)] font-semibold tabular-nums">
              TARGET: {activeSite.name.toUpperCase()} (
              {activeSite.latitude < 0
                ? `${Math.abs(activeSite.latitude).toFixed(2)}°S`
                : `${activeSite.latitude.toFixed(2)}°N`}
              , {activeSite.longitude.toFixed(2)}°E ·{' '}
              {activeSite.elevation_km >= 0 ? '+' : ''}
              {activeSite.elevation_km.toFixed(2)} km LDEM)
            </div>
          )}
        </div>

        {/* Unobstructed 3D Moon WebGL Viewport */}
        <div
          className={`relative w-full ${compact ? 'h-[360px] sm:h-[420px]' : 'h-[440px] sm:h-[520px]'} selene-3d-canvas-stage overflow-hidden`}
        >
          <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Compact Top-Right Marker Toggle */}
          <div className="hidden sm:flex absolute top-3 right-3 z-10 items-center gap-2 bg-[#101214]/90 border border-[#E9E6DE]/20 px-2.5 py-1.5 text-[11px] font-mono text-[#E9E6DE]">
            <button
              type="button"
              onClick={() => setShowAllGlobeMarkers(!showAllGlobeMarkers)}
              className={`px-2 py-0.5 border text-[10px] transition-colors ${
                showAllGlobeMarkers
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]'
                  : 'bg-[#101214] text-[#B8B2A5] border-[#E9E6DE]/20'
              }`}
            >
              {showAllGlobeMarkers ? 'All Sites: ON' : 'Selected Only'}
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#C8C4BA]">
              <span className="w-2 h-2 rounded-full bg-[#D6C36A] inline-block" /> Target
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] inline-block ml-1" /> Candidate
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block ml-1" /> Confirmed
            </span>
          </div>

          {inspectedTerrain && (
            <div className="absolute bottom-2.5 left-2.5 pointer-events-none bg-[#101214]/92 border border-[#E9E6DE]/20 px-2.5 py-1 text-[11px] font-mono text-[#E9E6DE] tabular-nums">
              SAMPLE ({inspectedTerrain.latDeg.toFixed(2)}°, {inspectedTerrain.lonDeg.toFixed(1)}°E): Elev {inspectedTerrain.elevationM}m (&plusmn;{inspectedTerrain.verticalUncertaintyM}m) · Slope {inspectedTerrain.slopeDeg}° · LDEC {inspectedTerrain.measurementSupportLdec?.toFixed(2)}
            </div>
          )}

          {(activeLiveWmtsLayer.enabled || activeLiveLrocWmsLayer.enabled) && (
            <div className="absolute top-3 left-3 pointer-events-none bg-[#101214]/90 border border-[#E9E6DE]/20 px-2.5 py-1 text-[10px] font-mono text-[#10B981]">
              {activeLiveWmtsLayer.enabled
                ? `LIVE WMTS: ${activeLiveWmtsLayer.layerId}`
                : `LIVE LROC WMS: ${activeLiveLrocWmsLayer.layerName}`}
            </div>
          )}
        </div>

        {/* Docked Bottom 3D Layer & Camera Controls (Outside Canvas) */}
        <div className="bg-[var(--selene-surface-alt)] border-t border-[var(--selene-border)] px-3.5 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold text-[var(--selene-text-muted)] uppercase">
              3D SURFACE SHADERS, CAMERA PRESETS &amp; TARGET FOCUS
            </span>
            <button
              type="button"
              onClick={() => setHudCollapsed((prev) => !prev)}
              className="px-2.5 py-0.5 text-[11px] font-mono bg-[var(--selene-surface)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] border border-[var(--selene-border)] transition-colors"
            >
              {hudCollapsed ? 'Show 3D Controls' : 'Hide 3D Controls'}
            </button>
          </div>

          {!hudCollapsed && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 pr-2 border-r border-[var(--selene-border)]">
                <Layers className="w-3.5 h-3.5 text-[var(--selene-accent-gold)] mr-1 shrink-0" />
                {(
                  [
                    { id: 'albedo', label: 'Natural Moon' },
                    { id: 'lola', label: 'Elevation' },
                    { id: 'slope', label: 'Slope' },
                    { id: 'illumination', label: 'Illumination' },
                    { id: 'volatiles', label: 'Scientific Composite' },
                    { id: 'uncertainty', label: 'LDEC Support' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeShaderMode(m.id)}
                    className={`px-2 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      shaderMode === m.id
                        ? 'bg-[var(--selene-accent-yellow)] border-[#111111] text-[#111111] font-bold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1 pr-2 border-r border-[var(--selene-border)]">
                <Compass className="w-3.5 h-3.5 text-[var(--selene-accent-earth)] mr-1 shrink-0" />
                {(
                  [
                    { id: 'south-pole', label: 'South Pole (-90°S)' },
                    { id: 'shackleton-rim', label: 'Shackleton Rim' },
                    { id: 'connecting-ridge', label: 'Conn. Ridge' },
                    { id: 'malapert-massif', label: 'Malapert' },
                    { id: 'haworth-crater', label: 'Haworth' },
                    { id: 'oblique', label: 'Oblique SPA' },
                    { id: 'equatorial', label: 'Global Orbit' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className={`px-2 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === cam.id
                        ? 'bg-[#007A91]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-semibold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[var(--selene-accent-green)] mr-1 shrink-0" />
                {sites.slice(0, 3).map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => onSelectSite(site.id)}
                    className={`px-2 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      site.id === activeSiteId
                        ? 'bg-[#22C55E]/15 text-[var(--selene-accent-green)] border-[#22C55E]/50 font-semibold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {site.name.split(' ')[0]}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Reset South Pole Camera"
                  onClick={() => {
                    setCameraPreset('south-pole');
                    sceneHandlesRef.current.transitionActive = true;
                  }}
                  className="p-1.5 text-xs font-mono bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text-muted)] hover:text-[var(--selene-text)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

