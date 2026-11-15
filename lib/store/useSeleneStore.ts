'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  DecoupledPhysicalState,
  EngineeringConstraints,
  HorizonMaskSample,
} from '../astrodynamics/coordinateFrames';
import { EphemerisProviderMode, ApiWarning } from '../astrodynamics/jplHorizonsProvider';
import {
  DEFAULT_MCDA_WEIGHTS,
  McdaConstraintWeights,
  MissionTimelineAnalysis,
} from '../astrodynamics/missionAnalyzer';
import { EphemerisStateVector } from '../astrodynamics/offlineCalibratedProvider';
import {
  LunarPhaseInfo,
  TimeScaleRepresentation,
  etToUtc,
  utcToEt,
} from '../astrodynamics/timeScales';
import {
  DEFAULT_LANDER_SLOPE_THRESHOLDS,
  LanderSlopeThresholds,
} from '../terrain/lolaTerrainEngine';
import {
  WORKSPACE_REGISTRY,
  buildWorkspaceHash,
  resolveNavigationTarget,
  type PrimaryWorkspaceId,
} from '../navigation/workspaceRegistry';
import { transitionWorkspaceLifecycle } from '../lifecycle/workspaceLifecycle';
import type {
  DatasetRecord,
  LandingSiteRecord,
  ScenarioRecord,
} from '@/server/db/database';

export type SeleneWorkspaceTab =
  | 'home'
  | 'overview'
  | 'explorer'
  | 'lunar-bases'
  | 'site-analysis'
  | 'simulator'
  | 'comparison'
  | 'timeline'
  | 'moon-trek'
  | 'reports'
  | 'settings';

export type SeleneThemePreference = 'system' | 'light' | 'dark';

export type LunarShaderMode =
  | 'albedo'
  | 'lola'
  | 'illumination'
  | 'volatiles'
  | 'slope'
  | 'uncertainty';

export type MoonTrekCategory =
  | 'All'
  | 'Elevation'
  | 'Imagery'
  | 'Illumination'
  | 'Volatile Science'
  | 'Crater Maps';

export type MissionPlaybackSpeed = 1 | 10 | 60 | 360;

export interface MoonTrekGisLayer {
  id: string;
  name: string;
  shortCode: string;
  category: Exclude<MoonTrekCategory, 'All'>;
  visible: boolean;
  opacity: number; // 0..100
  description: string;
  datasetSource: string;
  pgdaProductCode?: string;
  geodeticControlWarning?: string;
  colorSwatch: string;
  legendMin: string;
  legendMax: string;
}

export interface SpatialCrossHighlightPoint {
  latDeg: number;
  lonDeg: number;
  elevationM?: number;
  slopeDeg?: number;
  ldecCount?: number;
  verticalUncertaintyM?: number;
  confidenceTier?: 1 | 2 | 3 | 4 | 5;
  label?: string;
}

export interface InstantTelemetrySnapshot {
  site: LandingSiteRecord;
  time_scales: TimeScaleRepresentation;
  lunar_phase: LunarPhaseInfo;
  ephemeris: EphemerisStateVector;
  physical_state: DecoupledPhysicalState;
  horizon_profile: HorizonMaskSample[];
}

