'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { detectSoftwareGl, scheduleAfterDraw } from '@/lib/three/webglUtils';
import { computeCalibratedEphemeris } from '@/lib/astrodynamics/offlineCalibratedProvider';
import { computeLunarPhase } from '@/lib/astrodynamics/timeScales';
import { evaluateDecoupledState, EngineeringConstraints } from '@/lib/astrodynamics/coordinateFrames';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  FastForward,
  Pause,
  Play,
  Radio,
  Rewind,
  RotateCcw,
  Target,
} from 'lucide-react';

interface NasaEyesEarthMoonViewerProps {
  site: LandingSiteRecord;
  simulationEpochUtc: string;
  onChangeEpochUtc: (iso: string) => void;
  missionStartDateUtc: string;
  constraints: EngineeringConstraints;
  compact?: boolean;
}

type FocusMode = 'focus-moon' | 'focus-earth' | 'system-overview' | 'south-pole-surface';

const RATE_PRESETS = [
  { label: '-1800x', value: -1800 },
  { label: '-60x', value: -60 },
  { label: '1x Real', value: 1 },
  { label: '+60x', value: 60 },
  { label: '+1800x', value: 1800 },
  { label: '+86400x (1d/s)', value: 86400 },
];

export default function NasaEyesEarthMoonViewer({
  site,
  simulationEpochUtc,
  onChangeEpochUtc,
  missionStartDateUtc,
  constraints,
  compact = false,
}: NasaEyesEarthMoonViewerProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>('focus-moon');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1800);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  // Compute live ephemeris & phase for the current simulation epoch
  const eph = computeCalibratedEphemeris(
    simulationEpochUtc,
    site.latitude,
    site.longitude,
    site.elevation_km
  );
  const lunarPhase = computeLunarPhase(simulationEpochUtc);
  const physicalState = evaluateDecoupledState({
    siteId: site.id,
    siteLatDeg: site.latitude,
    siteLonDeg: site.longitude,
    siteElevationKm: site.elevation_km,
    solar: eph.solarHorizon,
    earth: eph.earthHorizon,
    constraints,
  });

  const simRef = useRef({
    epochMs: new Date(simulationEpochUtc).getTime(),
    isPlaying,
    playbackRate,
    focusMode,
    site,
    constraints,
    onChangeEpochUtc,
  });
  useEffect(() => {
    simRef.current = {
      epochMs: new Date(simulationEpochUtc).getTime(),
      isPlaying,
      playbackRate,
      focusMode,
      site,
      constraints,
      onChangeEpochUtc,
    };
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    camera.position.set(16, -6, 18);

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

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.4;
    controls.maxDistance = 120;

    // Parallel Solar Illumination Beam & Ambient Fill
    const sunBeamLight = new THREE.DirectionalLight(0xfff5e4, 3.2);
    sunBeamLight.position.set(85, 8, 45);
    scene.add(sunBeamLight);

    const spaceHemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.45);
    scene.add(spaceHemiLight);

    // Distant Solar Corona Billboard Group
    const sunCoronaGroup = new THREE.Group();
    sunCoronaGroup.position.copy(sunBeamLight.position);
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff7ed })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xd9541e,
        transparent: true,
        opacity: 0.35,
      })
    );
    sunCoronaGroup.add(sunCore, sunHalo);
    scene.add(sunCoronaGroup);

    // Starfield InstancedMesh
    const starCount = 240;
    const starInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xf3eee3 }),
      starCount
    );
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < starCount; i++) {
      const a = (i * 137.5 * Math.PI) / 180;
      const b = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      const r = 135;
      mat4.makeTranslation(
        r * Math.sin(b) * Math.cos(a),
        r * Math.cos(b),
        r * Math.sin(b) * Math.sin(a)
      );
      starInst.setMatrixAt(i, mat4);
    }
    starInst.computeBoundingSphere();
    scene.add(starInst);

    // 1. EARTH MODEL (23.44° Axial Tilt, Diurnal Rotation, Rayleigh Atmosphere, Cloud Layer)
    const earthSystemGroup = new THREE.Group();
    // 23.44 deg obliquity tilt
    earthSystemGroup.rotation.z = (23.44 * Math.PI) / 180.0;
    scene.add(earthSystemGroup);

    // Procedural Earth Albedo Texture
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 512;
    earthCanvas.height = 256;
    const eCtx = earthCanvas.getContext('2d')!;
    eCtx.fillStyle = '#0c3b75';
    eCtx.fillRect(0, 0, 512, 256);
    // Continents & polar ice caps
    eCtx.fillStyle = '#2d6a4f';
    for (let i = 0; i < 36; i++) {
      const cx = ((i * 67) % 480) + 16;
      const cy = ((i * 43) % 180) + 38;
      const rx = 18 + (i % 5) * 9;
      const ry = 12 + (i % 4) * 7;
      eCtx.beginPath();
      eCtx.ellipse(cx, cy, rx, ry, (i % 3) * 0.4, 0, Math.PI * 2);
      eCtx.fill();
    }
    eCtx.fillStyle = '#e2e8f0';
    eCtx.fillRect(0, 0, 512, 16);
    eCtx.fillRect(0, 240, 512, 16);

    const earthTex = new THREE.CanvasTexture(earthCanvas);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const EARTH_R = 3.2;
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 48, 36),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: earthTex,
        roughness: 0.65,
        metalness: 0.15,
      })
    );
    earthSystemGroup.add(earthMesh);

    // Drifting Cloud Layer
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 512;
    cloudCanvas.height = 256;
    const cCtx = cloudCanvas.getContext('2d')!;
    cCtx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 65; i++) {
      cCtx.beginPath();
      cCtx.ellipse(
        (i * 83) % 512,
        (i * 47) % 256,
        24 + (i % 18),
        5 + (i % 6),
        0.2,
        0,
        Math.PI * 2
      );
      cCtx.fill();
    }
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.018, 36, 28),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cloudTex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    earthSystemGroup.add(cloudMesh);

    // Rayleigh Atmospheric Scattering Shell
    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.055, 36, 28),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    earthSystemGroup.add(atmoMesh);

    // Earth Rotational Axis Spire
    const earthAxisLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -EARTH_R * 1.45, 0),
        new THREE.Vector3(0, EARTH_R * 1.45, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 })
    );
    earthSystemGroup.add(earthAxisLine);

    // 2. INCLINED LUNAR ORBIT TRAJECTORY (5.145° to Ecliptic)
    const ORBIT_R = 24.0;
    const INCLINATION_RAD = (5.145 * Math.PI) / 180.0;
    const orbitPts: THREE.Vector3[] = [];
    for (let deg = 0; deg <= 360; deg += 3) {
      const rad = (deg * Math.PI) / 180.0;
      const r = ORBIT_R * (1 - 0.0549 * Math.cos(rad)); // True elliptical eccentricity e = 0.0549
      orbitPts.push(
        new THREE.Vector3(
          r * Math.cos(rad),
          r * Math.sin(rad) * Math.sin(INCLINATION_RAD),
          r * Math.sin(rad) * Math.cos(INCLINATION_RAD)
        )
      );
    }
    const orbitTrajectoryLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4 })
    );
    scene.add(orbitTrajectoryLine);

    // 3. MOON MODEL & SOUTH POLE LANDER BEACON (1:1 Tidal Locking + Libration)
    const MOON_R = 1.35;
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 512;
    moonCanvas.height = 256;
    const mCtx = moonCanvas.getContext('2d')!;
    mCtx.fillStyle = '#82828a';
    mCtx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 90; i++) {
      mCtx.fillStyle = i % 2 === 0 ? '#5c5c64' : '#a1a1aa';
      mCtx.beginPath();
      mCtx.arc((i * 71) % 512, (i * 41) % 256, 4 + (i % 14), 0, Math.PI * 2);
      mCtx.fill();
    }
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.colorSpace = THREE.SRGBColorSpace;

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R, 40, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: moonTex,
        roughness: 0.85,
        metalness: 0.08,
      })
    );
    moonGroup.add(moonMesh);

    // South Pole Beacon Pin on the Moon
    const southPolePin = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.35, 12),
      new THREE.MeshStandardMaterial({
        color: 0xd9541e,
        emissive: 0xd9541e,
        emissiveIntensity: 0.7,
        roughness: 0.25,
      })
    );
    southPolePin.position.set(0, -MOON_R - 0.15, 0);
    moonGroup.add(southPolePin);

    // 4. TELEMETRY VECTORS: Direct-to-Earth (DTE) Laser Link & Solar Vector
    const dteLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
    ]);
    const dteLineMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 });
    const dteLaserLine = new THREE.Line(dteLineGeo, dteLineMat);
    scene.add(dteLaserLine);

    const solarVecGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
    ]);
    const solarVecMat = new THREE.LineBasicMaterial({ color: 0xd9541e });
    const solarVecLine = new THREE.Line(solarVecGeo, solarVecMat);
    scene.add(solarVecLine);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let isDisposed = false;
    let lastTime = performance.now();
    let frameId = 0;
    let timerId = 0;
    let lastReactSyncMs = 0;

    const desiredCamPos = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const state = simRef.current;

      if (state.isPlaying) {
        state.epochMs += dt * state.playbackRate * 1000;
        const nowPerf = performance.now();
        // Throttle React HUD state updates to <= 8 Hz so WebGL never stalls
        if (nowPerf - lastReactSyncMs > 125) {
          lastReactSyncMs = nowPerf;
          state.onChangeEpochUtc(new Date(state.epochMs).toISOString());
        }
      }

      // Compute orbital phase angle from epochMs
      const daysSinceJ2000 = state.epochMs / 86400000 - 10957.5;
      const orbitAngleRad = ((daysSinceJ2000 / 27.32166) * Math.PI * 2) % (Math.PI * 2);
      const sunAngleRad = ((daysSinceJ2000 / 365.25) * Math.PI * 2) % (Math.PI * 2);

      // Update Solar Illumination Direction
      sunBeamLight.position.set(
        Math.cos(sunAngleRad) * 95,
        Math.sin(sunAngleRad) * 2.5,
        Math.sin(sunAngleRad) * 95
      );
      sunCoronaGroup.position.copy(sunBeamLight.position);

      // Rotate Earth Diurnally (24h period)
      earthMesh.rotation.y = (daysSinceJ2000 * Math.PI * 2) % (Math.PI * 2);
      cloudMesh.rotation.y = (daysSinceJ2000 * Math.PI * 2 * 1.03) % (Math.PI * 2);

      // Position Moon on inclined elliptical orbit
      const rOrbit = ORBIT_R * (1 - 0.0549 * Math.cos(orbitAngleRad));
      const mx = rOrbit * Math.cos(orbitAngleRad);
      const my = rOrbit * Math.sin(orbitAngleRad) * Math.sin(INCLINATION_RAD);
      const mz = rOrbit * Math.sin(orbitAngleRad) * Math.cos(INCLINATION_RAD);
      moonGroup.position.set(mx, my, mz);

      // Synchronous 1:1 tidal locking + physical/optical libration wobble
      moonGroup.rotation.y = -orbitAngleRad + Math.PI;
      moonGroup.rotation.z = (1.5424 * Math.PI) / 180.0;

      // Update DTE Laser Line (Moon South Pole -> Earth) & Solar Vector Line
      const spWorldPos = new THREE.Vector3(mx, my - MOON_R, mz);
      const dteAttr = dteLineGeo.attributes.position!;
      dteAttr.setXYZ(0, spWorldPos.x, spWorldPos.y, spWorldPos.z);
      dteAttr.setXYZ(1, 0, 0, 0);
      dteAttr.needsUpdate = true;

      const curEph = computeCalibratedEphemeris(
        state.epochMs,
        state.site.latitude,
        state.site.longitude,
        state.site.elevation_km
      );
      const curDecoupled = evaluateDecoupledState({
        siteId: state.site.id,
        siteLatDeg: state.site.latitude,
        siteLonDeg: state.site.longitude,
        siteElevationKm: state.site.elevation_km,
        solar: curEph.solarHorizon,
        earth: curEph.earthHorizon,
        constraints: state.constraints,
      });
      dteLineMat.color.setHex(curDecoupled.dteLinkFeasible ? 0x22c55e : 0xef4444);

      const sunDirNorm = sunBeamLight.position.clone().normalize();
      const sAttr = solarVecGeo.attributes.position!;
      sAttr.setXYZ(0, spWorldPos.x, spWorldPos.y, spWorldPos.z);
      sAttr.setXYZ(
        1,
        spWorldPos.x + sunDirNorm.x * 6.5,
        spWorldPos.y + sunDirNorm.y * 6.5,
        spWorldPos.z + sunDirNorm.z * 6.5
      );
      sAttr.needsUpdate = true;

      // Smooth Camera Tracking per Focus Mode (snap on initial frame when dt === 0)
      const dampK = dt <= 0.0001 ? 1.0 : 1 - Math.exp(-5.0 * dt);
      if (state.focusMode === 'focus-moon') {
        desiredTarget.set(mx * 0.65, my * 0.65, mz * 0.65);
        desiredCamPos.set(mx * 1.25 + 2.2, my + 2.0, mz * 1.25 + 2.8);
        camera.position.lerp(desiredCamPos, dampK);
        controls.target.lerp(desiredTarget, dampK);
      } else if (state.focusMode === 'focus-earth') {
        desiredTarget.set(0, 0, 0);
        desiredCamPos.set(10.5, 3.8, 10.5);
        camera.position.lerp(desiredCamPos, dampK);
        controls.target.lerp(desiredTarget, dampK);
      } else if (state.focusMode === 'system-overview') {
        desiredTarget.set(0, 0, 0);
        desiredCamPos.set(0, 36, 30);
        camera.position.lerp(desiredCamPos, dampK);
        controls.target.lerp(desiredTarget, dampK);
      } else if (state.focusMode === 'south-pole-surface') {
        desiredTarget.set(0, 0, 0);
        camera.position.set(mx * 0.94, my - MOON_R - 0.55, mz * 0.94);
        controls.target.lerp(desiredTarget, dampK);
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
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const matOrMats = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(matOrMats)) {
          matOrMats.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            std.map?.dispose();
            std.bumpMap?.dispose();
            m.dispose();
          });
        } else if (matOrMats) {
          const std = matOrMats as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.bumpMap?.dispose();
          matOrMats.dispose();
        }
      });

      earthTex.dispose();
      cloudTex.dispose();
      moonTex.dispose();
      envTarget.dispose();
      scene.environment = null;
      renderer.renderLists.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  // One-click target handler: Jump to 2027-02-04T20:39:00.181Z @ -1800x
  const handleJumpTargetEpoch = () => {
    const targetIso = '2027-02-04T20:39:00.181Z';
    simRef.current.epochMs = new Date(targetIso).getTime();
    setPlaybackRate(-1800);
    setIsPlaying(true);
    onChangeEpochUtc(targetIso);
  };

  // Sync with Mission Landing Date
  const handleSyncMissionLandingDate = () => {
    simRef.current.epochMs = new Date(missionStartDateUtc).getTime();
    onChangeEpochUtc(missionStartDateUtc);
  };

  return (
    <div
      className="flex flex-col w-full bg-[var(--selene-surface)] border border-[var(--selene-border)] overflow-hidden select-none"
      data-testid="nasa-eyes-viewport"
    >
      {/* Top Docked Ephemeris Telemetry Strip */}
      <div className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-[var(--selene-accent-earth)]">
            ENGINE C · NASA EYES EARTH–MOON–SUN ORBIT
          </span>
          <span className="text-[var(--selene-text-muted)]">·</span>
          <span className="text-[11px] text-[var(--selene-text-muted)]">INCLINATION 5.145°</span>
          <span className="text-[var(--selene-text-muted)]">·</span>
          <span className="text-[var(--selene-text)] tabular-nums">
            {simulationEpochUtc.replace('T', ' ').slice(0, 19)}Z ({playbackRate > 0 ? `+${playbackRate}x` : `${playbackRate}x`})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums">
          <span className="text-[var(--selene-text-secondary)]">
            PHASE: <strong className="text-[var(--selene-text)]">{lunarPhase.phaseName}</strong> ({lunarPhase.illuminatedPercent}%)
          </span>
          <span className="text-[var(--selene-text-secondary)]">
            RANGE: <strong className="text-[var(--selene-accent-earth)]">{eph.earthMoonDistanceKm.toLocaleString()} km</strong>
          </span>
          <span
            className={`font-bold ${
              physicalState.dteLinkFeasible ? 'text-[var(--selene-accent-green)]' : 'text-[var(--selene-accent-red)]'
            }`}
          >
            DTE LOS: {physicalState.dteLinkFeasible ? `GO (${physicalState.dteLinkMarginDb} dB)` : 'OCCLUDED'}
          </span>
        </div>
      </div>

      {/* Unobstructed 3D Earth-Moon-Sun WebGL Stage */}
      <div
        className={`relative w-full ${compact ? 'h-[320px] sm:h-[380px]' : 'h-[380px] sm:h-[460px]'} selene-3d-canvas-stage overflow-hidden`}
      >
        <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      </div>

      {/* Bottom Docked Orbital Controls */}
      <div className="bg-[var(--selene-surface-alt)] border-t border-[var(--selene-border)] px-3.5 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold text-[var(--selene-text-muted)] uppercase">
            ORBITAL CAMERA FOCUS &amp; TIME WARP CONTROLS
          </span>
          <button
            type="button"
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="px-2.5 py-0.5 text-[11px] font-mono bg-[var(--selene-surface)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] border border-[var(--selene-border)] transition-colors"
          >
            {hudCollapsed ? 'Show Orbital Controls' : 'Hide Orbital Controls'}
          </button>
        </div>

        {!hudCollapsed && (
          <div className="w-full flex flex-col gap-2 pt-1">
            {/* Row 1: Camera Focus Modes & One-Click Epoch Targets */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--selene-border)]">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-mono text-[var(--selene-text-muted)] mr-1">
                  CAMERA:
                </span>
                {(
                  [
                    { id: 'focus-moon', label: 'Focus Moon' },
                    { id: 'focus-earth', label: 'Focus Earth' },
                    { id: 'system-overview', label: 'System Overview' },
                    { id: 'south-pole-surface', label: 'South Pole Surface' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFocusMode(mode.id)}
                    className={`px-2.5 py-1 text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      focusMode === mode.id
                        ? 'bg-[#007A91]/15 text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-bold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* One-Click Targets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleJumpTargetEpoch}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[var(--selene-accent-solar)] text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Target 2027-02-04T20:39Z (-1800x)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncMissionLandingDate}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[var(--selene-accent-earth)]" />
                  <span>Sync Landing Date</span>
                </button>
              </div>
            </div>

            {/* Row 2: Playback Transport & Rate Scrubber Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono bg-[#22C55E]/15 border border-[#22C55E]/50 text-[var(--selene-accent-green)] font-bold hover:bg-[#22C55E]/25 transition-colors whitespace-nowrap shrink-0"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  aria-label="Step Backward 6 Hours"
                  onClick={() => {
                    const nextMs = simRef.current.epochMs - 6 * 3600 * 1000;
                    simRef.current.epochMs = nextMs;
                    onChangeEpochUtc(new Date(nextMs).toISOString());
                  }}
                  className="px-2 py-1 text-xs font-mono bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] flex items-center gap-1"
                >
                  <Rewind className="w-3.5 h-3.5" />
                  <span>-6h</span>
                </button>
                <button
                  type="button"
                  aria-label="Step Forward 6 Hours"
                  onClick={() => {
                    const nextMs = simRef.current.epochMs + 6 * 3600 * 1000;
                    simRef.current.epochMs = nextMs;
                    onChangeEpochUtc(new Date(nextMs).toISOString());
                  }}
                  className="px-2 py-1 text-xs font-mono bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] flex items-center gap-1"
                >
                  <span>+6h</span>
                  <FastForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Rate Presets */}
              <div className="flex flex-wrap items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-[var(--selene-accent-solar)] mr-1 shrink-0" />
                {RATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setPlaybackRate(preset.value);
                      setIsPlaying(true);
                    }}
                    className={`px-2 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      playbackRate === preset.value
                        ? 'bg-[var(--selene-accent-solar)] border-[var(--selene-accent-solar)] text-white font-semibold'
                        : 'bg-[var(--selene-surface)] border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
