import { LandingSite, PlanetData } from '../types/mission';

/**
 * Requirement 9: Mission Control Integration Point
 * Teammate's independent Mission Control application URL.
 * Set to your deployed Mission Control application URL (e.g. "https://mission-control.nasa-hackathon.app" or "http://localhost:3000")
 */
/**
 * Requirement 8: Mission Control Integration Point
 * Project Selene independent Mission Control application URL.
 */
export const MISSION_CONTROL_URL: string = "https://ais-pre-wuocrxlmlpkpc6ew4wveaa-207098358091.asia-northeast1.run.app/#home";

export const CANDIDATE_LANDING_SITES: LandingSite[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Connecting Ridge',
    designation: 'NASA-ARTEMIS-SITE-01',
    lat: -89.78,
    lng: 129.2,
    elevation: '+4.2 km (Rim Crest)',
    illuminationPct: 92,
    icePotential: 'VERY HIGH',
    slopeRisk: 'LOW (<8°)',
    thermalRange: '40 K to 290 K',
    artemisPriority: true,
    color: '#00f0ff',
    scienceObjectives: [
      'Sample permanently shadowed regions (PSR) with volatiles',
      'Deploy long-duration solar array on peak of eternal light',
      'Direct line-of-sight optical comms with Earth'
    ],
    description: 'Premier candidate for Artemis III crewed touchdown. The ridge between Shackleton and de Gerlache craters receives continuous solar power for 86%+ of the lunar year, while adjacent craters harbor massive water ice deposits in eternal shadow.'
  },
  {
    id: 'malapert-mountain',
    name: 'Malapert Mountain (Peak)',
    designation: 'NASA-ARTEMIS-SITE-02',
    lat: -86.04,
    lng: 2.7,
    elevation: '+5.0 km (Massif Summit)',
    illuminationPct: 89,
    icePotential: 'HIGH',
    slopeRisk: 'MINIMAL (<5°)',
    thermalRange: '50 K to 280 K',
    artemisPriority: true,
    color: '#38bdf8',
    scienceObjectives: [
      'Sub-surface core sampling to 3m depth',
      'Deep space astronomical observatory base station',
      'Continuous Earth telemetry relay outpost'
    ],
    description: 'A 5,000-meter promontory providing an unobstructed line-of-sight to Earth for uninterruptible direct communications. Smooth flat plateaus at the peak provide ideal hazard-free landing zones.'
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Crater Rim 1',
    designation: 'NASA-VIPER-SITE-03',
    lat: -85.2,
    lng: 35.8,
    elevation: '+2.8 km (Crater Edge)',
    illuminationPct: 78,
    icePotential: 'VERY HIGH',
    slopeRisk: 'MODERATE (10-15°)',
    thermalRange: '35 K to 260 K',
    artemisPriority: true,
    color: '#a855f7',
    scienceObjectives: [
      'Validate neutron spectrometer volatile signatures',
      'Excavation testing for in-situ resource utilization (ISRU)',
      'Characterize regolith grain distribution at cold-traps'
    ],
    description: 'Target exploration zone selected for rover volatile prospector campaigns. Scientific data confirms hydrogen enrichment within 1 meter of the regolith surface.'
  },
  {
    id: 'de-gerlache-rim-2',
    name: 'de Gerlache Rim 2',
    designation: 'NASA-ARTEMIS-SITE-04',
    lat: -88.5,
    lng: -88.3,
    elevation: '+3.4 km',
    illuminationPct: 84,
    icePotential: 'HIGH',
    slopeRisk: 'LOW (<8°)',
    thermalRange: '45 K to 275 K',
    artemisPriority: true,
    color: '#06b6d4',
    scienceObjectives: [
      'Investigate ancient impact melt sheets',
      'Survey micro-meteorite bombardment erosion',
      'Autonomous robotic habitat foundation preparation'
    ],
    description: 'Gentle terrain situated along the southern rim of de Gerlache. Excellent balance between persistent illumination and short traversing distances to deep shadowed cold-traps.'
  },
  {
    id: 'haworth-connecting-ridge',
    name: 'Haworth Plateau',
    designation: 'NASA-RECON-SITE-05',
    lat: -87.4,
    lng: -5.1,
    elevation: '+1.9 km',
    illuminationPct: 71,
    icePotential: 'VERY HIGH',
    slopeRisk: 'MODERATE (10-15°)',
    thermalRange: '30 K to 240 K',
    artemisPriority: false,
    color: '#f59e0b',
    scienceObjectives: [
      'Extreme cryo-sampling in ultra-deep cold trap (25 K)',
      'Solar wind ion implantation analysis'
    ],
    description: 'Bordering one of the coldest craters in the Solar System, where temperatures plunge to -415°F (-248°C), preserving primordial ice from billions of years ago.'
  },
  {
    id: 'oceanus-procellarum',
    name: 'Ocean of Storms (Apollo 12 Region)',
    designation: 'HISTORIC-BENCHMARK-06',
    lat: -3.01,
    lng: -23.42,
    elevation: '-1.4 km (Basaltic Mare Plain)',
    illuminationPct: 50,
    icePotential: 'LOW',
    slopeRisk: 'MINIMAL (<5°)',
    thermalRange: '100 K to 390 K',
    artemisPriority: false,
    color: '#e2b342',
    scienceObjectives: [
      'Comparative baseline against equatorial basaltic regolith',
      'Long-term hardware durability evaluation (Surveyor 3)'
    ],
    description: 'Vast volcanic maria region offering open flat landing terrain, serving as an equatorial geological benchmark compared to South Pole volatile regions.'
  }
];

