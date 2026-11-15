/**
 * Phase 5 & Phase 6 — Authoritative Lunar Bases, Surface Infrastructure & Historical Mission Catalog
 *
 * SCIENTIFIC INTEGRITY & CLASSIFICATION RULES:
 *   - No permanent operational human lunar base currently exists on the Moon.
 *   - Every location is strictly categorized into one of 6 verified scientific classifications:
 *       1. HISTORICAL_LANDING_SITE — Completed historical Apollo, Luna, Surveyor touchdowns (1966–1976)
 *       2. CONFIRMED_MISSION_SITE  — Confirmed modern robotic/commercial surface landings (2013–2025+)
 *       3. PLANNED_MISSION_TARGET  — Officially manifested upcoming robotic/crewed mission targets
 *       4. CANDIDATE_BASE_REGION   — NASA Artemis III /國際 Lunar Research Station (ILRS) candidate study regions
 *       5. PROPOSED_INFRASTRUCTURE — Agency/academic engineering proposals for power, comms, ISRU, or astronomy
 *       6. CONCEPTUAL_BASE_DESIGN  — Architectural & habitat engineering studies (explicitly marked conceptual)
 */

export type LunarLocationClassification =
  | 'HISTORICAL_LANDING_SITE'
  | 'CONFIRMED_MISSION_SITE'
  | 'PLANNED_MISSION_TARGET'
  | 'CANDIDATE_BASE_REGION'
  | 'PROPOSED_INFRASTRUCTURE'
  | 'CONCEPTUAL_BASE_DESIGN';

export type LunarRegionZone =
  | 'SOUTH_POLE'
  | 'EQUATORIAL_NEARSIDE'
  | 'MID_LATITUDE_NEARSIDE'
  | 'FARSIDE_SPA'
  | 'NORTH_POLE';

export interface LunarSurfaceLocationEntry {
  id: string;
  name: string;
  shortLabel: string;
  classification: LunarLocationClassification;
  classificationBadge: string;
  isConceptOrProposal: boolean;
  countryOrAgency:
    | 'NASA (USA)'
    | 'Commercial CLPS (USA)'
    | 'CNSA (China)'
    | 'ISRO (India)'
    | 'JAXA (Japan)'
    | 'ESA (Europe)'
    | 'USSR (Historical)'
    | 'International / Academic';
  missionOrProgram: string;
  dateOrWindow: string;
  regionZone: LunarRegionZone;
  latitude: number; // degrees [-90..+90], negative = South
  longitude: number; // degrees [-180..+180] East
  elevationKm: number; // relative to IAU 2000 R = 1737.4 km (LOLA LDEM)
  meanSlopeDeg: number;
  psrProximityKm: number;
  meanIlluminationPct: number;
  dteVisibilityPct: number;
  divinerTempRangeK: string;
  scientificSummary: string;
  engineeringAndHabitatContext: string;
  sourceAttribution: string;
  measurementProvenance: 'LRO_LOLA_NAC_MEASURED' | 'HORIZON_ILLUMINATION_MODEL' | 'CONCEPTUAL_ENGINEERING_STUDY';
  labelPriorityTier: 1 | 2 | 3; // 1 = Always try to show at low zoom, 2 = Medium zoom, 3 = High zoom / Hover
  linkedSeleneSiteId?: string;
}

export interface LunarNomenclatureFeature {
  id: string;
  name: string;
  featureType: 'MARE' | 'BASIN' | 'MONTES' | 'CRATER';
  latitude: number;
  longitude: number;
  diameterKm: number;
  priorityTier: 1 | 2 | 3;
}

export const CLASSIFICATION_META: Record<
  LunarLocationClassification,
  {
    label: string;
    shortTag: string;
    colorHex: string;
    symbolShape: 'circle' | 'diamond' | 'triangle' | 'square' | 'hexagon' | 'ring';
    description: string;
  }
> = {
  HISTORICAL_LANDING_SITE: {
    label: 'Historical Landing Site',
    shortTag: 'HISTORICAL',
    colorHex: '#10B981', // Emerald
    symbolShape: 'circle',
    description: 'Verified Apollo, Luna, and Surveyor spacecraft surface touchdowns (1966–1976) imaged by LROC NAC.',
  },
  CONFIRMED_MISSION_SITE: {
    label: 'Confirmed Modern Mission Site',
    shortTag: 'CONFIRMED',
    colorHex: '#38BDF8', // Cyan
    symbolShape: 'diamond',
    description: 'Confirmed 21st-century robotic and commercial CLPS surface landings with verified LROC coordinates.',
  },
  PLANNED_MISSION_TARGET: {
    label: 'Planned Mission Target',
    shortTag: 'PLANNED TARGET',
    colorHex: '#F4C542', // Solar Gold
    symbolShape: 'triangle',
    description: 'Manifested upcoming NASA CLPS, Artemis, CNSA, or international robotic/crewed landing targets.',
  },
  CANDIDATE_BASE_REGION: {
    label: 'Candidate Base Region',
    shortTag: 'CANDIDATE REGION',
    colorHex: '#D6C36A', // Warm Brass / Gold
    symbolShape: 'ring',
    description: 'Official NASA Artemis III / Base Camp & ILRS candidate regions under topographic and illumination study.',
  },
  PROPOSED_INFRASTRUCTURE: {
    label: 'Proposed Surface Infrastructure',
    shortTag: 'PROPOSED INFRA',
    colorHex: '#A855F7', // Violet
    symbolShape: 'square',
    description: 'Engineering proposals for solar array masts, DTE comms relays, ISRU plants, and farside radio telescopes (not yet built).',
  },
  CONCEPTUAL_BASE_DESIGN: {
    label: 'Conceptual Base Design Study',
    shortTag: 'CONCEPT DESIGN',
    colorHex: '#F97316', // Amber Orange
    symbolShape: 'hexagon',
    description: 'Architectural and systems engineering habitat studies (NASA Artemis Base Camp, ESA Moon Village). Conceptual only.',
  },
};

