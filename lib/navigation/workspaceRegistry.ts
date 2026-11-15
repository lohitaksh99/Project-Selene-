/**
 * Project Selene — Centralized 3-Level Navigation & Workspace Registry
 *
 * Level A: Global Top Navigation (8 destinations max):
 *   1. Explore (`explorer`)
 *   2. Lunar Bases (`lunar-bases`)
 *   3. Landing Sites (`site-analysis`, absorbs Overview)
 *   4. Mission Planner (`simulator`, absorbs Timeline)
 *   5. Comparison (`comparison`)
 *   6. Moon Trek GIS (`moon-trek`)
 *   7. Data & Science (`reports`)
 *   8. Flight Brief (drawer / settings & mission summary)
 *
 * Level B: Contextual Left Sidebar (renders ONLY tools/subsections for the active workspace)
 * Level C: Workspace Content + Resizable/Collapsible Inspector
 */

export type PrimaryWorkspaceId =
  | 'home'
  | 'explorer'
  | 'lunar-bases'
  | 'site-analysis'
  | 'simulator'
  | 'comparison'
  | 'moon-trek'
  | 'reports';

/**
 * Preserves backwards compatibility with all legacy `SeleneWorkspaceTab` identifiers
 * and URL hashes (`#overview`, `#timeline`, `#settings`).
 */
export type LegacyCompatibleTab =
  | PrimaryWorkspaceId
  | 'overview'
  | 'timeline'
  | 'settings';

export interface ContextualSubsectionDef {
  id: string;
  label: string;
  shortDesc: string;
  badge?: string;
}

export interface WorkspaceDefinition {
  id: PrimaryWorkspaceId;
  code: string;
  topNavLabel: string;
  title: string;
  groupLabel: string;
  hash: string;
  defaultSubsection: string;
  subsections: ContextualSubsectionDef[];
}

export const GLOBAL_TOP_NAV_ITEMS: {
  id: Exclude<PrimaryWorkspaceId, 'home'>;
  label: string;
  href: string;
}[] = [
  { id: 'explorer', label: 'Explore', href: '#explorer' },
  { id: 'lunar-bases', label: 'Lunar Bases', href: '#lunar-bases' },
  { id: 'site-analysis', label: 'Landing Sites', href: '#site-analysis' },
  { id: 'simulator', label: 'Mission Planner', href: '#simulator' },
  { id: 'comparison', label: 'Comparison', href: '#comparison' },
  { id: 'moon-trek', label: 'Moon Trek GIS', href: '#moon-trek' },
  { id: 'reports', label: 'Data & Science', href: '#reports' },
];

