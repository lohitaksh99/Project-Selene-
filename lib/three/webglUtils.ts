'use client';

import * as THREE from 'three';
import { LunarShaderMode } from '../store/useSeleneStore';
import { sampleLunarTerrain } from '../terrain/lolaTerrainEngine';

let cachedIsSoftwareGl: boolean | null = null;

/**
 * Detects software WebGL (SwiftShader, llvmpipe, softpipe, Basic Render) from the GPU renderer string.
 */
export function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return false;
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = true;
    return true;
  }
}

/**
 * Waits for CPU/GPU WebGL draw commands to complete before scheduling the next tick (80ms pause on software GL).
 */
export function scheduleAfterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  setTimerId: (id: number) => void
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl || typeof gl.fenceSync !== 'function') {
    const id = window.setTimeout(cb, 80);
    setTimerId(id);
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    if (!sync) {
      const id = window.setTimeout(cb, 80);
      setTimerId(id);
      return;
    }
    const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
    if (state === gl.UNSIGNALED) {
      const id = window.setTimeout(poll, 5);
      setTimerId(id);
    } else {
      gl.deleteSync(sync);
      const id = window.setTimeout(cb, 80);
      setTimerId(id);
    }
  };
  const id = window.setTimeout(poll, 5);
  setTimerId(id);
}

// Module-level texture cache and performance telemetry counters (Part 8 Optimization)
const shaderTextureCache = new Map<
  LunarShaderMode,
  { colorCanvas: HTMLCanvasElement; bumpCanvas: HTMLCanvasElement }
>();
let textureCacheHits = 0;
let textureCacheMisses = 0;
let wacGlobalCompositeLoaded = false;

export function getWebglTextureCacheTelemetry() {
  return {
    cachedShaderModes: Array.from(shaderTextureCache.keys()),
    textureCacheHits,
    textureCacheMisses,
    wacGlobalCompositeLoaded,
  };
}

/**
 * Selenographic coordinates and angular radii of major Lunar Maria, Basins, and Rayed Craters
 * used to synthesize a realistic grayscale Natural Moon basemap before/alongside live WAC tiles.
 */
const LUNAR_MARIA_BASINS: Array<{
  name: string;
  latDeg: number;
  lonDeg: number;
  radiusDeg: number;
  albedoDelta: number; // Negative for dark basaltic maria, positive for bright rayed craters
}> = [
  { name: 'Oceanus Procellarum North', latDeg: 22.0, lonDeg: -56.0, radiusDeg: 26.0, albedoDelta: -52 },
  { name: 'Oceanus Procellarum South', latDeg: -4.0, lonDeg: -46.0, radiusDeg: 22.0, albedoDelta: -46 },
  { name: 'Mare Imbrium', latDeg: 34.7, lonDeg: -14.9, radiusDeg: 19.5, albedoDelta: -54 },
  { name: 'Mare Serenitatis', latDeg: 28.0, lonDeg: 17.5, radiusDeg: 12.5, albedoDelta: -52 },
  { name: 'Mare Tranquillitatis', latDeg: 8.5, lonDeg: 31.4, radiusDeg: 15.0, albedoDelta: -50 },
  { name: 'Mare Crisium', latDeg: 17.0, lonDeg: 59.1, radiusDeg: 9.5, albedoDelta: -54 },
  { name: 'Mare Fecunditatis', latDeg: -7.8, lonDeg: 53.7, radiusDeg: 13.5, albedoDelta: -45 },
  { name: 'Mare Nectaris', latDeg: -15.2, lonDeg: 34.6, radiusDeg: 7.5, albedoDelta: -44 },
  { name: 'Mare Humorum', latDeg: -24.4, lonDeg: -38.6, radiusDeg: 8.2, albedoDelta: -48 },
  { name: 'Mare Nubium', latDeg: -21.3, lonDeg: -16.6, radiusDeg: 12.8, albedoDelta: -44 },
  { name: 'Mare Cognitum', latDeg: -10.5, lonDeg: -22.3, radiusDeg: 7.5, albedoDelta: -42 },
  { name: 'Mare Frigoris', latDeg: 56.0, lonDeg: 1.4, radiusDeg: 18.0, albedoDelta: -36 },
  { name: 'Mare Moscoviense', latDeg: 27.3, lonDeg: 147.9, radiusDeg: 6.5, albedoDelta: -42 },
  { name: 'South Pole-Aitken Basin', latDeg: -53.0, lonDeg: -169.0, radiusDeg: 36.0, albedoDelta: -26 },
  // Bright Copernican rayed impact craters
  { name: 'Tycho Ray System', latDeg: -43.3, lonDeg: -11.4, radiusDeg: 11.0, albedoDelta: 36 },
  { name: 'Copernicus Ray System', latDeg: 9.6, lonDeg: -20.1, radiusDeg: 9.5, albedoDelta: 30 },
  { name: 'Kepler Ray System', latDeg: 8.1, lonDeg: -38.0, radiusDeg: 6.0, albedoDelta: 26 },
  { name: 'Aristarchus Plateau', latDeg: 23.7, lonDeg: -47.4, radiusDeg: 5.5, albedoDelta: 42 },
];

