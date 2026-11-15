export interface LandingSite {
  id: string;
  name: string;
  designation: string;
  lat: number;
  lng: number;
  elevation: string;
  illuminationPct: number;
  icePotential: 'VERY HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
  slopeRisk: 'MINIMAL (<5°)' | 'LOW (<8°)' | 'MODERATE (10-15°)' | 'CHALLENGING (>15°)';
  thermalRange: string;
  scienceObjectives: string[];
  description: string;
  artemisPriority: boolean;
  color: string;
}

export type CinematicPhase =
  | 'deep_space'       // 0–1s: Brief Milky Way / deep-space opening
  | 'earth_reveal'     // 1–2s: Quick Earth reveal
  | 'lunar_approach'   // 2–5s: Dramatic approach towards the Moon
  | 'lunar_surface'    // 5–7s: Detailed lunar surface reveal with craters and terrain
  | 'site_targeting'   // 7–9s: Landing-site markers, coordinates and mission identity
  | 'hero_active';     // 9–10s: Hero section and ENTER MISSION CONTROL CTA

export interface PlanetData {
  name: string;
  distance: number;
  size: number;
  rotationSpeed: number;
  orbitalSpeed: number;
  orbitRadius: number;
  color: string;
  secondaryColor?: string;
  hasRings?: boolean;
  atmosphereColor?: string;
  description: string;
  stats: {
    diameter: string;
    dayLength: string;
    temperature: string;
    gravity: string;
  };
}
