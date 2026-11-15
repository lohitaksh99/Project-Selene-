import * as THREE from 'three';

/**
 * Loads authentic NASA / JPL astronomical photographic textures
 * from the public directory. Configures wrapping, color space,
 * anisotropy filtering, and mipmaps for ultra-realistic rendering.
 */

class NasaTextureLoader {
  private loader = new THREE.TextureLoader();
  private cache: Map<string, THREE.Texture> = new Map();

  private load(url: string, isColor = true): THREE.Texture {
    if (this.cache.has(url)) return this.cache.get(url)!;

    const texture = this.loader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (isColor) {
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`NASA Texture failed to load from ${url}:`, err);
      }
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (isColor) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.cache.set(url, texture);
    return texture;
  }

  public getSunTexture(): THREE.Texture {
    return this.load('/textures/planets/sunmap.jpg');
  }

  public getMercuryTexture(): THREE.Texture {
    return this.load('/textures/planets/mercurymap.jpg');
  }

  public getMercuryBump(): THREE.Texture {
    return this.load('/textures/planets/mercurybump.jpg', false);
  }

  public getVenusTexture(): THREE.Texture {
    return this.load('/textures/planets/venusmap.jpg');
  }

  public getVenusBump(): THREE.Texture {
    return this.load('/textures/planets/venusbump.jpg', false);
  }

  public getEarthTexture(): THREE.Texture {
    return this.load('/textures/planets/earth_atmos_2048.jpg');
  }

  public getEarthClouds(): THREE.Texture {
    return this.load('/textures/planets/earthcloudmap.jpg');
  }

  public getMoonTexture(): THREE.Texture {
    return this.load('/textures/planets/moon_1024.jpg');
  }

  public getMoonBump(): THREE.Texture {
    return this.load('/textures/planets/moonbump1k.jpg', false);
  }

  public getMarsTexture(): THREE.Texture {
    return this.load('/textures/planets/marsmap1k.jpg');
  }

  public getJupiterTexture(): THREE.Texture {
    return this.load('/textures/planets/jupitermap.jpg');
  }

  public getSaturnTexture(): THREE.Texture {
    return this.load('/textures/planets/saturnmap.jpg');
  }

  public getSaturnRing(): THREE.Texture {
    return this.load('/textures/planets/saturnringcolor.jpg');
  }

  public getUranusTexture(): THREE.Texture {
    return this.load('/textures/planets/uranusmap.jpg');
  }

  public getNeptuneTexture(): THREE.Texture {
    return this.load('/textures/planets/neptunemap.jpg');
  }

  public getPlanetTexture(planetName: string): { map: THREE.Texture; bump?: THREE.Texture } {
    switch (planetName.toLowerCase()) {
      case 'mercury':
        return { map: this.getMercuryTexture(), bump: this.getMercuryBump() };
      case 'venus':
        return { map: this.getVenusTexture(), bump: this.getVenusBump() };
      case 'earth':
        return { map: this.getEarthTexture() };
      case 'moon':
        return { map: this.getMoonTexture(), bump: this.getMoonBump() };
      case 'mars':
        return { map: this.getMarsTexture() };
      case 'jupiter':
        return { map: this.getJupiterTexture() };
      case 'saturn':
        return { map: this.getSaturnTexture() };
      case 'uranus':
        return { map: this.getUranusTexture() };
      case 'neptune':
        return { map: this.getNeptuneTexture() };
      default:
        return { map: this.getMercuryTexture() };
    }
  }
}

export const nasaTextureLoader = new NasaTextureLoader();