/**
 * Evaluates natural lunar regolith albedo (0..255) for any selenographic coordinate (latDeg, lonDeg)
 * combining maria/highland contrast, multi-scale crater rings, and LOLA polar topography.
 */
export function evaluateNaturalLunarAlbedo(
  latDeg: number,
  lonDeg: number,
  elevNorm: number,
  slopeDeg: number,
  isPsr: boolean
): number {
  if (isPsr) {
    return 24;
  }

  // Base highland anorthositic regolith reflectance
  let albedo = 128 + (elevNorm - 0.5) * 68;

  // Apply major basaltic maria and Copernican crater ray systems
  for (let i = 0; i < LUNAR_MARIA_BASINS.length; i++) {
    const feat = LUNAR_MARIA_BASINS[i]!;
    const dLat = latDeg - feat.latDeg;
    let dLon = lonDeg - feat.lonDeg;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const cosLat = Math.max(0.25, Math.cos((latDeg * Math.PI) / 180));
    const angularDist = Math.hypot(dLat, dLon * cosLat);
    if (angularDist < feat.radiusDeg) {
      const t = 1 - angularDist / feat.radiusDeg;
      const smooth = t * t * (3 - 2 * t);
      albedo += feat.albedoDelta * smooth;
    }
  }

  // Multi-scale cratered highland micro-texture & rim highlights
  const c1 = Math.sin(latDeg * 0.42 + lonDeg * 0.37) * Math.cos(latDeg * 0.31 - lonDeg * 0.48);
  const c2 = Math.sin(latDeg * 1.35 - lonDeg * 1.12) * Math.cos(latDeg * 0.95 + lonDeg * 1.28);
  const c3 = Math.sin(latDeg * 3.4 + lonDeg * 2.9) * 0.5;
  const craterDetail = c1 * 14 + c2 * 9 + c3 * 6;

  // Subtle slope shading for crater walls
  const slopeShade = Math.min(18, slopeDeg * 0.65);

  return Math.max(22, Math.min(238, Math.round(albedo + craterDetail - slopeShade)));
}

/**
 * Generates calibrated scientific lunar shader textures using the LOLA South Pole terrain engine
 * for the polar cap (-78°S to -90°S) and global selenographic relief outside the polar cap.
 * Caches generated canvases per mode so repeated switches are instantaneous.
 */