export const WORKSPACE_REGISTRY: Record<PrimaryWorkspaceId, WorkspaceDefinition> = {
  home: {
    id: 'home',
    code: '00',
    topNavLabel: 'Editorial Home',
    title: 'Editorial Home',
    groupLabel: 'PORTAL',
    hash: '#home',
    defaultSubsection: 'portal',
    subsections: [],
  },
  explorer: {
    id: 'explorer',
    code: '01',
    topNavLabel: 'Explore',
    title: 'Lunar Surface Explorer',
    groupLabel: 'MAP-FIRST EXPLORATION',
    hash: '#explorer',
    defaultSubsection: '3d-terrain',
    subsections: [
      { id: '3d-terrain', label: '3D Terrain Globe', shortDesc: 'Interactive south polar DEM & site pins' },
      { id: '2d-map', label: '2D Polar Projection', shortDesc: 'IAU2000:30120 stereographic map' },
      { id: 'horizon', label: '360° Horizon Panorama', shortDesc: 'Topographic rim & Sun/Earth clearance' },
      { id: 'catalog', label: 'Site Catalog & Custom Pin', shortDesc: 'Artemis, CLPS, Apollo & custom coords' },
    ],
  },
  'lunar-bases': {
    id: 'lunar-bases',
    code: '02',
    topNavLabel: 'Lunar Bases',
    title: 'Lunar Bases & Outposts',
    groupLabel: 'INFRASTRUCTURE SURVEY',
    hash: '#lunar-bases',
    defaultSubsection: 'map-overview',
    subsections: [
      { id: 'map-overview', label: 'Base Map & Projections', shortDesc: 'EQ / SP / NP interactive station atlas' },
      { id: 'stations', label: 'Verified Stations', shortDesc: 'Historical, confirmed & planned assets' },
      { id: 'infrastructure', label: 'Conceptual Outposts', shortDesc: 'Artemis base camp & relay architectures' },
    ],
  },
  'site-analysis': {
    id: 'site-analysis',
    code: '03',
    topNavLabel: 'Landing Sites',
    title: 'Landing Site Analysis',
    groupLabel: 'SITE PHYSICS & ASSESSMENT',
    hash: '#site-analysis',
    defaultSubsection: 'overview',
    subsections: [
      { id: 'overview', label: 'Site Overview', shortDesc: 'Telemetry briefing, countdown & summary' },
      { id: 'terrain', label: 'Terrain Analysis', shortDesc: 'LOLA DEM slopes, LDEC support & transects' },
      { id: 'illumination', label: 'Solar Illumination', shortDesc: '3-regime solar disk & seasonal profile' },
      { id: 'communications', label: 'Earth Communications', shortDesc: '3-stage Ka-band DTE link & libration' },
      { id: 'power', label: 'Power Systems', shortDesc: 'PV array sizing, battery SoC & deficits' },
      { id: 'science', label: 'Scientific Assessment', shortDesc: 'PSR proximity, volatiles & risk matrix' },
    ],
  },
  simulator: {
    id: 'simulator',
    code: '04',
    topNavLabel: 'Mission Planner',
    title: 'Mission Planner & Orbit Lab',
    groupLabel: 'ORBITAL & TIMELINE SIMULATION',
    hash: '#simulator',
    defaultSubsection: 'orbital',
    subsections: [
      { id: 'orbital', label: 'Orbital Visualization', shortDesc: 'Interactive Earth–Moon–Sun 3D rig' },
      { id: 'ephemeris', label: 'Ephemeris Explorer', shortDesc: 'DE441 & JPL Horizons live sync' },
      { id: 'frames', label: 'Reference Frames', shortDesc: 'ICRF, MOON_PA, MOON_ME & Topocentric ENU' },
      { id: 'vectors', label: 'Position & Velocity', shortDesc: 'Cartesian state vectors & Keplerian elements' },
      { id: 'timeline', label: 'Mission Timeline', shortDesc: 'Multi-day SPAC windows, events & SoC' },
    ],
  },
  comparison: {
    id: 'comparison',
    code: '05',
    topNavLabel: 'Comparison',
    title: 'Multi-Site Comparison Matrix',
    groupLabel: 'TRADE STUDY & MCDA',
    hash: '#comparison',
    defaultSubsection: 'matrix',
    subsections: [
      { id: 'matrix', label: 'Side-by-Side Matrix', shortDesc: 'Tabular illumination, comms & slope metrics' },
      { id: 'charts', label: 'Feasibility Charts', shortDesc: 'Multi-axis radar & power trade comparison' },
      { id: 'mcda', label: 'MCDA Weights', shortDesc: 'Calibrate SPAC, solar, comms & science weights' },
      { id: 'scenarios', label: 'Saved Scenarios', shortDesc: 'Create & compare custom landing epochs' },
    ],
  },
  'moon-trek': {
    id: 'moon-trek',
    code: '06',
    topNavLabel: 'Moon Trek GIS',
    title: 'NASA Moon Trek GIS Cartography',
    groupLabel: 'OGC WMTS & LROC WMS',
    hash: '#moon-trek',
    defaultSubsection: 'layers',
    subsections: [
      { id: 'layers', label: 'Layer Stack & Opacity', shortDesc: 'LROC WAC/NAC, LOLA LDEM, Diviner, LEND' },
      { id: 'presets', label: 'Survey Presets', shortDesc: 'Illumination, cryogenic, slope & full stack' },
      { id: 'profile', label: 'Elevation Transect', shortDesc: 'Cross-crater elevation & vertical error' },
    ],
  },
  reports: {
    id: 'reports',
    code: '07',
    topNavLabel: 'Data & Science',
    title: 'Data Hub & Scientific Provenance',
    groupLabel: 'DATASETS, API & EXPORTS',
    hash: '#reports',
    defaultSubsection: 'datasets',
    subsections: [
      { id: 'datasets', label: 'Dataset Explorer', shortDesc: 'Registered SQLite datasets & SHA-256 hashes' },
      { id: 'provenance', label: 'Data Provenance', shortDesc: 'Observed vs modeled vs estimated taxonomy' },
      { id: 'api-status', label: 'API Connection Status', shortDesc: 'Per-provider health, cache age & fallbacks' },
      { id: 'exports', label: 'Mission Exports', shortDesc: 'Export CSV telemetry, JSON & brief reports' },
    ],
  },
};

