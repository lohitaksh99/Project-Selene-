export interface IntroLandingSite {
  id: string;
  seleneDbId?: string;
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
  | 'deep_space'
  | 'earth_reveal'
  | 'lunar_approach'
  | 'lunar_surface'
  | 'site_targeting'
  | 'hero_active';

export type ChallengeId = 'terrain' | 'sunlight' | 'earth_vis' | 'comms' | 'safety';

export const INTRO_CANDIDATE_SITES: IntroLandingSite[] = [
  {
    id: 'shackleton-connecting-ridge',
    seleneDbId: 'shackleton-rim',
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
      'Direct line-of-sight optical comms with Earth',
    ],
    description:
      'Premier candidate for Artemis III crewed touchdown. The ridge between Shackleton and de Gerlache craters receives continuous solar power for 86%+ of the lunar year, while adjacent craters harbor massive water ice deposits in eternal shadow.',
  },
  {
    id: 'malapert-mountain',
    seleneDbId: 'malapert-massif',
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
      'Continuous Earth telemetry relay outpost',
    ],
    description:
      'A 5,000-meter promontory providing an unobstructed line-of-sight to Earth for uninterruptible direct communications. Smooth flat plateaus at the peak provide ideal hazard-free landing zones.',
  },
  {
    id: 'nobile-rim-1',
    seleneDbId: 'nobile-rim-1',
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
      'Characterize regolith grain distribution at cold-traps',
    ],
    description:
      'Target exploration zone selected for rover volatile prospector campaigns. Scientific data confirms hydrogen enrichment within 1 meter of the regolith surface.',
  },
  {
    id: 'de-gerlache-rim-2',
    seleneDbId: 'shackleton-rim',
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
      'Autonomous robotic habitat foundation preparation',
    ],
    description:
      'Gentle terrain situated along the southern rim of de Gerlache. Excellent balance between persistent illumination and short traversing distances to deep shadowed cold-traps.',
  },
  {
    id: 'haworth-connecting-ridge',
    seleneDbId: 'haworth-crater',
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
      'Solar wind ion implantation analysis',
    ],
    description:
      'Bordering one of the coldest craters in the Solar System, where temperatures plunge to -415°F (-248°C), preserving primordial ice from billions of years ago.',
  },
  {
    id: 'oceanus-procellarum',
    seleneDbId: 'apollo-11-tranquility',
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
      'Long-term hardware durability evaluation (Surveyor 3)',
    ],
    description:
      'Vast volcanic maria region offering open flat landing terrain, serving as an equatorial geological benchmark compared to South Pole volatile regions.',
  },
];

export const INTRO_TEXTURES_PRELOAD = [
  '/textures/planets/moon_1024.jpg',
  '/textures/planets/moonbump1k.jpg',
  '/textures/planets/earth_atmos_2048.jpg',
  '/textures/planets/earthcloudmap.jpg',
] as const;