export function createLunarShaderTexture(
  mode: LunarShaderMode,
  renderer: THREE.WebGLRenderer
): { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const cached = shaderTextureCache.get(mode);
  if (cached) {
    textureCacheHits++;
    const colorMap = new THREE.CanvasTexture(cached.colorCanvas);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;
    colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const bumpMap = new THREE.CanvasTexture(cached.bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;
    bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return { colorMap, bumpMap };
  }

  textureCacheMisses++;
  const width = 512;
  const height = 256;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Share bumpCanvas across all modes if already computed
  let bumpCanvas = shaderTextureCache.values().next().value?.bumpCanvas;
  const needBumpCompute = !bumpCanvas;
  if (!bumpCanvas) {
    bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
  }
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImgData = needBumpCompute ? bCtx.createImageData(width, height) : null;
  const bData = bImgData?.data;

  for (let y = 0; y < height; y++) {
    // y=0 -> South Pole (-90°S) at +Y crown; y=height -> North Pole (+90°N)
    const lat = -90 + (y / height) * 180;
    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;

      let elevNorm = 0.5;
      let slopeDeg = 4.0;
      let ldecCount = 2.0;
      let isPsr = false;

      if (lat <= -78.0) {
        const sample = sampleLunarTerrain(lat, lon);
        const elevM = sample.elevationM ?? 0;
        elevNorm = Math.max(0, Math.min(1, (elevM + 3500) / 8800));
        slopeDeg = sample.slopeDeg ?? 4.0;
        ldecCount = sample.measurementSupportLdec ?? 0;
        isPsr = sample.psrStatus === 'PERMANENT_SHADOW_LPSR';
      } else {
        const n1 = Math.sin(lat * 0.09) * Math.cos(lon * 0.09);
        const n2 = Math.sin(lat * 0.27 + lon * 0.21) * 0.45;
        const n3 = Math.cos(lat * 0.55 - lon * 0.48) * 0.25;
        const n4 = Math.sin(lat * 1.4 - lon * 1.2) * 0.14;
        elevNorm = Math.max(0, Math.min(1, 0.52 + n1 * 0.22 + n2 * 0.15 + n3 * 0.1 + n4 * 0.06));
        slopeDeg = Math.abs(n2 + n4) * 16.0;
      }

      const idx = (y * width + x) * 4;
      if (needBumpCompute && bData) {
        const bumpVal = Math.round(elevNorm * 255);
        bData[idx] = bumpVal;
        bData[idx + 1] = bumpVal;
        bData[idx + 2] = bumpVal;
        bData[idx + 3] = 255;
      }

      let r = 140,
        g = 140,
        b = 145;

      if (mode === 'albedo') {
        // Natural Grayscale Moon with authentic maria/highland contrast & subtle warm regolith tone
        const v = evaluateNaturalLunarAlbedo(lat, lon, elevNorm, slopeDeg, isPsr);
        r = v;
        g = Math.max(18, v - 1);
        b = Math.max(16, v - 4);
      } else if (mode === 'lola') {
        if (elevNorm < 0.25) {
          const t = elevNorm / 0.25;
          r = Math.round(45 * (1 - t));
          g = Math.round(80 * t);
          b = Math.round(150 + 100 * t);
        } else if (elevNorm < 0.5) {
          const t = (elevNorm - 0.25) / 0.25;
          r = Math.round(30 * t);
          g = Math.round(80 + 165 * t);
          b = Math.round(250 * (1 - t * 0.55));
        } else if (elevNorm < 0.75) {
          const t = (elevNorm - 0.5) / 0.25;
          r = Math.round(30 + 225 * t);
          g = Math.round(245 - 45 * t);
          b = Math.round(100 * (1 - t));
        } else {
          const t = (elevNorm - 0.75) / 0.25;
          r = 255;
          g = Math.round(200 - 110 * (1 - t * 0.5));
          b = Math.round(195 * t);
        }
      } else if (mode === 'slope') {
        // LDSM Slope Screening: <=7° Emerald, 7-15° Caution Amber, >15° Hazard Crimson
        if (slopeDeg <= 7.0) {
          r = 16;
          g = 185;
          b = 129;
        } else if (slopeDeg <= 15.0) {
          r = 245;
          g = 158;
          b = 11;
        } else {
          r = 239;
          g = 68;
          b = 68;
        }
      } else if (mode === 'uncertainty') {
        // LDEC measurement support: Tier 1 (LDEC > 0) Emerald/Cyan vs Tier 2 (LDEC == 0) Amber
        if (lat > -78.0) {
          r = 95;
          g = 95;
          b = 105;
        } else if (ldecCount > 0) {
          const intensity = Math.min(1, ldecCount / 6.0);
          r = Math.round(16 * (1 - intensity) + 56 * intensity);
          g = Math.round(185 + 30 * intensity);
          b = Math.round(129 + 115 * intensity);
        } else {
          r = 245;
          g = 158;
          b = 11;
        }
      } else if (mode === 'illumination') {
        if (isPsr) {
          r = 35;
          g = 55;
          b = 205;
        } else {
          const warm = Math.round(70 + elevNorm * 175);
          r = Math.min(255, Math.round(warm * 1.12));
          g = Math.round(warm * 0.92);
          b = Math.round(warm * 0.68);
        }
      } else {
        // Volatiles / Scientific Composite
        if (isPsr) {
          r = 56;
          g = 189;
          b = 248;
        } else {
          const base = Math.round(68 + elevNorm * 95);
          r = base;
          g = base + 5;
          b = base + 14;
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (needBumpCompute && bImgData) {
    bCtx.putImageData(bImgData, 0, 0);
  }

  shaderTextureCache.set(mode, { colorCanvas, bumpCanvas });

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { colorMap, bumpMap };
}

/**
 * Asynchronously fetches the live NASA Moon Trek LROC WAC global basemap tiles (z=0, col=0 & col=1)
 * and composites them into the cached 'albedo' (Natural Moon) canvas texture in South-Up orientation
 * while preserving the high-resolution LOLA South Polar relief crown (-78°S to -90°S).
 */
export function enhanceNaturalMoonWithLiveWacTiles(
  onUpdated: (newColorMap: THREE.CanvasTexture) => void,
  renderer: THREE.WebGLRenderer
): void {
  if (typeof window === 'undefined' || wacGlobalCompositeLoaded) return;

  const imgWest = new Image();
  const imgEast = new Image();
  imgWest.crossOrigin = 'anonymous';
  imgEast.crossOrigin = 'anonymous';

  let loadedCount = 0;
  const checkComplete = () => {
    loadedCount++;
    if (loadedCount < 2) return;
    try {
      const cachedAlbedo = shaderTextureCache.get('albedo');
      if (!cachedAlbedo) return;
      const width = cachedAlbedo.colorCanvas.width;
      const height = cachedAlbedo.colorCanvas.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return;

      // Flip vertically so South Pole (-90°S) stays at y=0 (matching South-Up sphere UV mapping)
      tCtx.save();
      tCtx.translate(0, height);
      tCtx.scale(1, -1);
      tCtx.drawImage(imgWest, 0, 0, width / 2, height);
      tCtx.drawImage(imgEast, width / 2, 0, width / 2, height);
      tCtx.restore();

      const wacData = tCtx.getImageData(0, 0, width, height).data;
      const mainCtx = cachedAlbedo.colorCanvas.getContext('2d');
      if (!mainCtx) return;
      const mainImg = mainCtx.getImageData(0, 0, width, height);
      const mData = mainImg.data;

      for (let y = 0; y < height; y++) {
        const lat = -90 + (y / height) * 180;
        // Blend smoothly between LOLA South Polar crown (-90°S..-78°S) and live LROC WAC global mosaic
        const wacWeight = lat <= -82 ? 0.25 : lat <= -74 ? 0.25 + ((lat + 82) / 8) * 0.55 : 0.8;
        const synthWeight = 1 - wacWeight;
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const wR = wacData[idx] ?? 120;
          if (wR > 5) {
            mData[idx] = Math.round(mData[idx]! * synthWeight + wR * wacWeight);
            mData[idx + 1] = Math.round(mData[idx + 1]! * synthWeight + (wacData[idx + 1] ?? wR) * wacWeight);
            mData[idx + 2] = Math.round(mData[idx + 2]! * synthWeight + (wacData[idx + 2] ?? wR) * wacWeight);
          }
        }
      }

      mainCtx.putImageData(mainImg, 0, 0);
      wacGlobalCompositeLoaded = true;

      const updatedTex = new THREE.CanvasTexture(cachedAlbedo.colorCanvas);
      updatedTex.colorSpace = THREE.SRGBColorSpace;
      updatedTex.wrapS = THREE.RepeatWrapping;
      updatedTex.wrapT = THREE.ClampToEdgeWrapping;
      updatedTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      onUpdated(updatedTex);
    } catch {
      // Non-fatal fallback to synthesized Natural Moon texture
    }
  };

  imgWest.onload = checkComplete;
  imgEast.onload = checkComplete;
  imgWest.src =
    '/api/lunar/wmts?action=tile&projection=EQ&layer=LRO_WAC_Mosaic_Global_303ppd_v02&z=0&row=0&col=0&ext=jpg';
  imgEast.src =
    '/api/lunar/wmts?action=tile&projection=EQ&layer=LRO_WAC_Mosaic_Global_303ppd_v02&z=0&row=0&col=1&ext=jpg';
}