export const INITIAL_MOON_TREK_LAYERS: MoonTrekGisLayer[] = [
  {
    id: 'lroc-wac-mosaic',
    name: 'LROC WAC South Polar Regional Mosaic (100 m/px)',
    shortCode: 'WAC-100M',
    category: 'Imagery',
    visible: true,
    opacity: 100,
    description:
      '100 m/px Wide Angle Camera optical albedo basemap across 60°S–90°S (shadows baked from acquisition epoch).',
    datasetSource: 'NASA / ASU LROC WAC_GLOBAL_P900S0000_100M',
    pgdaProductCode: 'WAC_GLOBAL_P900S0000_100M.TIF',
    colorSwatch: '#A3A3A3',
    legendMin: '0.04 I/F',
    legendMax: '0.28 I/F',
  },
  {
    id: 'lroc-nac-controlled',
    name: 'LROC NAC Geodetically Controlled Polar ROI (1 m/px)',
    shortCode: 'NAC-CTRL',
    category: 'Imagery',
    visible: false,
    opacity: 90,
    description:
      'High-resolution Narrow Angle Camera mosaic controlled to LOLA LDEM (MOON_ME DE421) within ±2–10 m horizontal error.',
    datasetSource: 'LROC NAC_POLE_SOUTH_CONTROLLED_MOSAIC',
    pgdaProductCode: 'NAC_POLE_SOUTH_CONTROLLED_MOSAIC.TIF',
    colorSwatch: '#E9E6DE',
    legendMin: '1.0 m/px',
    legendMax: 'Controlled ±5m',
  },
  {
    id: 'lroc-nac-uncontrolled',
    name: 'LROC NAC Uncontrolled PSR Long-Exposure Strips',
    shortCode: 'NAC-UNCTRL',
    category: 'Imagery',
    visible: false,
    opacity: 75,
    description:
      'Secondary-illumination NAC summing-mode strips revealing crater floor morphology inside permanent shadow.',
    datasetSource: 'PDS LROC M*LE/RE_PSR_SUMMING',
    pgdaProductCode: 'M119824912LE_PSR_SUMMING.IMG',
    geodeticControlWarning:
      'UNCONTROLLED SLEW GEOMETRY: Exhibits 10–50+ m horizontal offset relative to LOLA LDEM contours.',
    colorSwatch: '#F59E0B',
    legendMin: 'Slew Pointed',
    legendMax: '±50m Offset',
  },
  {
    id: 'lola-dem-hypsometric',
    name: 'LOLA Gridded Digital Elevation Model (LDEM)',
    shortCode: 'LDEM-ADJ',
    category: 'Elevation',
    visible: true,
    opacity: 78,
    description:
      'Orbit-adjusted surface-interpolated laser altimetry elevation (5–20 m/px relative to R_0 = 1737.4 km in MOON_ME DE421).',
    datasetSource: 'NASA GSFC PGDA LDEM_83S_10MPP_ADJ',
    pgdaProductCode: 'LDEM_83S_10MPP_ADJ.TIF',
    colorSwatch: '#00E5FF',
    legendMin: '-4.2 km',
    legendMax: '+5.1 km',
  },
  {
    id: 'lola-slope-hazard',
    name: 'LOLA Topographic Slope Screening Map (LDSM)',
    shortCode: 'LDSM-SLOPE',
    category: 'Elevation',
    visible: false,
    opacity: 75,
    description:
      '3x3 Horn gradient slope derived from LDEM; highlights configurable safe, caution, and steep crater wall screening zones.',
    datasetSource: 'NASA GSFC PGDA LDEM_83S_10MPP_ADJ_SLOPE',
    pgdaProductCode: 'LDEM_83S_10MPP_ADJ_SLOPE.TIF',
    colorSwatch: '#EF4444',
    legendMin: '0° Flat',
    legendMax: '>25° Scarp',
  },
  {
    id: 'lola-ldec-uncertainty',
    name: 'LOLA Measurement Support (LDEC) & Error (ADJ_ERR)',
    shortCode: 'LDEC-ERR',
    category: 'Elevation',
    visible: false,
    opacity: 70,
    description:
      'Visualizes Float32 altimeter spot count support (LDEC > 0 vs LDEC = 0 gap-interpolated cells) and 1-sigma vertical RMS error.',
    datasetSource: 'NASA GSFC PGDA LDEC_83S & ADJ_ERR',
    pgdaProductCode: 'LDEC_83S_10MPP_ADJ.TIF',
    colorSwatch: '#10B981',
    legendMin: 'LDEC = 0 (Interp)',
    legendMax: 'LDEC > 5 (Meas)',
  },
  {
    id: 'psr-cold-traps',
    name: 'Geometric Permanently Shadowed Regions (LPSR)',
    shortCode: 'LPSR-MASK',
    category: 'Illumination',
    visible: true,
    opacity: 85,
    description:
      'Topographic basins receiving zero direct solar disk illumination over the 18.6-year lunar nodal precession cycle.',
    datasetSource: 'NASA GSFC PGDA LPSR_85S_60M_201608',
    pgdaProductCode: 'LPSR_85S_60M_201608.JP2',
    colorSwatch: '#6366F1',
    legendMin: '0% Direct Sun',
    legendMax: 'Rim Crest',
  },
  {
    id: 'diviner-bolometric-temp',
    name: 'Diviner Thermal Stability Regime (T_bol)',
    shortCode: 'DIV-TBOL',
    category: 'Volatile Science',
    visible: false,
    opacity: 68,
    description:
      'Bolometric surface temperature mapping <110 K water-ice sublimation stability and <40 K super-cold volatile traps (thermal condition, not direct ice proof).',
    datasetSource: 'UCLA Diviner DLRE_SOUTH_POLE_TBOL',
    pgdaProductCode: 'DLRE_SOUTH_POLE_TBOL_MAX.TIF',
    colorSwatch: '#A855F7',
    legendMin: '29 K (-244°C)',
    legendMax: '295 K (+22°C)',
  },
  {
    id: 'lcross-lend-ice',
    name: 'LEND Epithermal Neutron Hydrogen & LCROSS Plume',
    shortCode: 'LEND-WEH',
    category: 'Volatile Science',
    visible: true,
    opacity: 65,
    description:
      'Regional bulk hydrogen (wt% WEH in top ~1 m regolith at ~10 km footprint) plus the direct LCROSS impact plume point confirmation in Cabeus.',
    datasetSource: 'LRO LEND (~10 km FWHM) & LCROSS Cabeus',
    pgdaProductCode: 'LEND_SOUTH_POLE_WEH / LCROSS_20091009',
    geodeticControlWarning:
      'COARSE FOOTPRINT CAVEAT: LEND neutron suppression has a ~10 km spatial footprint and measures bulk H (cannot resolve 100m rims or distinguish H2O from OH).',
    colorSwatch: '#38BDF8',
    legendMin: '0.1 wt% WEH',
    legendMax: '5.6 wt% (LCROSS)',
  },
  {
    id: 'grail-bouguer-gravity',
    name: 'GRAIL Bouguer Gravity & IAU Crater Catalog',
    shortCode: 'GRAIL-CRAT',
    category: 'Crater Maps',
    visible: false,
    opacity: 60,
    description:
      'Subsurface crustal density anomalies (-350 to +450 mGal) and authoritative IAU South Polar crater rim nomenclature.',
    datasetSource: 'NASA / MIT GRAIL JGGRX_1500E & IAU WGPSN',
    pgdaProductCode: 'JGGRX_1500E_BOUGUER.TIF',
    colorSwatch: '#D6C36A',
    legendMin: '-350 mGal',
    legendMax: '+450 mGal',
  },
];

