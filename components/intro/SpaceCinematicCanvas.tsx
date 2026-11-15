'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { detectSoftwareGl, scheduleAfterDraw } from '@/lib/three/webglUtils';
import { GalaxyFragmentShader, GalaxyVertexShader } from './shaders';
import { INTRO_CANDIDATE_SITES, type CinematicPhase } from './introMissionData';

interface SpaceCinematicCanvasProps {
  onIntroComplete: () => void;
  onFinalPhase?: () => void;
  onAssetsReady?: () => void;
  onWebGLError: () => void;
}

const TOTAL_DURATION_SEC = 11.1;
const FINAL_PHASE_START_SEC = 8.1;
const ANIMATION_SPEED = 1.5;
const MOON_RADIUS = 6.0;

function easeInOutPower1(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInOutPower2(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutPower1(t: number): number {
  return 1 - Math.pow(1 - t, 1.6);
}

function easeOutPower2(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function computePhaseFromTime(sec: number): CinematicPhase {
  if (sec >= 9.0) return 'hero_active';
  if (sec >= 7.0) return 'site_targeting';
  if (sec >= 5.0) return 'lunar_surface';
  if (sec >= 2.0) return 'lunar_approach';
  if (sec >= 1.0) return 'earth_reveal';
  return 'deep_space';
}

function evaluateCameraTrack(
  sec: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3
): void {
  const t = Math.max(0, Math.min(TOTAL_DURATION_SEC, sec));

  if (t < 1.0) {
    const k = easeInOutPower1(t / 1.0);
    outPos.set(
      THREE.MathUtils.lerp(0, -6, k),
      THREE.MathUtils.lerp(22, 16, k),
      THREE.MathUtils.lerp(75, 55, k)
    );
    outLook.set(-5, 4, 0);
  } else if (t < 2.0) {
    const k = easeInOutPower1((t - 1.0) / 1.0);
    outPos.set(
      THREE.MathUtils.lerp(-6, -18, k),
      THREE.MathUtils.lerp(16, 8, k),
      THREE.MathUtils.lerp(55, 32, k)
    );
    outLook.set(
      THREE.MathUtils.lerp(-5, -12, k),
      THREE.MathUtils.lerp(4, 6, k),
      THREE.MathUtils.lerp(0, -8, k)
    );
  } else if (t < 5.0) {
    const k = easeInOutPower2((t - 2.0) / 3.0);
    outPos.set(
      THREE.MathUtils.lerp(-18, 0, k),
      THREE.MathUtils.lerp(8, 4.2, k),
      THREE.MathUtils.lerp(32, 17.5, k)
    );
    outLook.set(
      THREE.MathUtils.lerp(-12, 0, k),
      THREE.MathUtils.lerp(6, 0, k),
      THREE.MathUtils.lerp(-8, 0, k)
    );
  } else if (t < 7.0) {
    const k = easeOutPower1((t - 5.0) / 2.0);
    outPos.set(
      0,
      THREE.MathUtils.lerp(4.2, 2.2, k),
      THREE.MathUtils.lerp(17.5, 13.0, k)
    );
    outLook.set(0, 0, 0);
  } else if (t < 9.0) {
    const k = easeInOutPower1((t - 7.0) / 2.0);
    outPos.set(
      THREE.MathUtils.lerp(0, 0.2, k),
      THREE.MathUtils.lerp(2.2, 2.0, k),
      THREE.MathUtils.lerp(13.0, 12.5, k)
    );
    outLook.set(0, 0, 0);
  } else {
    const k = easeOutPower2(Math.min(1, (t - 9.0) / 2.1));
    outPos.set(
      THREE.MathUtils.lerp(0.2, 0.0, k),
      THREE.MathUtils.lerp(2.0, 1.15, k),
      THREE.MathUtils.lerp(12.5, 11.2, k)
    );
    outLook.set(0, 0, 0);
  }
}

export const SpaceCinematicCanvas: React.FC<SpaceCinematicCanvasProps> = ({
  onIntroComplete,
  onFinalPhase,
  onAssetsReady,
  onWebGLError,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({
    onIntroComplete,
    onFinalPhase,
    onAssetsReady,
    onWebGLError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onIntroComplete,
      onFinalPhase,
      onAssetsReady,
      onWebGLError,
    };
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Respect prefers-reduced-motion by transitioning gracefully right away
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const reducedTimer = window.setTimeout(() => {
        callbacksRef.current.onIntroComplete();
      }, 150);
      return () => window.clearTimeout(reducedTimer);
    }

    const isSoftwareGl = detectSoftwareGl();
    const disposables: Array<{ dispose: () => void }> = [];

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      callbacksRef.current.onWebGLError();
      return;
    }

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      callbacksRef.current.onWebGLError();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#02040a');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);

    // ================= LIGHTING =================
    const ambientSpace = new THREE.AmbientLight('#0a1020', 0.25);
    scene.add(ambientSpace);

    const sunKeyLight = new THREE.DirectionalLight('#fffbf0', 3.8);
    sunKeyLight.position.set(-38, 7, 24);
    scene.add(sunKeyLight);

    const earthshineLight = new THREE.DirectionalLight('#7dd3fc', 0.32);
    earthshineLight.position.set(28, -8, -16);
    scene.add(earthshineLight);

    // ================= DEEP SPACE STARS =================
    const starCount = isSoftwareGl ? 1200 : 2800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 280 + ((i * 73) % 140);
      const u = ((i * 0.61803398875) % 1) * 2 - 1;
      const theta = i * 2.39996323;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      starPos[i * 3] = r * s * Math.cos(theta);
      starPos[i * 3 + 1] = r * u;
      starPos[i * 3 + 2] = r * s * Math.sin(theta);

      const tint = 0.8 + ((i * 19) % 20) / 100;
      starCol[i * 3] = tint;
      starCol[i * 3 + 1] = tint;
      starCol[i * 3 + 2] = Math.min(1, tint + 0.08);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const starsPoints = new THREE.Points(starGeo, starMat);
    scene.add(starsPoints);
    disposables.push(starGeo, starMat);

    // ================= MILKY WAY SPIRAL GALAXY =================
    const galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(-20, 15, -160);
    galaxyGroup.rotation.set(0.55, 0.2, 0.3);
    galaxyGroup.scale.set(1.4, 1.4, 1.4);
    scene.add(galaxyGroup);

    const galaxyCoreGeo = new THREE.SphereGeometry(4.5, 24, 24);
    const galaxyCoreMat = new THREE.MeshBasicMaterial({
      color: '#ffebc2',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const galaxyCoreMesh = new THREE.Mesh(galaxyCoreGeo, galaxyCoreMat);
    galaxyGroup.add(galaxyCoreMesh);

    const galaxyHaloGeo = new THREE.SphereGeometry(8.5, 24, 24);
    const galaxyHaloMat = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const galaxyHaloMesh = new THREE.Mesh(galaxyHaloGeo, galaxyHaloMat);
    galaxyGroup.add(galaxyHaloMesh);
    disposables.push(galaxyCoreGeo, galaxyCoreMat, galaxyHaloGeo, galaxyHaloMat);

    const galaxyCount = isSoftwareGl ? 6000 : 18000;
    const branches = 4;
    const gRadius = 90;
    const spin = 1.4;
    const randomness = 0.45;
    const gPower = 3.5;

    const gPositions = new Float32Array(galaxyCount * 3);
    const gColors = new Float32Array(galaxyCount * 3);
    const gSizes = new Float32Array(galaxyCount);
    const gTwinkle = new Float32Array(galaxyCount);
    const gBrightness = new Float32Array(galaxyCount);

    const cInside = new THREE.Color('#ffdfa0');
    const cMid = new THREE.Color('#64b5f6');
    const cOutside = new THREE.Color('#38bdf8');
    const cDust = new THREE.Color('#d946ef');
    const tmpColor = new THREE.Color();

    let seed = 421337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < galaxyCount; i++) {
      const r = Math.pow(rand(), gPower) * gRadius;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * (spin / 10);
      const diskThickness = Math.max(0.6, (1.0 - r / gRadius) * 6.0);
      const rx = Math.pow(rand(), 2) * (rand() < 0.5 ? 1 : -1) * randomness * r;
      const ry = Math.pow(rand(), 2) * (rand() < 0.5 ? 1 : -1) * randomness * diskThickness;
      const rz = Math.pow(rand(), 2) * (rand() < 0.5 ? 1 : -1) * randomness * r;
      const angle = branchAngle + spinAngle;

      gPositions[i * 3] = Math.cos(angle) * r + rx;
      gPositions[i * 3 + 1] = ry;
      gPositions[i * 3 + 2] = Math.sin(angle) * r + rz;

      const normRadius = r / gRadius;
      tmpColor.copy(cInside);
      if (normRadius < 0.25) {
        tmpColor.lerp(cMid, normRadius * 4);
      } else if (normRadius < 0.7) {
        tmpColor.copy(cMid).lerp(cOutside, (normRadius - 0.25) / 0.45);
      } else {
        tmpColor.copy(cOutside).lerp(cDust, (normRadius - 0.7) / 0.3);
      }

      gColors[i * 3] = Math.max(0, Math.min(1, tmpColor.r + (rand() - 0.5) * 0.12));
      gColors[i * 3 + 1] = Math.max(0, Math.min(1, tmpColor.g + (rand() - 0.5) * 0.12));
      gColors[i * 3 + 2] = Math.max(0, Math.min(1, tmpColor.b + (rand() - 0.5) * 0.12));

      gSizes[i] = r < 12 ? rand() * 2.8 + 1.2 : rand() * 2.2 + 0.6;
      gTwinkle[i] = 1.0 + rand() * 3.5;
      gBrightness[i] = 0.5 + rand() * 0.5;
    }

    const galaxyGeo = new THREE.BufferGeometry();
    galaxyGeo.setAttribute('position', new THREE.BufferAttribute(gPositions, 3));
    galaxyGeo.setAttribute('aColor', new THREE.BufferAttribute(gColors, 3));
    galaxyGeo.setAttribute('aSize', new THREE.BufferAttribute(gSizes, 1));
    galaxyGeo.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(gTwinkle, 1));
    galaxyGeo.setAttribute('aBrightness', new THREE.BufferAttribute(gBrightness, 1));

    const galaxyShaderMat = new THREE.ShaderMaterial({
      vertexShader: GalaxyVertexShader,
      fragmentShader: GalaxyFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5) },
        uOpacity: { value: 0.55 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const galaxyPoints = new THREE.Points(galaxyGeo, galaxyShaderMat);
    galaxyGroup.add(galaxyPoints);
    disposables.push(galaxyGeo, galaxyShaderMat);

    // ================= TEXTURE LOADING =================
    const loadingManager = new THREE.LoadingManager();
    let readyFired = false;
    let fallbackReadyTimer = 0;
    const fireReady = () => {
      if (!readyFired) {
        readyFired = true;
        window.clearTimeout(fallbackReadyTimer);
        callbacksRef.current.onAssetsReady?.();
      }
    };
    loadingManager.onLoad = fireReady;
    loadingManager.onError = fireReady;
    fallbackReadyTimer = window.setTimeout(fireReady, 1200);

    const texLoader = new THREE.TextureLoader(loadingManager);
    const loadTex = (url: string, isColor = true) => {
      const tex = texLoader.load(url, undefined, undefined, () => {
        // Non-fatal if any individual texture fails
      });
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      disposables.push(tex);
      return tex;
    };

    const earthTex = loadTex('/textures/planets/earth_atmos_2048.jpg', true);
    const earthCloudTex = loadTex('/textures/planets/earthcloudmap.jpg', true);
    const moonTex = loadTex('/textures/planets/moon_1024.jpg', true);
    const moonBumpTex = loadTex('/textures/planets/moonbump1k.jpg', false);

    // ================= CISLUNAR EARTH SYSTEM (NO BLUE HALO RING) =================
    const earthRoot = new THREE.Group();
    earthRoot.position.set(-36, 12, -42);
    scene.add(earthRoot);

    const earthTiltGroup = new THREE.Group();
    earthTiltGroup.rotation.set(0.409, 0, 0);
    earthRoot.add(earthTiltGroup);

    const earthRadius = 2.2 * 1.25;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      color: '#ffffff',
      roughness: 0.6,
      metalness: 0.04,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthTiltGroup.add(earthMesh);

    const cloudGeo = new THREE.SphereGeometry(earthRadius, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      roughness: 0.9,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.scale.set(1.015, 1.015, 1.015);
    earthTiltGroup.add(cloudMesh);
    disposables.push(earthGeo, earthMat, cloudGeo, cloudMat);

    // ================= HIGH-RELIEF MOON & SURVEY OVERLAYS =================
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const segs = isSoftwareGl ? 64 : 112;
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, segs, segs);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      bumpMap: moonBumpTex,
      bumpScale: 0.16,
      roughness: 0.86,
      metalness: 0.04,
      color: '#f8fafc',
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);
    disposables.push(moonGeo, moonMat);

    const overlayGroup = new THREE.Group();
    moonGroup.add(overlayGroup);

    // Topographic laser altimeter sweep ring
    const scanGeo = new THREE.RingGeometry(0.995, 1.005, 96);
    const scanMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const scanRingMesh = new THREE.Mesh(scanGeo, scanMat);
    scanRingMesh.rotation.x = -Math.PI / 2;
    overlayGroup.add(scanRingMesh);

    // Lat/lon wireframe sphere
    const gridGeo = new THREE.SphereGeometry(MOON_RADIUS, 36, 18);
    const gridMat = new THREE.MeshBasicMaterial({
      color: '#94a3b8',
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.scale.set(1.004, 1.004, 1.004);
    overlayGroup.add(gridMesh);

    // South polar target zone rings
    const southZoneGroup = new THREE.Group();
    southZoneGroup.position.set(0, -MOON_RADIUS * 0.985, 0);
    southZoneGroup.rotation.x = Math.PI / 2;
    overlayGroup.add(southZoneGroup);

    const spInnerGeo = new THREE.RingGeometry(1.3, 1.32, 64);
    const spInnerMat = new THREE.MeshBasicMaterial({
      color: '#e2e8f0',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    southZoneGroup.add(new THREE.Mesh(spInnerGeo, spInnerMat));

    const spOuterGeo = new THREE.RingGeometry(2.2, 2.21, 64);
    const spOuterMat = new THREE.MeshBasicMaterial({
      color: '#94a3b8',
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    southZoneGroup.add(new THREE.Mesh(spOuterGeo, spOuterMat));
    disposables.push(scanGeo, scanMat, gridGeo, gridMat, spInnerGeo, spInnerMat, spOuterGeo, spOuterMat);

    // Subtle surface beacons on Moon (pure 3D geometry without DOM pill overlays)
    for (const site of INTRO_CANDIDATE_SITES) {
      const pos3d = latLngToVector3(site.lat, site.lng, MOON_RADIUS);
      const normal = pos3d.clone().normalize();
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(pos3d).multiplyScalar(1.008);

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, normal.x * 0.55, normal.y * 0.55, normal.z * 0.55]),
          3
        )
      );
      const lineMat = new THREE.LineBasicMaterial({
        color: '#e2e8f0',
        transparent: true,
        opacity: 0.45,
      });
      markerGroup.add(new THREE.Line(lineGeo, lineMat));

      const ringGeo = new THREE.RingGeometry(0.08, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#e2e8f0',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(normal.x * 0.02, normal.y * 0.02, normal.z * 0.02);
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      markerGroup.add(ringMesh);

      overlayGroup.add(markerGroup);
      disposables.push(lineGeo, lineMat, ringGeo, ringMat);
    }

    // Pre-compile WebGL shaders once on GPU to avoid first-frame hitching
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Initial camera pose
    let simTime = 0;
    let scanElapsed = 0;
    let finalPhaseSent = false;
    let completionSent = false;
    const lookTarget = new THREE.Vector3(-5, 4, 0);
    evaluateCameraTrack(0, camera.position, lookTarget);
    camera.lookAt(lookTarget);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth || window.innerWidth);
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let rafId = 0;
    let swTimerId = 0;
    let disposed = false;
    let lastTimestamp = performance.now();

    const stepFrame = (now: number) => {
      if (disposed) return;

      const rawDelta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const delta = Math.min(0.05, Math.max(0.001, rawDelta)) * ANIMATION_SPEED;

      simTime = Math.min(TOTAL_DURATION_SEC, simTime + delta);
      scanElapsed += delta;
      const curPhase = computePhaseFromTime(simTime);

      evaluateCameraTrack(simTime, camera.position, lookTarget);
      camera.lookAt(lookTarget);

      if (simTime >= FINAL_PHASE_START_SEC && !finalPhaseSent) {
        finalPhaseSent = true;
        callbacksRef.current.onFinalPhase?.();
      }

      if (simTime >= TOTAL_DURATION_SEC && !completionSent) {
        completionSent = true;
        callbacksRef.current.onIntroComplete();
      }

      // Galaxy fade-out across phases
      const targetGalaxyOpacity =
        curPhase === 'deep_space'
          ? 0.55
          : curPhase === 'earth_reveal'
          ? 0.22
          : curPhase === 'lunar_approach'
          ? 0.05
          : 0.0;
      galaxyShaderMat.uniforms.uTime.value += delta;
      const fadeAlpha = 1 - Math.exp(-5.0 * delta);
      const curOp = THREE.MathUtils.lerp(
        galaxyShaderMat.uniforms.uOpacity.value,
        targetGalaxyOpacity,
        fadeAlpha
      );
      galaxyShaderMat.uniforms.uOpacity.value = curOp;
      galaxyGroup.visible = curOp > 0.002;
      galaxyCoreMat.opacity = 0.85 * curOp;
      galaxyHaloMat.opacity = 0.35 * curOp;
      galaxyPoints.rotation.y += delta * 0.02;
      galaxyCoreMesh.rotation.y += delta * 0.03;

      // Earth rotation
      earthMesh.rotation.y += delta * 0.08;
      cloudMesh.rotation.y += delta * 0.105;

      // Moon rotation + laser altimeter scan ring
      moonMesh.rotation.y += delta * 0.005;
      overlayGroup.rotation.y += delta * 0.005;

      const scanY = Math.sin(scanElapsed) * (MOON_RADIUS * 0.92);
      scanRingMesh.position.y = scanY;
      const ringR = Math.sqrt(Math.max(0.1, MOON_RADIUS * MOON_RADIUS - scanY * scanY)) * 1.02;
      scanRingMesh.scale.set(ringR, ringR, 1);

      renderer.render(scene, camera);

      if (disposed) return;
      if (isSoftwareGl) {
        scheduleAfterDraw(
          renderer,
          () => {
            if (!disposed) rafId = window.requestAnimationFrame(stepFrame);
          },
          (id) => {
            swTimerId = id;
          }
        );
      } else {
        rafId = window.requestAnimationFrame(stepFrame);
      }
    };

    rafId = window.requestAnimationFrame(stepFrame);

    return () => {
      disposed = true;
      window.clearTimeout(fallbackReadyTimer);
      window.clearTimeout(swTimerId);
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 bg-[#02040a] overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};