export const LUNAR_SURFACE_LOCATIONS: LunarSurfaceLocationEntry[] = [
  // ============================================================================
  // 1. CANDIDATE BASE REGIONS (ARTEMIS SOUTH POLAR & INTERNATIONAL)
  // ============================================================================
  {
    id: 'base-cand-shackleton-rim',
    name: 'Shackleton Crater Rim & Connecting Ridge',
    shortLabel: 'Shackleton Rim',
    classification: 'CANDIDATE_BASE_REGION',
    classificationBadge: 'NASA Artemis III / Base Camp Primary Candidate',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Artemis III & Artemis Base Camp Study',
    dateOrWindow: '2027–2032 Window',
    regionZone: 'SOUTH_POLE',
    latitude: -89.78,
    longitude: 120.45,
    elevationKm: 2.15,
    meanSlopeDeg: 5.8,
    psrProximityKm: 0.8,
    meanIlluminationPct: 85.4,
    dteVisibilityPct: 58.2,
    divinerTempRangeK: '38–112 K (Rim) / <40 K (Interior Floor)',
    scientificSummary:
      'Elevated ridge connecting Shackleton and de Gerlache craters within 0.25° of the South Pole. Receives >84% summer solar illumination while bordering Shackleton’s 4.2 km deep permanently shadowed interior.',
    engineeringAndHabitatContext:
      'Premier candidate location for vertical solar array masts and short-traverse (<1 km) rover access to cryogenic water-ice cold traps.',
    sourceAttribution: 'NASA Artemis III Candidate Regions (2022/2024); LRO LOLA LDEM_83S_5MPP_ADJ (Mazarico et al., 2011).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'shackleton-rim',
  },
  {
    id: 'base-cand-malapert-massif',
    name: 'Malapert Massif Summit Ridge',
    shortLabel: 'Malapert Massif',
    classification: 'CANDIDATE_BASE_REGION',
    classificationBadge: 'NASA Artemis III Candidate Region',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Artemis III / South Polar Telecommunications Node',
    dateOrWindow: '2027–2030 Window',
    regionZone: 'SOUTH_POLE',
    latitude: -84.9,
    longitude: 12.9,
    elevationKm: 4.85,
    meanSlopeDeg: 7.2,
    psrProximityKm: 3.4,
    meanIlluminationPct: 78.6,
    dteVisibilityPct: 94.8,
    divinerTempRangeK: '52–195 K',
    scientificSummary:
      'Commanding 4.85 km pre-Nectarian highland massif facing the sub-Earth meridian (0°E). Exposes ancient South Pole-Aitken basin rim crust.',
    engineeringAndHabitatContext:
      'Unobstructed line-of-sight to Earth for ~95% of the libration cycle makes Malapert Summit the highest-value Direct-to-Earth (DTE) relay and habitat candidate.',
    sourceAttribution: 'NASA Artemis III Candidate Regions; LROC NAC Mosaic 0.67 m/px Malapert Massif.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'malapert-massif',
  },
  {
    id: 'base-cand-nobile-rim-1',
    name: 'Nobile Crater Rim 1 (Western Highland Bench)',
    shortLabel: 'Nobile Rim 1',
    classification: 'CANDIDATE_BASE_REGION',
    classificationBadge: 'NASA Artemis III Candidate Region',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Artemis III / Volatile Prospecting Zone',
    dateOrWindow: '2027–2030 Window',
    regionZone: 'SOUTH_POLE',
    latitude: -85.2,
    longitude: 53.5,
    elevationKm: 1.65,
    meanSlopeDeg: 4.9,
    psrProximityKm: 1.2,
    meanIlluminationPct: 74.8,
    dteVisibilityPct: 84.5,
    divinerTempRangeK: '39–165 K',
    scientificSummary:
      'Broad, gently sloping (<5° mean) bench on the western rim of the 79.3 km Nobile impact structure with adjacent micro-cold-traps.',
    engineeringAndHabitatContext:
      'Low surface slopes and high bearing capacity favor heavy human class landers (HLS) and pressurized rover traverses.',
    sourceAttribution: 'NASA Artemis III Candidate Regions; PGDA LOLA LDEM_83S_10MPP_ADJ.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
    linkedSeleneSiteId: 'nobile-rim-1',
  },
  {
    id: 'base-cand-haworth-bench',
    name: 'Haworth Crater Southern Rim Bench',
    shortLabel: 'Haworth Rim',
    classification: 'CANDIDATE_BASE_REGION',
    classificationBadge: 'NASA Artemis III Candidate Region',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Artemis III Ultra-Cold Volatile Study Zone',
    dateOrWindow: '2027–2031 Window',
    regionZone: 'SOUTH_POLE',
    latitude: -87.4,
    longitude: -5.5,
    elevationKm: 0.85,
    meanSlopeDeg: 9.4,
    psrProximityKm: 0.5,
    meanIlluminationPct: 68.2,
    dteVisibilityPct: 72.0,
    divinerTempRangeK: '32–98 K (Floor < 40 K)',
    scientificSummary:
      'Polygonal 51.4 km crater containing one of the largest super-cold (<40 K) permanently shadowed floors at the South Pole.',
    engineeringAndHabitatContext:
      'Candidate cryogenic volatile extraction research zone; requires precision hazard avoidance due to steeper rim slopes (~9.4°).',
    sourceAttribution: 'NASA PGDA Haworth 5 m/px Adjusted LOLA DEM; Diviner DLRE T_bol Maps.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
    linkedSeleneSiteId: 'haworth-crater',
  },

  // ============================================================================
  // 2. PLANNED MISSION TARGETS (MANIFESTED UPCOMING MISSIONS)
  // ============================================================================
  {
    id: 'planned-mons-mouton-clps',
    name: 'Mons Mouton Plateau (CLPS Griffin / VIPER Zone)',
    shortLabel: 'Mons Mouton',
    classification: 'PLANNED_MISSION_TARGET',
    classificationBadge: 'Planned NASA CLPS / Artemis Target',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'NASA CLPS Task Order 20A (Astrobotic Griffin) & Artemis III',
    dateOrWindow: '2026–2027 Planned',
    regionZone: 'SOUTH_POLE',
    latitude: -84.6,
    longitude: 31.0,
    elevationKm: 5.1,
    meanSlopeDeg: 4.2,
    psrProximityKm: 1.1,
    meanIlluminationPct: 81.4,
    dteVisibilityPct: 92.8,
    divinerTempRangeK: '64–215 K',
    scientificSummary:
      'Flat-topped 5.1 km mountain plateau (~6,000 km² summit area) spanning four distinct thermal ice-stability depth regimes (dry, deep, shallow, surface).',
    engineeringAndHabitatContext:
      'Exceptionally flat summit (<4.5° median slope) with strong Direct-to-Earth visibility and prolonged summer solar windows.',
    sourceAttribution: 'NASA CLPS / VIPER Site Selection Dossier; LROC NAC Stereo DTM Mons Mouton (2 m/px).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'clps-viper-mons-mouton',
  },
  {
    id: 'planned-change-7-shackleton',
    name: 'Shackleton–de Gerlache Ridge (Chang’e-7 Target)',
    shortLabel: 'Chang’e-7 Target',
    classification: 'PLANNED_MISSION_TARGET',
    classificationBadge: 'Planned CNSA Polar Lander + Hopper Target',
    isConceptOrProposal: false,
    countryOrAgency: 'CNSA (China)',
    missionOrProgram: 'Chang’e-7 Lunar South Pole Exploration Mission',
    dateOrWindow: '2026 Planned',
    regionZone: 'SOUTH_POLE',
    latitude: -89.48,
    longitude: -137.5,
    elevationKm: 2.02,
    meanSlopeDeg: 5.5,
    psrProximityKm: 0.9,
    meanIlluminationPct: 83.8,
    dteVisibilityPct: 54.0,
    divinerTempRangeK: '40–118 K',
    scientificSummary:
      'Illuminated ridge crest between Shackleton and de Gerlache craters targeted for lander, rover, and mini-flying hopper PSR water-ice analysis (relayed via Queqiao-2).',
    engineeringAndHabitatContext:
      'Precursor site evaluation for the International Lunar Research Station (ILRS) South Polar node.',
    sourceAttribution: 'CNSA Chang’e-7 Mission Overview (Zhang et al., 2024); LOLA LDEM_85S.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },

  // ============================================================================
  // 3. CONFIRMED MODERN MISSION SITES (2013–2025)
  // ============================================================================
  {
    id: 'confirmed-im1-odysseus',
    name: 'Malapert A Highland Plain (IM-1 Odysseus)',
    shortLabel: 'IM-1 Odysseus',
    classification: 'CONFIRMED_MISSION_SITE',
    classificationBadge: 'Confirmed CLPS Landing (Feb 22, 2024)',
    isConceptOrProposal: false,
    countryOrAgency: 'Commercial CLPS (USA)',
    missionOrProgram: 'NASA CLPS TO2-IM / Intuitive Machines Nova-C Odysseus',
    dateOrWindow: 'Landed 2024-02-22',
    regionZone: 'SOUTH_POLE',
    latitude: -80.13,
    longitude: 1.44,
    elevationKm: 0.62,
    meanSlopeDeg: 11.2,
    psrProximityKm: 6.2,
    meanIlluminationPct: 54.0,
    dteVisibilityPct: 89.5,
    divinerTempRangeK: '78–235 K',
    scientificSummary:
      'First commercial soft lunar landing and southernmost landing on the Moon (80.13°S). Imaged by LROC NAC at -80.13°S, 1.44°E.',
    engineeringAndHabitatContext:
      'Demonstrated autonomous optical hazard relative navigation in heavily cratered southern polar highlands.',
    sourceAttribution: 'NASA / ASU LROC NAC Featured Image (Feb 26, 2024); Moon Trek 3.5 m/px Hillshade.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'clps-im1-malapert-a',
  },
  {
    id: 'confirmed-chandrayaan-3',
    name: 'Statio Shiv Shakti (Chandrayaan-3 Vikram & Pragyan)',
    shortLabel: 'Chandrayaan-3',
    classification: 'CONFIRMED_MISSION_SITE',
    classificationBadge: 'Confirmed ISRO Landing (Aug 23, 2023)',
    isConceptOrProposal: false,
    countryOrAgency: 'ISRO (India)',
    missionOrProgram: 'ISRO Chandrayaan-3 Lander (Vikram) & Rover (Pragyan)',
    dateOrWindow: 'Landed 2023-08-23',
    regionZone: 'SOUTH_POLE',
    latitude: -69.373,
    longitude: 32.319,
    elevationKm: 0.45,
    meanSlopeDeg: 5.5,
    psrProximityKm: 18.5,
    meanIlluminationPct: 51.2,
    dteVisibilityPct: 96.2,
    divinerTempRangeK: '85–255 K',
    scientificSummary:
      'First successful touchdown in the lunar southern high latitudes (-69.37°S). Executed ChaSTE topsoil thermal profiling and LIBS/APXS elemental analysis.',
    engineeringAndHabitatContext:
      'Measured steep thermal insulation gradient in upper 10 cm of regolith, critical for buried habitat thermal modeling.',
    sourceAttribution: 'IAU WGPSN Statio Shiv Shakti Gazetteer (2024); LROC NAC Coordinates.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'isro-chandrayaan3-shiv-shakti',
  },
  {
    id: 'confirmed-jaxa-slim',
    name: 'Shioli Crater Rim (JAXA SLIM Pinpoint Lander)',
    shortLabel: 'JAXA SLIM',
    classification: 'CONFIRMED_MISSION_SITE',
    classificationBadge: 'Confirmed Precision Landing (Jan 19, 2024)',
    isConceptOrProposal: false,
    countryOrAgency: 'JAXA (Japan)',
    missionOrProgram: 'JAXA Smart Lander for Investigating Moon (SLIM)',
    dateOrWindow: 'Landed 2024-01-19',
    regionZone: 'EQUATORIAL_NEARSIDE',
    latitude: -13.316,
    longitude: 25.251,
    elevationKm: -1.12,
    meanSlopeDeg: 14.5,
    psrProximityKm: 2210.0,
    meanIlluminationPct: 49.8,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '95–382 K',
    scientificSummary:
      'Achieved <55 m pinpoint landing accuracy on the ejecta slope of Shioli Crater near Mare Nectaris, conducting multi-band olivine spectroscopy.',
    engineeringAndHabitatContext:
      'Validated vision-based crater matching navigation required for landing beside South Polar ridge hazards.',
    sourceAttribution: 'JAXA / LROC NAC Observation M1460739214L (Jan 2024).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },
  {
    id: 'confirmed-change-4-von-karman',
    name: 'Statio Tianhe — Von Kármán Crater (Chang’e-4)',
    shortLabel: 'Chang’e-4 (Farside)',
    classification: 'CONFIRMED_MISSION_SITE',
    classificationBadge: 'Confirmed First Farside Landing (Jan 3, 2019)',
    isConceptOrProposal: false,
    countryOrAgency: 'CNSA (China)',
    missionOrProgram: 'CNSA Chang’e-4 Lander & Yutu-2 Rover (Queqiao Relay)',
    dateOrWindow: 'Landed 2019-01-03',
    regionZone: 'FARSIDE_SPA',
    latitude: -45.444,
    longitude: 177.599,
    elevationKm: -5.92,
    meanSlopeDeg: 2.6,
    psrProximityKm: 1320.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 0.0, // Farside requires L2 halo relay
    divinerTempRangeK: '82–374 K',
    scientificSummary:
      'First humanity landing on the lunar farside inside the 186 km Von Kármán crater within the South Pole-Aitken (SPA) basin.',
    engineeringAndHabitatContext:
      'Proved continuous Earth-Moon L2 relay architecture (Queqiao) for farside surface operations with 0% Direct-to-Earth visibility.',
    sourceAttribution: 'IAU WGPSN Statio Tianhe; LROC NAC M1303619844LR.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
  },
  {
    id: 'confirmed-change-6-apollo-basin',
    name: 'Apollo Basin Southern Mare (Chang’e-6 Farside Sample Return)',
    shortLabel: 'Chang’e-6 (SPA)',
    classification: 'CONFIRMED_MISSION_SITE',
    classificationBadge: 'Confirmed Farside Sample Return (June 2, 2024)',
    isConceptOrProposal: false,
    countryOrAgency: 'CNSA (China)',
    missionOrProgram: 'CNSA Chang’e-6 Farside Sample Return',
    dateOrWindow: 'Landed 2024-06-02',
    regionZone: 'FARSIDE_SPA',
    latitude: -41.638,
    longitude: -153.985,
    elevationKm: -5.26,
    meanSlopeDeg: 2.1,
    psrProximityKm: 1450.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 0.0,
    divinerTempRangeK: '84–378 K',
    scientificSummary:
      'Returned 1,935.3 g of lunar farside basalt and noritic ejecta from the southern mare floor of Apollo basin inside SPA.',
    engineeringAndHabitatContext:
      'Demonstrated autonomous farside robotic drilling, ascent, and lunar orbit rendezvous.',
    sourceAttribution: 'LROC NAC M1472036392R (June 2024); Li et al. (2024).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },

  // ============================================================================
  // 4. HISTORICAL LANDING SITES (APOLLO, LUNA, SURVEYOR)
  // ============================================================================
  {
    id: 'hist-apollo-11',
    name: 'Statio Tranquillitatis (Apollo 11 Eagle Lander)',
    shortLabel: 'Apollo 11',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'Historical Crewed Landing (July 20, 1969)',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Apollo 11 (Armstrong, Aldrin, Collins)',
    dateOrWindow: '1969-07-20',
    regionZone: 'EQUATORIAL_NEARSIDE',
    latitude: 0.6741,
    longitude: 23.473,
    elevationKm: -1.9,
    meanSlopeDeg: 1.8,
    psrProximityKm: 2680.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '98–392 K',
    scientificSummary:
      'First crewed lunar landing site in southern Mare Tranquillitatis. Returned 21.55 kg of high-titanium mare basalts (3.7 Ga) and deployed LRRR-11 laser retroreflector.',
    engineeringAndHabitatContext:
      'Protected historic heritage site (NASA Apollo Lunar Surface Artifacts guidelines); active geodetic laser ranging benchmark.',
    sourceAttribution: 'LROC NAC High-Res Apollo 11 Controlled Mosaic; Davies & Colvin (2000).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
    linkedSeleneSiteId: 'apollo-11-tranquility',
  },
  {
    id: 'hist-apollo-12-surveyor-3',
    name: 'Oceanus Procellarum — Statio Cognitum (Apollo 12 & Surveyor 3)',
    shortLabel: 'Apollo 12 / Surveyor 3',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'Historical Crewed Pinpoint Landing (Nov 19, 1969)',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Apollo 12 (Intrepid) & Surveyor 3 (1967)',
    dateOrWindow: '1969-11-19',
    regionZone: 'EQUATORIAL_NEARSIDE',
    latitude: -3.0124,
    longitude: -23.4216,
    elevationKm: -1.42,
    meanSlopeDeg: 2.1,
    psrProximityKm: 2590.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '96–390 K',
    scientificSummary:
      'Landed 163 m from Surveyor 3 inside Surveyor Crater, retrieving hardware exposed to the lunar vacuum for 31 months.',
    engineeringAndHabitatContext:
      'Primary long-duration materials degradation and micrometeorite/thermal cycling benchmark for lunar surface infrastructure.',
    sourceAttribution: 'LROC NAC M175428601L; Wagner et al. (2017) Icarus.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },
  {
    id: 'hist-apollo-15-hadley',
    name: 'Hadley–Apennine Valley (Apollo 15 Falcon & LRV-1)',
    shortLabel: 'Apollo 15',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'Historical Crewed J-Mission (July 30, 1971)',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Apollo 15 Extended Scientific J-Mission',
    dateOrWindow: '1971-07-30',
    regionZone: 'MID_LATITUDE_NEARSIDE',
    latitude: 26.1322,
    longitude: 3.6339,
    elevationKm: -1.85,
    meanSlopeDeg: 3.4,
    psrProximityKm: 1920.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '92–384 K',
    scientificSummary:
      'First Lunar Roving Vehicle (LRV) traverse between Mons Hadley Delta (4.0 km) and sinuous Hadley Rille lava channel.',
    engineeringAndHabitatContext:
      'Demonstrated 27.9 km wheeled electric mobility and deep core drilling in mixed mare/highland terrain.',
    sourceAttribution: 'LROC NAC Apollo 15 Traverse Map; Wagner et al. (2017).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },
  {
    id: 'hist-apollo-16-descartes',
    name: 'Descartes Highlands (Apollo 16 Orion)',
    shortLabel: 'Apollo 16',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'Historical Highland Crewed Landing (April 21, 1972)',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Apollo 16 Highland Geological Expedition',
    dateOrWindow: '1972-04-21',
    regionZone: 'EQUATORIAL_NEARSIDE',
    latitude: -8.973,
    longitude: 15.5002,
    elevationKm: 0.08,
    meanSlopeDeg: 4.5,
    psrProximityKm: 2450.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '94–388 K',
    scientificSummary:
      'Only Apollo landing in the ancient feldspathic lunar highlands (Cayley Plains / Descartes Formation), returning 95.7 kg of anorthositic breccias.',
    engineeringAndHabitatContext:
      'Geotechnical reference for highland regolith bearing strength and calcium-rich anorthosite ISRU feedstock.',
    sourceAttribution: 'LROC NAC Apollo 16 Controlled Mosaic; Wagner et al. (2017).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 2,
  },
  {
    id: 'hist-apollo-17-taurus-littrow',
    name: 'Taurus–Littrow Valley (Apollo 17 Challenger)',
    shortLabel: 'Apollo 17',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'Historical Crewed J-Mission (Dec 11, 1972)',
    isConceptOrProposal: false,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'Apollo 17 Final Crewed Apollo Expedition',
    dateOrWindow: '1972-12-11',
    regionZone: 'MID_LATITUDE_NEARSIDE',
    latitude: 20.1908,
    longitude: 30.7717,
    elevationKm: -2.55,
    meanSlopeDeg: 2.9,
    psrProximityKm: 2110.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '94–389 K',
    scientificSummary:
      'Deep graben valley on the southeastern rim of Mare Serenitatis. Discovered pyroclastic orange volcanic glass beads at Shorty Crater and completed 35.7 km LRV traverse.',
    engineeringAndHabitatContext:
      'Pyroclastic glass deposits at Taurus–Littrow are a primary benchmark for ilmenite/oxygen ISRU reduction yields.',
    sourceAttribution: 'LROC NAC M109080308LE; Wagner et al. (2017).',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 1,
  },
  {
    id: 'hist-luna-9-procellarum',
    name: 'Planitia Descensus (Luna 9 First Soft Landing)',
    shortLabel: 'Luna 9',
    classification: 'HISTORICAL_LANDING_SITE',
    classificationBadge: 'First Lunar Soft Landing (Feb 3, 1966)',
    isConceptOrProposal: false,
    countryOrAgency: 'USSR (Historical)',
    missionOrProgram: 'Soviet Luna 9 Surface Capsule',
    dateOrWindow: '1966-02-03',
    regionZone: 'EQUATORIAL_NEARSIDE',
    latitude: 7.08,
    longitude: -64.37,
    elevationKm: -1.65,
    meanSlopeDeg: 2.4,
    psrProximityKm: 2510.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 100.0,
    divinerTempRangeK: '95–389 K',
    scientificSummary:
      'First spacecraft to achieve a survivable soft landing on the Moon and transmit panoramic surface imagery, proving the regolith could support lander weight.',
    engineeringAndHabitatContext:
      'Foundational geotechnical proof that lunar regolith is not a deep dust sink.',
    sourceAttribution: 'IAU WGPSN Planitia Descensus.',
    measurementProvenance: 'LRO_LOLA_NAC_MEASURED',
    labelPriorityTier: 3,
  },

  // ============================================================================
  // 5. PROPOSED SURFACE INFRASTRUCTURE (ENGINEERING PROPOSALS — NOT YET BUILT)
  // ============================================================================
  {
    id: 'infra-prop-connecting-ridge-solar-farm',
    name: 'Connecting Ridge Vertical Solar Array Mast Field (Proposal)',
    shortLabel: 'Solar Mast Array (Proposed)',
    classification: 'PROPOSED_INFRASTRUCTURE',
    classificationBadge: 'PROPOSED INFRASTRUCTURE (Not Built)',
    isConceptOrProposal: true,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'NASA VSAT / Fission Surface Power & Polar Power Grid Study',
    dateOrWindow: 'Proposed 2028–2033 Architecture',
    regionZone: 'SOUTH_POLE',
    latitude: -89.68,
    longitude: -138.2,
    elevationKm: 2.18,
    meanSlopeDeg: 4.6,
    psrProximityKm: 0.7,
    meanIlluminationPct: 88.2,
    dteVisibilityPct: 56.5,
    divinerTempRangeK: '42–115 K',
    scientificSummary:
      'Proposed deployment of 10 m tall Vertical Solar Array Technology (VSAT) masts on Peak Near Shackleton / Connecting Ridge to capture grazing 0.5°–1.5° solar elevation.',
    engineeringAndHabitatContext:
      'PROPOSED ENGINEERING INFRASTRUCTURE: Combines 3×10 kWe vertical tracking solar arrays with a 40 kWe Fission Surface Power (FSP) unit and HVDC cable transmission to adjacent habitats.',
    sourceAttribution: 'NASA Lunar Surface Power Architecture Study; Mazarico et al. (2011) Illumination Peaks.',
    measurementProvenance: 'HORIZON_ILLUMINATION_MODEL',
    labelPriorityTier: 2,
  },
  {
    id: 'infra-prop-malapert-dte-relay',
    name: 'Malapert Peak Ka-Band / Optical DTE Relay Tower (Proposal)',
    shortLabel: 'Malapert Relay (Proposed)',
    classification: 'PROPOSED_INFRASTRUCTURE',
    classificationBadge: 'PROPOSED INFRASTRUCTURE (Not Built)',
    isConceptOrProposal: true,
    countryOrAgency: 'International / Academic',
    missionOrProgram: 'LunaNet / Moonlight South Polar Communications Relay Study',
    dateOrWindow: 'Proposed 2029–2034 Architecture',
    regionZone: 'SOUTH_POLE',
    latitude: -84.88,
    longitude: 12.85,
    elevationKm: 4.88,
    meanSlopeDeg: 6.8,
    psrProximityKm: 3.5,
    meanIlluminationPct: 79.2,
    dteVisibilityPct: 95.4,
    divinerTempRangeK: '54–192 K',
    scientificSummary:
      'Proposed high-elevation telecommunications relay mast atop Malapert Mountain providing continuous Ka-band and optical Earth link plus local S-band/LTE coverage down into Shackleton rim.',
    engineeringAndHabitatContext:
      'PROPOSED ENGINEERING INFRASTRUCTURE: Eliminates the ~14-day Earth libration communication blackouts experienced at 89.8°S sites without relying solely on orbital relays.',
    sourceAttribution: 'NASA / ESA LunaNet Interoperability Specification & Malapert Line-of-Sight Studies.',
    measurementProvenance: 'HORIZON_ILLUMINATION_MODEL',
    labelPriorityTier: 3,
  },
  {
    id: 'infra-prop-lcrt-farside',
    name: 'Lunar Crater Radio Telescope (LCRT) Farside Observatory (Proposal)',
    shortLabel: 'LCRT Radio Dish (Proposed)',
    classification: 'PROPOSED_INFRASTRUCTURE',
    classificationBadge: 'NASA NIAC Concept Study (Not Built)',
    isConceptOrProposal: true,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'NASA NIAC Phase II Lunar Crater Radio Telescope Study (JPL)',
    dateOrWindow: 'Proposed 2032+ Concept',
    regionZone: 'FARSIDE_SPA',
    latitude: 21.8,
    longitude: -174.6,
    elevationKm: 1.15,
    meanSlopeDeg: 8.5,
    psrProximityKm: 2050.0,
    meanIlluminationPct: 50.0,
    dteVisibilityPct: 0.0,
    divinerTempRangeK: '88–380 K',
    scientificSummary:
      'Proposed 350 m–1 km wire-mesh ultra-long-wavelength (10–50 m, 6–30 MHz) radio telescope suspended inside a 1.3 km farside bowl crater by DuAxel climbing rovers.',
    engineeringAndHabitatContext:
      'PROPOSED CONCEPTUAL INFRASTRUCTURE: Uses the Moon’s farside crustal bulk to completely shield terrestrial RFI and ionospheric reflection to observe the Cosmic Dark Ages.',
    sourceAttribution: 'Bandyopadhyay et al. (2021) JPL NIAC Phase II LCRT Study.',
    measurementProvenance: 'CONCEPTUAL_ENGINEERING_STUDY',
    labelPriorityTier: 2,
  },

  // ============================================================================
  // 6. CONCEPTUAL BASE DESIGNS (ARCHITECTURAL STUDIES — NOT OPERATIONAL)
  // ============================================================================
  {
    id: 'concept-artemis-base-camp-shackleton',
    name: 'NASA Artemis Base Camp Surface Habitat Architecture (Concept Study)',
    shortLabel: 'Artemis Base Camp (Concept)',
    classification: 'CONCEPTUAL_BASE_DESIGN',
    classificationBadge: 'CONCEPTUAL ENGINEERING DESIGN (Not Built)',
    isConceptOrProposal: true,
    countryOrAgency: 'NASA (USA)',
    missionOrProgram: 'NASA Moon to Mars Architecture — Artemis Base Camp Concept',
    dateOrWindow: '2030s Conceptual Reference Design',
    regionZone: 'SOUTH_POLE',
    latitude: -89.74,
    longitude: 118.5,
    elevationKm: 2.12,
    meanSlopeDeg: 5.2,
    psrProximityKm: 0.85,
    meanIlluminationPct: 84.8,
    dteVisibilityPct: 58.0,
    divinerTempRangeK: '39–114 K',
    scientificSummary:
      'NASA reference architectural study comprising a fixed Surface Habitat (SH) for 4 crew (30–60 day stays), a Pressurized Rover (PR), an unpressurized LTV, and an ISRU pilot demonstration plant.',
    engineeringAndHabitatContext:
      'CONCEPTUAL DESIGN ONLY (Not an operational facility): Evaluates radiation shielding via regolith berms/water walls, dust-mitigation airlocks, and closed-loop ECLSS near Shackleton Rim.',
    sourceAttribution: 'NASA Plan for Sustained Lunar Exploration and Development (2020/2024 Architecture Definition Document).',
    measurementProvenance: 'CONCEPTUAL_ENGINEERING_STUDY',
    labelPriorityTier: 2,
  },
  {
    id: 'concept-esa-moon-village-de-gerlache',
    name: 'ESA Regolith-3D-Printed Inflatable Habitat Study (de Gerlache Rim)',
    shortLabel: 'ESA Habitat Concept',
    classification: 'CONCEPTUAL_BASE_DESIGN',
    classificationBadge: 'CONCEPTUAL ARCHITECTURAL STUDY (Not Built)',
    isConceptOrProposal: true,
    countryOrAgency: 'ESA (Europe)',
    missionOrProgram: 'ESA Discovery / Foster + Partners Regolith Additive Manufacturing Study',
    dateOrWindow: '2030s Conceptual Study',
    regionZone: 'SOUTH_POLE',
    latitude: -88.72,
    longitude: -68.4,
    elevationKm: 1.95,
    meanSlopeDeg: 6.1,
    psrProximityKm: 1.0,
    meanIlluminationPct: 80.5,
    dteVisibilityPct: 62.4,
    divinerTempRangeK: '41–122 K',
    scientificSummary:
      'Conceptual habitat architecture on the illuminated rim of de Gerlache crater utilizing a deployable pneumatic core covered by a 1.5 m cellular sintered regolith shell.',
    engineeringAndHabitatContext:
      'CONCEPTUAL DESIGN ONLY (Not an operational facility): Designed to attenuate Galactic Cosmic Rays (GCR), Solar Particle Events (SPE), and primary micrometeoroid impacts using local regolith.',
    sourceAttribution: 'ESA / Ceccarini et al. Lunar Outpost Additive Manufacturing Study.',
    measurementProvenance: 'CONCEPTUAL_ENGINEERING_STUDY',
    labelPriorityTier: 3,
  },
];

/**
 * Authoritative IAU Lunar Nomenclature (Major Maria, Basins, Mountain Ranges & Polar Craters)
 * with zoom-priority tiers for collision-free 2D Map rendering (Part 4).
 */
export const LUNAR_GEOGRAPHIC_NOMENCLATURE: LunarNomenclatureFeature[] = [
  // Tier 1: Major Global Maria & Basins (visible at low zoom 1x+)
  { id: 'nom-procellarum', name: 'Oceanus Procellarum', featureType: 'MARE', latitude: 18.4, longitude: -57.4, diameterKm: 2592, priorityTier: 1 },
  { id: 'nom-imbrium', name: 'Mare Imbrium', featureType: 'MARE', latitude: 34.7, longitude: -14.9, diameterKm: 1145, priorityTier: 1 },
  { id: 'nom-serenitatis', name: 'Mare Serenitatis', featureType: 'MARE', latitude: 27.3, longitude: 18.4, diameterKm: 674, priorityTier: 1 },
  { id: 'nom-tranquillitatis', name: 'Mare Tranquillitatis', featureType: 'MARE', latitude: 8.3, longitude: 30.8, diameterKm: 875, priorityTier: 1 },
  { id: 'nom-crisium', name: 'Mare Crisium', featureType: 'MARE', latitude: 16.2, longitude: 59.1, diameterKm: 555, priorityTier: 1 },
  { id: 'nom-spa', name: 'South Pole–Aitken Basin', featureType: 'BASIN', latitude: -53.0, longitude: -169.0, diameterKm: 2500, priorityTier: 1 },

  // Tier 2: Secondary Maria, Mountains & Major Craters (visible at medium zoom 1.8x+)
  { id: 'nom-fecunditatis', name: 'Mare Fecunditatis', featureType: 'MARE', latitude: -7.8, longitude: 53.7, diameterKm: 840, priorityTier: 2 },
  { id: 'nom-nubium', name: 'Mare Nubium', featureType: 'MARE', latitude: -21.3, longitude: -16.6, diameterKm: 714, priorityTier: 2 },
  { id: 'nom-humorum', name: 'Mare Humorum', featureType: 'MARE', latitude: -24.4, longitude: -38.6, diameterKm: 419, priorityTier: 2 },
  { id: 'nom-frigoris', name: 'Mare Frigoris', featureType: 'MARE', latitude: 56.0, longitude: 1.4, diameterKm: 1446, priorityTier: 2 },
  { id: 'nom-apenninus', name: 'Montes Apenninus', featureType: 'MONTES', latitude: 19.9, longitude: -3.7, diameterKm: 600, priorityTier: 2 },
  { id: 'nom-tycho', name: 'Tycho Crater', featureType: 'CRATER', latitude: -43.3, longitude: -11.4, diameterKm: 85, priorityTier: 2 },
  { id: 'nom-copernicus', name: 'Copernicus Crater', featureType: 'CRATER', latitude: 9.6, longitude: -20.0, diameterKm: 96, priorityTier: 2 },

  // Tier 3: Polar Craters & Detailed Features (visible at higher zoom 2.6x+ or in Polar view)
  { id: 'nom-shackleton', name: 'Shackleton Crater', featureType: 'CRATER', latitude: -89.67, longitude: 129.78, diameterKm: 21, priorityTier: 2 },
  { id: 'nom-shoemaker', name: 'Shoemaker Crater', featureType: 'CRATER', latitude: -88.14, longitude: 45.91, diameterKm: 51.8, priorityTier: 3 },
  { id: 'nom-faustini', name: 'Faustini Crater', featureType: 'CRATER', latitude: -87.18, longitude: 84.31, diameterKm: 42.5, priorityTier: 3 },
  { id: 'nom-cabeus', name: 'Cabeus Crater (LCROSS)', featureType: 'CRATER', latitude: -85.33, longitude: -42.13, diameterKm: 100.6, priorityTier: 3 },
  { id: 'nom-peary', name: 'Peary Crater (North Pole)', featureType: 'CRATER', latitude: 88.6, longitude: 24.4, diameterKm: 78.7, priorityTier: 3 },
];

export const LUNAR_BASES_CATALOG = LUNAR_SURFACE_LOCATIONS;

export function summarizeLunarBasesCatalog() {
  const byClassification: Record<LunarLocationClassification, number> = {
    HISTORICAL_LANDING_SITE: 0,
    CONFIRMED_MISSION_SITE: 0,
    PLANNED_MISSION_TARGET: 0,
    CANDIDATE_BASE_REGION: 0,
    PROPOSED_INFRASTRUCTURE: 0,
    CONCEPTUAL_BASE_DESIGN: 0,
  };
  for (const loc of LUNAR_SURFACE_LOCATIONS) {
    byClassification[loc.classification] = (byClassification[loc.classification] || 0) + 1;
  }
  return {
    totalLocations: LUNAR_SURFACE_LOCATIONS.length,
    totalNomenclatureFeatures: LUNAR_GEOGRAPHIC_NOMENCLATURE.length,
    byClassification,
  };
}