const INITIAL_EPOCH_UTC = '2027-02-04T20:39:00.181Z';
const INITIAL_START_UTC = '2027-02-01T00:00:00Z';

const DEFAULT_CONSTRAINTS: EngineeringConstraints = {
  minSolarElevationDeg: 0.2,
  minEarthElevationDeg: 1.0,
  requiredContinuousHours: 120,
  solarArrayAreaM2: 18.0,
  pvEfficiency: 0.32,
  solarPanelOrientation: 'VERTICAL_MAST',
  maxSlopeDeg: 7.0,
  slopeCautionMaxDeg: 15.0,
  batteryCapacityKwh: 18.0,
  housekeepingLoadKw: 0.35,
  dsnStationId: 'DSS-24_GOLDSTONE_34M',
  dataRateMbps: 20.0,
};

const safeMemoryStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Ignore storage errors
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore storage errors
    }
  },
};

export interface SeleneStoreState {
  // 1. Navigation Domain
  activeTab: SeleneWorkspaceTab;
  activeSubsection: Record<PrimaryWorkspaceId, string>;
  flightBriefOpen: boolean;
  setActiveTab: (tab: SeleneWorkspaceTab | string) => void;
  setActiveSubsection: (workspace: PrimaryWorkspaceId, subsection: string) => void;
  navigateTo: (
    rawTarget: string,
    options?: { updateHash?: boolean; pushHistory?: boolean }
  ) => void;
  setFlightBriefOpen: (open: boolean) => void;

  // 2. UI Preferences & Persistent Layout Domain
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  themePreference: SeleneThemePreference;
  setThemePreference: (pref: SeleneThemePreference) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (collapsed: boolean) => void;
  inspectorWidthPx: number;
  setInspectorWidthPx: (widthPx: number) => void;
  fullscreenViewport: boolean;
  setFullscreenViewport: (fs: boolean) => void;
  expandedPanels: Record<string, boolean>;
  setPanelExpanded: (panelId: string, expanded: boolean) => void;
  isEduMode: boolean;
  setIsEduMode: (val: boolean) => void;
  resetLayoutPreferences: () => void;

  // 3. Mission Configuration & Site Catalog Domain
  sites: LandingSiteRecord[];
  setSites: (sites: LandingSiteRecord[]) => void;
  activeSiteId: string;
  setActiveSiteId: (siteId: string) => void;
  scenarios: ScenarioRecord[];
  setScenarios: (scenarios: ScenarioRecord[]) => void;
  selectedComparisonIds: string[];
  setSelectedComparisonIds: (ids: string[]) => void;
  savedComparisonSiteIds: string[];
  toggleSavedComparisonSite: (siteId: string) => void;
  datasets: DatasetRecord[];
  setDatasets: (datasets: DatasetRecord[]) => void;
  landerSlopeThresholds: LanderSlopeThresholds;
  setLanderSlopeThresholds: (partial: Partial<LanderSlopeThresholds>) => void;
  constraints: EngineeringConstraints;
  setConstraints: (partial: Partial<EngineeringConstraints>) => void;
  mcdaWeights: McdaConstraintWeights;
  setMcdaWeights: (partial: Partial<McdaConstraintWeights>) => void;