export interface ResolvedNavigationTarget {
  workspace: PrimaryWorkspaceId;
  subsection?: string;
  openFlightBrief?: boolean;
}

/**
 * Resolves any modern or legacy tab/hash identifier into the normalized
 * 3-level workspace + contextual subsection + Flight Brief drawer state.
 */
export function resolveNavigationTarget(rawInput: string): ResolvedNavigationTarget {
  const cleaned = rawInput.replace(/^#/, '').trim().toLowerCase();

  // Support compound hash format e.g. `#site-analysis/illumination`
  const [basePart, subPart] = cleaned.split('/');

  switch (basePart) {
    case '':
    case 'home':
      return { workspace: 'home' };
    case 'explore':
    case 'explorer':
      return {
        workspace: 'explorer',
        subsection: subPart || WORKSPACE_REGISTRY.explorer.defaultSubsection,
      };
    case 'lunar-bases':
      return {
        workspace: 'lunar-bases',
        subsection: subPart || WORKSPACE_REGISTRY['lunar-bases'].defaultSubsection,
      };
    case 'overview':
      return { workspace: 'site-analysis', subsection: 'overview' };
    case 'landing-sites':
    case 'site-analysis':
      return {
        workspace: 'site-analysis',
        subsection: subPart || WORKSPACE_REGISTRY['site-analysis'].defaultSubsection,
      };
    case 'timeline':
      return { workspace: 'simulator', subsection: 'timeline' };
    case 'mission-planner':
    case 'simulator':
      return {
        workspace: 'simulator',
        subsection: subPart || WORKSPACE_REGISTRY.simulator.defaultSubsection,
      };
    case 'comparison':
      return {
        workspace: 'comparison',
        subsection: subPart || WORKSPACE_REGISTRY.comparison.defaultSubsection,
      };
    case 'moon-trek':
      return {
        workspace: 'moon-trek',
        subsection: subPart || WORKSPACE_REGISTRY['moon-trek'].defaultSubsection,
      };
    case 'data-science':
    case 'reports':
      return {
        workspace: 'reports',
        subsection: subPart || WORKSPACE_REGISTRY.reports.defaultSubsection,
      };
    case 'settings':
    case 'about':
    case 'flight-brief':
      return {
        workspace: 'site-analysis',
        subsection: 'overview',
        openFlightBrief: true,
      };
    default:
      return { workspace: 'site-analysis', subsection: 'overview' };
  }
}

export function buildWorkspaceHash(
  workspace: PrimaryWorkspaceId,
  subsection?: string
): string {
  if (workspace === 'home') return '#home';
  const def = WORKSPACE_REGISTRY[workspace];
  if (!subsection || subsection === def.defaultSubsection) {
    return def.hash;
  }
  return `${def.hash}/${subsection}`;
}

// Per-workspace scroll memory so browser Back/Forward or tab returns feel continuous
const scrollPositionByWorkspace = new Map<string, number>();

export function saveWorkspaceScrollPosition(workspaceKey: string, scrollY: number): void {
  scrollPositionByWorkspace.set(workspaceKey, Math.max(0, scrollY));
}

export function getSavedWorkspaceScrollPosition(workspaceKey: string): number {
  return scrollPositionByWorkspace.get(workspaceKey) ?? 0;
}