export const PLANETS_DATA: PlanetData[] = [
  {
    name: 'Mercury',
    distance: 4.8,
    size: 1.2,
    rotationSpeed: 0.008,
    orbitalSpeed: 0.03,
    orbitRadius: 18,
    color: '#cbd5e1',
    secondaryColor: '#64748b',
    description: 'Sun-scorched, heavily cratered terrestrial world with a massive iron core and extreme day-night thermal swings.',
    stats: {
      diameter: '4,879 km',
      dayLength: '58.6 Earth days',
      temperature: '-180°C to +430°C',
      gravity: '3.7 m/s² (0.38g)'
    }
  },
  {
    name: 'Venus',
    distance: 7.2,
    size: 1.9,
    rotationSpeed: -0.004,
    orbitalSpeed: 0.02,
    orbitRadius: 28,
    color: '#fbbf24',
    secondaryColor: '#d97706',
    atmosphereColor: '#fef08a',
    description: 'Runaway greenhouse inferno blanketed by dense opaque sulfuric acid clouds and crushing atmospheric pressure.',
    stats: {
      diameter: '12,104 km',
      dayLength: '243 Earth days (retrograde)',
      temperature: '+465°C uniform',
      gravity: '8.87 m/s² (0.90g)'
    }
  },
  {
    name: 'Earth',
    distance: 10,
    size: 2.2,
    rotationSpeed: 0.012,
    orbitalSpeed: 0.015,
    orbitRadius: 40,
    color: '#3b82f6',
    secondaryColor: '#10b981',
    atmosphereColor: '#38bdf8',
    description: 'The dynamic cradle of human spaceflight, featuring oceans of liquid water, an active atmosphere, and our Moon.',
    stats: {
      diameter: '12,742 km',
      dayLength: '24.0 hours',
      temperature: '-88°C to +58°C',
      gravity: '9.81 m/s² (1.00g)'
    }
  },
  {
    name: 'Mars',
    distance: 15.2,
    size: 1.5,
    rotationSpeed: 0.011,
    orbitalSpeed: 0.012,
    orbitRadius: 54,
    color: '#ef4444',
    secondaryColor: '#b91c1c',
    atmosphereColor: '#fca5a5',
    description: 'The Red Planet, home to Olympus Mons and Valles Marineris, oxidized iron dust, and ancient dry riverbeds.',
    stats: {
      diameter: '6,779 km',
      dayLength: '24h 37m',
      temperature: '-140°C to +20°C',
      gravity: '3.72 m/s² (0.38g)'
    }
  },
  {
    name: 'Jupiter',
    distance: 22.0,
    size: 5.6,
    rotationSpeed: 0.025,
    orbitalSpeed: 0.007,
    orbitRadius: 72,
    color: '#f59e0b',
    secondaryColor: '#b45309',
    atmosphereColor: '#fed7aa',
    description: 'The reigning gas giant of the Solar System, boasting turbulent zonal bands and the centuries-old Great Red Spot.',
    stats: {
      diameter: '139,820 km',
      dayLength: '9h 55m',
      temperature: '-110°C cloud tops',
      gravity: '24.79 m/s² (2.53g)'
    }
  },
  {
    name: 'Saturn',
    distance: 30.0,
    size: 4.8,
    rotationSpeed: 0.022,
    orbitalSpeed: 0.005,
    orbitRadius: 94,
    color: '#fbbf24',
    secondaryColor: '#d97706',
    hasRings: true,
    atmosphereColor: '#fef08a',
    description: 'Majestic ringed world with a vast disk of billions of water ice fragments, moonlets, and atmospheric hex-storm.',
    stats: {
      diameter: '116,460 km',
      dayLength: '10h 33m',
      temperature: '-140°C',
      gravity: '10.44 m/s² (1.06g)'
    }
  },
  {
    name: 'Uranus',
    distance: 38.0,
    size: 3.4,
    rotationSpeed: -0.015,
    orbitalSpeed: 0.003,
    orbitRadius: 114,
    color: '#22d3ee',
    secondaryColor: '#0891b2',
    atmosphereColor: '#67e8f9',
    description: 'Tilted ice giant rolling on its side, saturated with methane that absorbs red light, giving a pale cyan luminescence.',
    stats: {
      diameter: '50,724 km',
      dayLength: '17h 14m (98° tilt)',
      temperature: '-195°C',
      gravity: '8.69 m/s² (0.89g)'
    }
  },
  {
    name: 'Neptune',
    distance: 46.0,
    size: 3.2,
    rotationSpeed: 0.016,
    orbitalSpeed: 0.002,
    orbitRadius: 134,
    color: '#3b82f6',
    secondaryColor: '#1d4ed8',
    atmosphereColor: '#60a5fa',
    description: 'The outermost ice giant, battered by supersonic supersonic winds exceeding 2,100 km/h and deep azure methane storms.',
    stats: {
      diameter: '49,244 km',
      dayLength: '16h 06m',
      temperature: '-201°C',
      gravity: '11.15 m/s² (1.14g)'
    }
  }
];