  // 4. Ephemeris & Mission Timeline Domain
  simulationEpochET: number;
  simulationStartET: number;
  simulationEndET: number;
  simulationEpochUtc: string;
  setSimulationEpochET: (etSeconds: number) => void;
  setSimulationEpochUtc: (utcIso: string) => void;
  missionStartDateUtc: string;
  setMissionStartDateUtc: (utcIso: string) => void;
  missionDurationDays: number;
  setMissionDurationDays: (days: number) => void;
  samplingStepHours: number | 'AUTO';
  setSamplingStepHours: (step: number | 'AUTO') => void;
  isPlayingMissionClock: boolean;
  setIsPlayingMissionClock: (playing: boolean) => void;
  missionPlaybackSpeed: MissionPlaybackSpeed;
  setMissionPlaybackSpeed: (speed: MissionPlaybackSpeed) => void;
  providerMode: EphemerisProviderMode;
  setProviderMode: (mode: EphemerisProviderMode) => void;
  lastProviderUsed: string;
  setLastProviderUsed: (provider: string) => void;
  apiWarnings: ApiWarning[];
  setApiWarnings: (warnings: ApiWarning[]) => void;
  liveHorizonsOverride: {
    epochUtc: string;
    subSolarLatDeg: number;
    subSolarLonDeg: number;
    subEarthLatDeg: number;
    subEarthLonDeg: number;
    earthMoonRangeKm: number;
    sourceKernel: string;
  } | null;
  setLiveHorizonsOverride: (
    override: {
      epochUtc: string;
      subSolarLatDeg: number;
      subSolarLonDeg: number;
      subEarthLatDeg: number;
      subEarthLonDeg: number;
      earthMoonRangeKm: number;
      sourceKernel: string;
    } | null
  ) => void;
  instantSnapshot: InstantTelemetrySnapshot | null;
  setInstantSnapshot: (snap: InstantTelemetrySnapshot | null) => void;
  timelineAnalysis: MissionTimelineAnalysis | null;
  setTimelineAnalysis: (analysis: MissionTimelineAnalysis | null) => void;

  // 5. Visualization & GIS Domain
  hoveredSpatialPoint: SpatialCrossHighlightPoint | null;
  setHoveredSpatialPoint: (pt: SpatialCrossHighlightPoint | null) => void;
  activeTransectLine: { latA: number; lonA: number; latB: number; lonB: number };
  setActiveTransectLine: (line: { latA: number; lonA: number; latB: number; lonB: number }) => void;
  selectedFeatureId: string;
  setSelectedFeatureId: (featId: string) => void;
  globeShaderMode: LunarShaderMode;
  setGlobeShaderMode: (mode: LunarShaderMode) => void;
  showAllGlobeMarkers: boolean;
  setShowAllGlobeMarkers: (show: boolean) => void;
  explorerViewMode: '3d-terrain' | '2d-map' | 'horizon';
  setExplorerViewMode: (mode: '3d-terrain' | '2d-map' | 'horizon') => void;
  moonTrekLayers: MoonTrekGisLayer[];
  moonTrekCategory: MoonTrekCategory;
  highlightedLayerId: string | null;
  moonTrekProjection: 'stereographic' | 'globe3d';
  showGraticule: boolean;
  moonTrekSolarAzimuthDeg: number;
  setMoonTrekCategory: (cat: MoonTrekCategory) => void;
  toggleMoonTrekLayerVisibility: (id: string) => void;
  setMoonTrekLayerOpacity: (id: string, opacity: number) => void;
  applyMoonTrekPreset: (presetId: string) => void;
  setHighlightedLayerId: (id: string | null) => void;
  setMoonTrekProjection: (proj: 'stereographic' | 'globe3d') => void;
  setShowGraticule: (show: boolean) => void;
  setMoonTrekSolarAzimuthDeg: (deg: number) => void;
  activeLiveWmtsLayer: {
    layerId: string;
    projection: 'EQ' | 'SP' | 'NP';
    enabled: boolean;
  };
  setActiveLiveWmtsLayer: (layer: {
    layerId: string;
    projection: 'EQ' | 'SP' | 'NP';
    enabled: boolean;
  }) => void;
  activeLiveLrocWmsLayer: {
    layerName: string;
    srs: 'EPSG:4326' | 'AUTO:42003,9001,0,-90' | 'AUTO:42003,9001,0,90';
    opacity: number;
    enabled: boolean;
  };
  setActiveLiveLrocWmsLayer: (layer: {
    layerName: string;
    srs: 'AUTO:42003,9001,0,-90' | 'AUTO:42003,9001,0,90' | 'EPSG:4326';
    opacity: number;
    enabled: boolean;
  }) => void;
}

const DEFAULT_SUBSECTIONS: Record<PrimaryWorkspaceId, string> = {
  home: 'portal',
  explorer: WORKSPACE_REGISTRY.explorer.defaultSubsection,
  'lunar-bases': WORKSPACE_REGISTRY['lunar-bases'].defaultSubsection,
  'site-analysis': WORKSPACE_REGISTRY['site-analysis'].defaultSubsection,
  simulator: WORKSPACE_REGISTRY.simulator.defaultSubsection,
  comparison: WORKSPACE_REGISTRY.comparison.defaultSubsection,
  'moon-trek': WORKSPACE_REGISTRY['moon-trek'].defaultSubsection,
  reports: WORKSPACE_REGISTRY.reports.defaultSubsection,
};

