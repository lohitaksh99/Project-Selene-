import * as THREE from 'three';

/**
 * High-fidelity astronomical texture generators.
 * Generates photorealistic spherical projections for the Sun, Moon,
 * Earth (surface + clouds), all 8 planets, and Saturn rings.
 */

class TextureGenerator {
  private cache: Map<string, THREE.CanvasTexture> = new Map();

  // Simple pseudo-random hash for deterministic noise
  private pseudoNoise(x: number, y: number, seed = 1337): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  }

  // Smooth 2D noise
  private smoothNoise(x: number, y: number, seed = 1337): number {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;

    // Hermite curve for smooth interpolation
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.pseudoNoise(i, j, seed);
    const n10 = this.pseudoNoise(i + 1, j, seed);
    const n01 = this.pseudoNoise(i, j + 1, seed);
    const n11 = this.pseudoNoise(i + 1, j + 1, seed);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;

    return nx0 * (1 - sy) + nx1 * sy;
  }

  // Fractional Brownian Motion (fractal turbulence)
  private fbm(x: number, y: number, octaves = 5, seed = 1337): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.smoothNoise(x * frequency, y * frequency, seed + i * 31) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return total / maxValue;
  }

  /**
   * High-Resolution Lunar Surface Texture (1024x512)
   * Featuring basalt maria (Oceanus Procellarum, Mare Tranquillitatis),
   * bright anorthosite highlands, multi-scale craters, and ray systems.
   */
  public getMoonTexture(): THREE.CanvasTexture {
    if (this.cache.has('moon')) return this.cache.get('moon')!;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Generate base highland/maria elevation
    for (let y = 0; y < height; y++) {
      const ny = y / height;
      const phi = ny * Math.PI;
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const theta = nx * 2 * Math.PI;

        // Spherical 3D coordinate mapping to reduce polar distortion
        const cx = Math.sin(phi) * Math.cos(theta);
        const cy = Math.cos(phi);
        const cz = Math.sin(phi) * Math.sin(theta);

        // Low frequency noise for Maria (dark basalt volcanic plains)
        const mariaNoise = this.fbm(cx * 2.2 + 5, cy * 2.2 + 5, 4, 8821);
        const highlandNoise = this.fbm(cx * 5.5 + 2, cy * 5.5 + 2, 5, 4123);
        const microRegolith = this.pseudoNoise(x * 0.4, y * 0.4, 991) * 0.12;

        let baseShade: number;
        if (mariaNoise < 0.48) {
          // Lunar Maria: darker basalt, grey-brownish tones (albedo ~0.07)
          baseShade = 48 + highlandNoise * 35 + microRegolith * 20;
        } else {
          // Lunar Highlands: bright feldspathic anorthosite (albedo ~0.16)
          baseShade = 110 + highlandNoise * 85 + microRegolith * 30;
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, baseShade * 0.98); // R
        data[idx + 1] = Math.min(255, baseShade * 0.98); // G
        data[idx + 2] = Math.min(255, baseShade * 1.02); // B (subtle cool lunar grey)
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Overlay procedurally stamped realistic impact craters with rim uplift and shadows
    const craterSeeds = [
      { x: 380, y: 180, r: 42, depth: 0.65, rays: true }, // Tycho-like
      { x: 260, y: 220, r: 55, depth: 0.7, rays: true },  // Copernicus-like
      { x: 520, y: 390, r: 75, depth: 0.55, rays: false }, // South Pole-Aitken edge
      { x: 505, y: 460, r: 35, depth: 0.6, rays: false }, // Shackleton area
      { x: 740, y: 190, r: 45, depth: 0.65, rays: true },
      { x: 620, y: 150, r: 32, depth: 0.5, rays: false },
      { x: 150, y: 320, r: 28, depth: 0.5, rays: false },
      { x: 820, y: 270, r: 38, depth: 0.55, rays: false },
      { x: 440, y: 240, r: 24, depth: 0.45, rays: false },
      { x: 310, y: 120, r: 30, depth: 0.5, rays: false },
    ];

    // Add thousands of smaller random impact micro-craters
    for (let i = 0; i < 180; i++) {
      const rx = (Math.sin(i * 37.3) * 0.5 + 0.5) * width;
      const ry = (Math.cos(i * 59.1) * 0.4 + 0.5) * height;
      const rr = 3 + (Math.sin(i * 12.7) * 0.5 + 0.5) * 14;
      craterSeeds.push({ x: rx, y: ry, r: rr, depth: 0.4, rays: false });
    }

    // Render crater depressions, rims, and rays
    craterSeeds.forEach(c => {
      // Ray system
      if (c.rays) {
        ctx.save();
        ctx.strokeStyle = 'rgba(235, 240, 255, 0.18)';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < Math.PI * 2; a += 0.28) {
          const rayLen = c.r * (3 + Math.sin(a * 7) * 2);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.cos(a) * rayLen, c.y + Math.sin(a) * rayLen);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Outer raised rim (bright ejecta crest)
      const grad = ctx.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r * 1.25);
      grad.addColorStop(0, 'rgba(20, 20, 24, 0.7)'); // Dark shadow floor
      grad.addColorStop(0.7, 'rgba(35, 35, 40, 0.4)');
      grad.addColorStop(0.9, 'rgba(215, 220, 230, 0.45)'); // Bright sunward rim
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Central peak for large impact basins
      if (c.r > 30) {
        ctx.fillStyle = 'rgba(190, 195, 205, 0.5)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.set('moon', texture);
    return texture;
  }

  /**
   * Lunar Surface Normal & Bump Map for 3D crater displacement
   */
  public getMoonBumpMap(): THREE.CanvasTexture {
    if (this.cache.has('moonBump')) return this.cache.get('moonBump')!;

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        const noise = this.fbm(nx * 12, ny * 12, 4, 303);
        const bumpVal = Math.floor(noise * 255);
        const idx = (y * width + x) * 4;
        data[idx] = bumpVal;
        data[idx + 1] = bumpVal;
        data[idx + 2] = bumpVal;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Add crater relief rims to bump map
    for (let i = 0; i < 40; i++) {
      const cx = (Math.sin(i * 19.3) * 0.5 + 0.5) * width;
      const cy = (Math.cos(i * 29.1) * 0.5 + 0.5) * height;
      const cr = 8 + (Math.sin(i * 7.1) * 0.5 + 0.5) * 28;

      const grad = ctx.createRadialGradient(cx, cy, cr * 0.3, cx, cy, cr);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
      grad.addColorStop(0.7, 'rgba(60, 60, 60, 0.4)');
      grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, 'rgba(128, 128, 128, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.set('moonBump', texture);
    return texture;
  }

  /**
   * Earth Surface Texture (Continents, oceans, polar caps)
   */
  public getEarthTexture(): THREE.CanvasTexture {
    if (this.cache.has('earth')) return this.cache.get('earth')!;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      const phi = ny * Math.PI;
      const lat = (0.5 - ny) * 180; // Latitude in degrees

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const theta = nx * 2 * Math.PI;

        const cx = Math.sin(phi) * Math.cos(theta);
        const cy = Math.cos(phi);
        const cz = Math.sin(phi) * Math.sin(theta);

        // Continental landmass distribution using multi-frequency spherical harmonics
        const continentNoise = this.fbm(cx * 2.1 + 10, cy * 2.1 + 10, 5, 1024);
        const detailNoise = this.fbm(cx * 6.5, cy * 6.5, 4, 2048);

        let r = 10, g = 35, b = 95; // Deep ocean base blue

        // Polar ice caps (North & South poles)
        if (Math.abs(lat) > 74 || (Math.abs(lat) > 65 && detailNoise > 0.45)) {
          r = 235; g = 245; b = 255; // White polar ice
        } else if (continentNoise > 0.52) {
          // Landmass
          const vegetation = detailNoise;
          if (vegetation > 0.6) {
            // Dense rainforest / lush green
            r = 28; g = 98; b = 38;
          } else if (vegetation > 0.42) {
            // Woodlands / temperate savanna
            r = 65; g = 115; b = 45;
          } else if (Math.abs(lat) < 32 && detailNoise < 0.38) {
            // Desert sands (Sahara, Arabian, Gobi)
            r = 185; g = 145; b = 90;
          } else {
            // Mountainous terrain / plateau
            r = 110; g = 95; b = 70;
          }
        } else if (continentNoise > 0.48) {
          // Shallow coastal shelf / turquoise waters
          r = 22; g = 85; b = 130;
        }

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('earth', texture);
    return texture;
  }

  /**
   * Earth Atmospheric Clouds Layer
   */
  public getEarthCloudsTexture(): THREE.CanvasTexture {
    if (this.cache.has('earthClouds')) return this.cache.get('earthClouds')!;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      const phi = ny * Math.PI;

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const theta = nx * 2 * Math.PI;

        const cx = Math.sin(phi) * Math.cos(theta);
        const cy = Math.cos(phi);
        const cz = Math.sin(phi) * Math.sin(theta);

        // Swirling cyclonic storm patterns
        const cloudNoise = this.fbm(cx * 3.5 + Math.sin(cy * 5.0) * 0.5, cy * 3.5, 5, 911);
        const alpha = cloudNoise > 0.52 ? Math.min(240, Math.floor((cloudNoise - 0.52) * 450)) : 0;

        const idx = (y * width + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('earthClouds', texture);
    return texture;
  }

  /**
   * Sun Photosphere Texture with Granulation and Sunspots
   */
  public getSunTexture(): THREE.CanvasTexture {
    if (this.cache.has('sun')) return this.cache.get('sun')!;

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;

        const flame = this.fbm(nx * 8, ny * 8, 4, 777);
        const spotNoise = this.fbm(nx * 4, ny * 4, 3, 111);

        let r = 255;
        let g = Math.floor(140 + flame * 115);
        let b = Math.floor(20 + flame * 60);

        // Sunspot umbra & penumbra
        if (spotNoise > 0.72) {
          r = 140;
          g = 60;
          b = 10;
        }

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('sun', texture);
    return texture;
  }

  /**
   * Jupiter Dynamic Banding & Great Red Spot
   */
  public getJupiterTexture(): THREE.CanvasTexture {
    if (this.cache.has('jupiter')) return this.cache.get('jupiter')!;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      // Zonal jet streams
      const band = Math.sin(ny * 32.0) * 0.5 + 0.5;

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const turbulence = this.fbm(nx * 14 + band * 2.0, ny * 10, 4, 4321);

        // Jovian atmospheric palette: zones (white/cream) and belts (rust/brown)
        let r = 200 + turbulence * 40 - band * 50;
        let g = 140 + turbulence * 35 - band * 60;
        let b = 90 + turbulence * 25 - band * 45;

        // Great Red Spot (at lat ~22° S, lng ~0.65)
        const dx = (nx - 0.65) * 2.5;
        const dy = (ny - 0.62) * 5.0;
        const distSpot = Math.sqrt(dx * dx + dy * dy);
        if (distSpot < 0.16) {
          const spotWeight = 1 - distSpot / 0.16;
          r = r * (1 - spotWeight) + 215 * spotWeight;
          g = g * (1 - spotWeight) + 70 * spotWeight;
          b = b * (1 - spotWeight) + 40 * spotWeight;
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('jupiter', texture);
    return texture;
  }

  /**
   * Saturn Body Texture (Subtle butterscotch bands)
   */
  public getSaturnTexture(): THREE.CanvasTexture {
    if (this.cache.has('saturn')) return this.cache.get('saturn')!;

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      const band = Math.sin(ny * 24.0) * 0.2 + 0.8;

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const turb = this.fbm(nx * 8, ny * 6, 3, 555) * 0.15;

        const r = Math.min(255, Math.floor(225 * band + turb * 30));
        const g = Math.min(255, Math.floor(190 * band + turb * 20));
        const b = Math.min(255, Math.floor(130 * band + turb * 15));

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('saturn', texture);
    return texture;
  }

  /**
   * Saturn Rings Texture (Radial 1D profile with Cassini Division and ringlets)
   */
  public getSaturnRingTexture(): THREE.CanvasTexture {
    if (this.cache.has('saturnRing')) return this.cache.get('saturnRing')!;

    const width = 512;
    const height = 16;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let x = 0; x < width; x++) {
      const rPos = x / width; // 0 is inner ring, 1 is outer ring

      let alpha = 0;
      let brightness = 180;

      if (rPos > 0.08 && rPos < 0.32) {
        // C Ring (Crepe ring, faint)
        alpha = 80 + Math.sin(rPos * 180) * 30;
        brightness = 150;
      } else if (rPos >= 0.32 && rPos < 0.68) {
        // B Ring (Dense, brightest)
        alpha = 230 + Math.sin(rPos * 300) * 25;
        brightness = 220;
      } else if (rPos >= 0.68 && rPos < 0.74) {
        // Cassini Division (nearly empty gap)
        alpha = 15;
        brightness = 80;
      } else if (rPos >= 0.74 && rPos < 0.94) {
        // A Ring
        alpha = 180 + Math.sin(rPos * 250) * 30;
        brightness = 195;
        // Encke gap
        if (rPos > 0.86 && rPos < 0.88) {
          alpha = 25;
        }
      }

      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        data[idx] = brightness;
        data[idx + 1] = Math.floor(brightness * 0.92);
        data[idx + 2] = Math.floor(brightness * 0.75); // Pale icy beige
        data[idx + 3] = alpha;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('saturnRing', texture);
    return texture;
  }

  /**
   * Mars Surface Texture (Iron oxide rust, Syrtis Major, polar ice)
   */
  public getMarsTexture(): THREE.CanvasTexture {
    if (this.cache.has('mars')) return this.cache.get('mars')!;

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      const lat = (0.5 - ny) * 180;

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const terrain = this.fbm(nx * 6, ny * 6, 4, 999);
        const darkVolcanic = this.fbm(nx * 3.5, ny * 3.5, 3, 202);

        let r = 185 + terrain * 55;
        let g = 75 + terrain * 35;
        let b = 45 + terrain * 25;

        // Dark basaltic plains (Syrtis Major / Sinus Sabaeus)
        if (darkVolcanic < 0.38) {
          r = 100 + terrain * 30;
          g = 50 + terrain * 20;
          b = 35 + terrain * 15;
        }

        // Polar ice caps (Planum Boreum / Planum Australe)
        if (Math.abs(lat) > 80) {
          r = 245; g = 245; b = 255;
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set('mars', texture);
    return texture;
  }

  /**
   * General Planet Texture Builder (Venus, Mercury, Uranus, Neptune)
   */
  public getPlanetTexture(planetName: string): THREE.CanvasTexture {
    if (this.cache.has(planetName)) return this.cache.get(planetName)!;

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const noise = this.fbm(nx * 8, ny * 8, 4, planetName.length * 77);

        let r = 120, g = 120, b = 120;

        switch (planetName.toLowerCase()) {
          case 'mercury':
            // High crater density, grey rocky surface
            const rock = Math.floor(100 + noise * 110);
            r = rock; g = rock; b = rock + 5;
            break;
          case 'venus':
            // Sulfuric yellow/ochre haze bands
            const vBand = Math.sin(ny * 16 + noise * 2) * 0.2 + 0.8;
            r = Math.floor(220 * vBand);
            g = Math.floor(180 * vBand);
            b = Math.floor(100 * vBand);
            break;
          case 'uranus':
            // Pale aquamarine ice cyan
            const uBand = Math.sin(ny * 8) * 0.1 + 0.9;
            r = Math.floor(75 * uBand + noise * 15);
            g = Math.floor(205 * uBand + noise * 25);
            b = Math.floor(225 * uBand + noise * 30);
            break;
          case 'neptune':
            // Vivid azure deep blue with white cirrus methane storms
            const nBand = Math.sin(ny * 12) * 0.15 + 0.85;
            r = Math.floor(35 * nBand + (noise > 0.65 ? 120 : 0));
            g = Math.floor(80 * nBand + (noise > 0.65 ? 150 : 0));
            b = Math.floor(215 * nBand + (noise > 0.65 ? 40 : 0));
            break;
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set(planetName, texture);
    return texture;
  }
}

export const textureGenerator = new TextureGenerator();