export const useSeleneStore = create<SeleneStoreState>()(
  persist(
    (set, get) => ({
      // 1. Navigation Domain
      activeTab: 'home',
      activeSubsection: { ...DEFAULT_SUBSECTIONS },
      flightBriefOpen: false,
      setActiveTab: (tab) => {
        const cleaned = String(tab).replace(/^#/, '') as SeleneWorkspaceTab;
        const directTabs: SeleneWorkspaceTab[] = [
          'home',
          'overview',
          'explorer',
          'lunar-bases',
          'site-analysis',
          'simulator',
          'comparison',
          'timeline',
          'moon-trek',
          'reports',
          'settings',
        ];
        if (directTabs.includes(cleaned)) {
          const prevTab = get().activeTab;
          if (prevTab !== cleaned) {
            transitionWorkspaceLifecycle(prevTab, cleaned);
          }
          set({ activeTab: cleaned, fullscreenViewport: false });
          if (typeof window !== 'undefined' && window.location.hash !== `#${cleaned}`) {
            window.history.replaceState(null, '', `#${cleaned}`);
          }
          return;
        }
        get().navigateTo(String(tab), { updateHash: true, pushHistory: true });
      },
      setActiveSubsection: (workspace, subsection) => {
        set((state) => {
          const nextSubs = { ...state.activeSubsection, [workspace]: subsection };
          const nextHash = buildWorkspaceHash(workspace, subsection);
          if (typeof window !== 'undefined' && window.location.hash !== nextHash) {
            window.history.replaceState(null, '', nextHash);
          }
          // Synchronize Explorer view mode if navigating explorer subsections
          const explorerModeUpdate: Partial<SeleneStoreState> =
            workspace === 'explorer' &&
            (subsection === '3d-terrain' || subsection === '2d-map' || subsection === 'horizon')
              ? { explorerViewMode: subsection }
              : {};
          return {
            activeSubsection: nextSubs,
            ...explorerModeUpdate,
          };
        });
      },
      navigateTo: (rawTarget, options) => {
        const updateHash = options?.updateHash ?? true;
        const pushHistory = options?.pushHistory ?? false;
        const resolved = resolveNavigationTarget(rawTarget);
        const current = get();

        if (resolved.openFlightBrief) {
          set({ flightBriefOpen: true });
          if (updateHash && typeof window !== 'undefined' && window.location.hash !== '#settings') {
            window.history.replaceState(null, '', '#settings');
          }
          return;
        }

        const prevTab = current.activeTab;
        if (prevTab !== resolved.workspace) {
          transitionWorkspaceLifecycle(prevTab, resolved.workspace);
        }

        const targetSub =
          resolved.subsection ??
          current.activeSubsection[resolved.workspace] ??
          WORKSPACE_REGISTRY[resolved.workspace].defaultSubsection;

        const nextSubs = {
          ...current.activeSubsection,
          [resolved.workspace]: targetSub,
        };

        const explorerModeUpdate =
          resolved.workspace === 'explorer' &&
          (targetSub === '3d-terrain' || targetSub === '2d-map' || targetSub === 'horizon')
            ? { explorerViewMode: targetSub as '3d-terrain' | '2d-map' | 'horizon' }
            : {};

        set({
          activeTab: resolved.workspace,
          activeSubsection: nextSubs,
          fullscreenViewport: false,
          ...explorerModeUpdate,
        });

        if (updateHash && typeof window !== 'undefined') {
          const nextHash = buildWorkspaceHash(resolved.workspace, targetSub);
          if (window.location.hash !== nextHash) {
            if (pushHistory) {
              window.history.pushState(null, '', nextHash);
            } else {
              window.history.replaceState(null, '', nextHash);
            }
          }
        }
      },
      setFlightBriefOpen: (open) => set({ flightBriefOpen: open }),

      // 2. UI Preferences & Persistent Layout Domain
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      themePreference: 'dark',
      setThemePreference: (pref) => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('selene_theme_preference', pref);
          } catch {
            // Ignore storage errors
          }
        }
        set({ themePreference: pref });
      },
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      inspectorCollapsed: false,
      setInspectorCollapsed: (collapsed) => set({ inspectorCollapsed: collapsed }),
      inspectorWidthPx: 340,
      setInspectorWidthPx: (widthPx) =>
        set({ inspectorWidthPx: Math.max(280, Math.min(460, Math.round(widthPx))) }),
      fullscreenViewport: false,
      setFullscreenViewport: (fs) => set({ fullscreenViewport: fs }),
      expandedPanels: {},
      setPanelExpanded: (panelId, expanded) =>
        set((state) => ({
          expandedPanels: { ...state.expandedPanels, [panelId]: expanded },
        })),
      isEduMode: false,
      setIsEduMode: (val) => set({ isEduMode: val }),
      resetLayoutPreferences: () =>
        set({
          themePreference: 'dark',
          sidebarCollapsed: false,
          inspectorCollapsed: false,
          inspectorWidthPx: 340,
          fullscreenViewport: false,
          expandedPanels: {},
        }),

      // 3. Mission Configuration Domain
      sites: [],
      setSites: (sites) => set({ sites }),
      activeSiteId: 'shackleton-rim',
      setActiveSiteId: (siteId) => set({ activeSiteId: siteId }),
      scenarios: [],
      setScenarios: (scenarios) => set({ scenarios }),
      selectedComparisonIds: [
        'scen-artemis-iii-shackleton',
        'scen-clps-malapert-relay',
        'scen-viper-nobile-volatile',
      ],
      setSelectedComparisonIds: (ids) => set({ selectedComparisonIds: ids }),
      savedComparisonSiteIds: [
        'shackleton-rim',
        'malapert-massif',
        'nobile-rim-1',
        'clps-viper-mons-mouton',
      ],
      toggleSavedComparisonSite: (siteId) =>
        set((state) => {
          const exists = state.savedComparisonSiteIds.includes(siteId);
          if (exists) {
            if (state.savedComparisonSiteIds.length <= 1) return state;
            return {
              savedComparisonSiteIds: state.savedComparisonSiteIds.filter((id) => id !== siteId),
            };
          }
          return {
            savedComparisonSiteIds: [...state.savedComparisonSiteIds, siteId],
          };
        }),
      datasets: [],
      setDatasets: (datasets) => set({ datasets }),
      landerSlopeThresholds: DEFAULT_LANDER_SLOPE_THRESHOLDS,
      setLanderSlopeThresholds: (partial) =>
        set((state) => {
          const updated = { ...state.landerSlopeThresholds, ...partial };
          return {
            landerSlopeThresholds: updated,
            constraints: {
              ...state.constraints,
              maxSlopeDeg: updated.slopeSafeMaxDeg,
              slopeCautionMaxDeg: updated.slopeCautionMaxDeg,
            },
          };
        }),
      constraints: DEFAULT_CONSTRAINTS,
      setConstraints: (partial) =>
        set((state) => ({
          constraints: { ...state.constraints, ...partial },
        })),
      mcdaWeights: DEFAULT_MCDA_WEIGHTS,
      setMcdaWeights: (partial) =>
        set((state) => ({
          mcdaWeights: { ...state.mcdaWeights, ...partial },
        })),

      // 4. Ephemeris & Mission Timeline Domain
      simulationEpochET: utcToEt(INITIAL_EPOCH_UTC),
      simulationStartET: utcToEt(INITIAL_START_UTC),
      simulationEndET: utcToEt(INITIAL_START_UTC) + 14 * 86400,
      simulationEpochUtc: INITIAL_EPOCH_UTC,
      setSimulationEpochET: (etSeconds) => {
        const safeEt = Number.isFinite(etSeconds) ? etSeconds : utcToEt(INITIAL_EPOCH_UTC);
        const current = get();
        if (Math.abs(safeEt - current.simulationEpochET) < 1e-6) return;
        const utcIso = etToUtc(safeEt);
        set({ simulationEpochET: safeEt, simulationEpochUtc: utcIso });
      },
      setSimulationEpochUtc: (utcIso) => {
        try {
          const et = utcToEt(utcIso);
          const current = get();
          if (
            current.simulationEpochUtc === utcIso &&
            Math.abs(et - current.simulationEpochET) < 1e-6
          ) {
            return;
          }
          set({ simulationEpochUtc: utcIso, simulationEpochET: et });
        } catch {
          if (get().simulationEpochUtc !== utcIso) {
            set({ simulationEpochUtc: utcIso });
          }
        }
      },
      missionStartDateUtc: INITIAL_START_UTC,
      setMissionStartDateUtc: (utcIso) =>
        set((state) => {
          try {
            const startEt = utcToEt(utcIso);
            const endEt = startEt + state.missionDurationDays * 86400;
            const clampedEt = Math.max(startEt, Math.min(endEt, state.simulationEpochET));
            return {
              missionStartDateUtc: utcIso,
              simulationStartET: startEt,
              simulationEndET: endEt,
              simulationEpochET: clampedEt,
              simulationEpochUtc: etToUtc(clampedEt),
            };
          } catch {
            return { missionStartDateUtc: utcIso };
          }
        }),
      missionDurationDays: 14,
      setMissionDurationDays: (days) =>
        set((state) => {
          const endEt = state.simulationStartET + days * 86400;
          const clampedEt = Math.max(
            state.simulationStartET,
            Math.min(endEt, state.simulationEpochET)
          );
          return {
            missionDurationDays: days,
            simulationEndET: endEt,
            simulationEpochET: clampedEt,
            simulationEpochUtc: etToUtc(clampedEt),
          };
        }),
      samplingStepHours: 'AUTO',
      setSamplingStepHours: (step) => set({ samplingStepHours: step }),
      isPlayingMissionClock: false,
      setIsPlayingMissionClock: (playing) => set({ isPlayingMissionClock: playing }),
      missionPlaybackSpeed: 60,
      setMissionPlaybackSpeed: (speed) => set({ missionPlaybackSpeed: speed }),
      providerMode: 'AUTO_JPL',
      setProviderMode: (mode) => set({ providerMode: mode }),
      lastProviderUsed: 'CALIBRATED_ANALYTICAL_DE441',
      setLastProviderUsed: (provider) => set({ lastProviderUsed: provider }),
      apiWarnings: [],
      setApiWarnings: (warnings) => set({ apiWarnings: warnings }),
      liveHorizonsOverride: null,
      setLiveHorizonsOverride: (override) => set({ liveHorizonsOverride: override }),
      instantSnapshot: null,
      setInstantSnapshot: (snap) => set({ instantSnapshot: snap }),
      timelineAnalysis: null,
      setTimelineAnalysis: (analysis) => set({ timelineAnalysis: analysis }),

      // 5. Visualization & GIS Domain
      hoveredSpatialPoint: null,
      setHoveredSpatialPoint: (pt) => set({ hoveredSpatialPoint: pt }),
      activeTransectLine: {
        latA: -89.55,
        lonA: 115.0,
        latB: -89.88,
        lonB: 295.0,
      },
      setActiveTransectLine: (line) => set({ activeTransectLine: line }),
      selectedFeatureId: 'feat-shackleton',
      setSelectedFeatureId: (featId) => set({ selectedFeatureId: featId }),
      globeShaderMode: 'albedo',
      setGlobeShaderMode: (mode) => set({ globeShaderMode: mode }),
      showAllGlobeMarkers: true,
      setShowAllGlobeMarkers: (show) => set({ showAllGlobeMarkers: show }),
      explorerViewMode: '3d-terrain',
      setExplorerViewMode: (mode) =>
        set((state) => ({
          explorerViewMode: mode,
          activeSubsection: { ...state.activeSubsection, explorer: mode },
        })),
      moonTrekLayers: INITIAL_MOON_TREK_LAYERS,
      moonTrekCategory: 'All',
      highlightedLayerId: 'lola-dem-hypsometric',
      moonTrekProjection: 'stereographic',
      showGraticule: true,
      moonTrekSolarAzimuthDeg: 135,
      setMoonTrekCategory: (cat) => set({ moonTrekCategory: cat }),
      toggleMoonTrekLayerVisibility: (id) =>
        set((state) => ({
          moonTrekLayers: state.moonTrekLayers.map((l) =>
            l.id === id ? { ...l, visible: !l.visible } : l
          ),
        })),
      setMoonTrekLayerOpacity: (id, opacity) =>
        set((state) => ({
          moonTrekLayers: state.moonTrekLayers.map((l) =>
            l.id === id ? { ...l, opacity: Math.max(0, Math.min(100, opacity)) } : l
          ),
        })),
      applyMoonTrekPreset: (presetId) =>
        set((state) => {
          const activeIdsByPreset: Record<string, string[]> = {
            'topographic-screening': [
              'lroc-wac-mosaic',
              'lola-dem-hypsometric',
              'lola-slope-hazard',
              'lola-ldec-uncertainty',
            ],
            'solar-illumination': [
              'lroc-wac-mosaic',
              'lola-dem-hypsometric',
              'psr-cold-traps',
            ],
            'cryogenic-volatile': [
              'lroc-wac-mosaic',
              'psr-cold-traps',
              'diviner-bolometric-temp',
              'lcross-lend-ice',
            ],
            'slope-hazard': [
              'lroc-nac-controlled',
              'lola-slope-hazard',
              'lola-ldec-uncertainty',
            ],
            'full-mission': [
              'lroc-wac-mosaic',
              'lola-dem-hypsometric',
              'psr-cold-traps',
              'lcross-lend-ice',
              'lola-slope-hazard',
            ],
          };
          const targetIds = activeIdsByPreset[presetId] ?? activeIdsByPreset['full-mission']!;
          return {
            moonTrekLayers: state.moonTrekLayers.map((l) => ({
              ...l,
              visible: targetIds.includes(l.id),
            })),
            highlightedLayerId: targetIds[1] ?? targetIds[0] ?? null,
          };
        }),
      setHighlightedLayerId: (id) => set({ highlightedLayerId: id }),
      setMoonTrekProjection: (proj) => set({ moonTrekProjection: proj }),
      setShowGraticule: (show) => set({ showGraticule: show }),
      setMoonTrekSolarAzimuthDeg: (deg) => set({ moonTrekSolarAzimuthDeg: deg }),
      activeLiveWmtsLayer: {
        layerId: 'LRO_NAC_AvgMosaic_SPole855_1mp',
        projection: 'SP',
        enabled: false,
      },
      setActiveLiveWmtsLayer: (layer) => set({ activeLiveWmtsLayer: layer }),
      activeLiveLrocWmsLayer: {
        layerName: 'luna_wac_global',
        srs: 'AUTO:42003,9001,0,-90',
        opacity: 85,
        enabled: false,
      },
      setActiveLiveLrocWmsLayer: (layer) => set({ activeLiveLrocWmsLayer: layer }),
    }),
    {
      name: 'selene_ui_preferences_v2',
      version: 2,
      storage: createJSONStorage(() => safeMemoryStorage),
      partialize: (state) => ({
        themePreference: state.themePreference,
        sidebarCollapsed: state.sidebarCollapsed,
        inspectorCollapsed: state.inspectorCollapsed,
        inspectorWidthPx: state.inspectorWidthPx,
        expandedPanels: state.expandedPanels,
        isEduMode: state.isEduMode,
        activeSiteId: state.activeSiteId,
        providerMode: state.providerMode,
        constraints: state.constraints,
        mcdaWeights: state.mcdaWeights,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState && typeof persistedState === 'object'
          ? persistedState
          : {}) as Record<string, unknown>;
        if (version < 2) {
          let legacyTheme: SeleneThemePreference = 'dark';
          if (typeof window !== 'undefined') {
            try {
              const raw = window.localStorage.getItem('selene_theme_preference');
              if (raw === 'light' || raw === 'dark' || raw === 'system') {
                legacyTheme = raw;
              }
            } catch {
              // Ignore storage read error
            }
          }
          return {
            ...s,
            themePreference:
              s.themePreference === 'light' ||
              s.themePreference === 'dark' ||
              s.themePreference === 'system'
                ? s.themePreference
                : legacyTheme,
            sidebarCollapsed: typeof s.sidebarCollapsed === 'boolean' ? s.sidebarCollapsed : false,
            inspectorCollapsed:
              typeof s.inspectorCollapsed === 'boolean' ? s.inspectorCollapsed : false,
            inspectorWidthPx:
              typeof s.inspectorWidthPx === 'number'
                ? Math.max(280, Math.min(460, s.inspectorWidthPx))
                : 340,
            expandedPanels:
              s.expandedPanels && typeof s.expandedPanels === 'object' ? s.expandedPanels : {},
          };
        }
        return s;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Granular domain selector hooks (prevents unrelated clock-tick re-renders)
export function useNavigationState() {
  return useSeleneStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      activeSubsection: s.activeSubsection,
      flightBriefOpen: s.flightBriefOpen,
      setActiveTab: s.setActiveTab,
      setActiveSubsection: s.setActiveSubsection,
      navigateTo: s.navigateTo,
      setFlightBriefOpen: s.setFlightBriefOpen,
    }))
  );
}

export function useUiPreferencesState() {
  return useSeleneStore(
    useShallow((s) => ({
      hasHydrated: s.hasHydrated,
      themePreference: s.themePreference,
      setThemePreference: s.setThemePreference,
      sidebarCollapsed: s.sidebarCollapsed,
      setSidebarCollapsed: s.setSidebarCollapsed,
      inspectorCollapsed: s.inspectorCollapsed,
      setInspectorCollapsed: s.setInspectorCollapsed,
      inspectorWidthPx: s.inspectorWidthPx,
      setInspectorWidthPx: s.setInspectorWidthPx,
      fullscreenViewport: s.fullscreenViewport,
      setFullscreenViewport: s.setFullscreenViewport,
      expandedPanels: s.expandedPanels,
      setPanelExpanded: s.setPanelExpanded,
      isEduMode: s.isEduMode,
      setIsEduMode: s.setIsEduMode,
      resetLayoutPreferences: s.resetLayoutPreferences,
    }))
  );
}

export function useMissionClockDomain() {
  return useSeleneStore(
    useShallow((s) => ({
      simulationEpochUtc: s.simulationEpochUtc,
      simulationEpochET: s.simulationEpochET,
      setSimulationEpochUtc: s.setSimulationEpochUtc,
      setSimulationEpochET: s.setSimulationEpochET,
      missionStartDateUtc: s.missionStartDateUtc,
      setMissionStartDateUtc: s.setMissionStartDateUtc,
      missionDurationDays: s.missionDurationDays,
      setMissionDurationDays: s.setMissionDurationDays,
      samplingStepHours: s.samplingStepHours,
      setSamplingStepHours: s.setSamplingStepHours,
      isPlayingMissionClock: s.isPlayingMissionClock,
      setIsPlayingMissionClock: s.setIsPlayingMissionClock,
      missionPlaybackSpeed: s.missionPlaybackSpeed,
      setMissionPlaybackSpeed: s.setMissionPlaybackSpeed,
    }))
  );
}
