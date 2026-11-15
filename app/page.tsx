'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  SeleneThemePreference,
  SeleneWorkspaceTab,
  useSeleneStore,
} from '@/lib/store/useSeleneStore';
import {
  evaluateDecoupledState,
  generate360HorizonProfile,
} from '@/lib/astrodynamics/coordinateFrames';
import { computeCalibratedEphemeris } from '@/lib/astrodynamics/offlineCalibratedProvider';
import { computeLunarPhase, computeTimeScales } from '@/lib/astrodynamics/timeScales';
import { runMissionTimelineAnalysis } from '@/lib/astrodynamics/missionAnalyzer';
import type {
  DatasetRecord,
  LandingSiteRecord,
  ScenarioRecord,
} from '@/server/db/database';
import { SiteStatusBadge } from '@/components/editorial/WorkspacePrimitives';
import DatasetIntegrationSlot from '@/components/editorial/DatasetIntegrationSlot';
import EditorialNavbar from '@/components/editorial/EditorialNavbar';
import CinematicSplitHero from '@/components/editorial/CinematicSplitHero';
import EditorialHomepageBody from '@/components/editorial/EditorialHomepageBody';
import { CinematicIntroExperience } from '@/components/intro/CinematicIntroExperience';
import { AnimatePresence } from 'motion/react';

const OverviewWorkspace = dynamic(() => import('@/components/workspaces/OverviewWorkspace'));
const ExplorerWorkspace = dynamic(() => import('@/components/workspaces/ExplorerWorkspace'));
const SiteAnalysisWorkspace = dynamic(() => import('@/components/workspaces/SiteAnalysisWorkspace'));
const SimulatorWorkspace = dynamic(() => import('@/components/workspaces/SimulatorWorkspace'));
const ComparisonWorkspace = dynamic(() => import('@/components/workspaces/ComparisonWorkspace'));
const TimelineWorkspace = dynamic(() => import('@/components/workspaces/TimelineWorkspace'));
const ReportsWorkspace = dynamic(() => import('@/components/workspaces/ReportsWorkspace'));
const SettingsWorkspace = dynamic(() => import('@/components/workspaces/SettingsWorkspace'));
const LunarBasesWorkspace = dynamic(() => import('@/components/workspaces/LunarBasesWorkspace'));
const NasaLiveIntegrationPanel = dynamic(() => import('@/components/workspaces/NasaLiveIntegrationPanel'));
const MoonTrekViewer = dynamic(() => import('@/components/three/MoonTrekViewer'), { ssr: false });
const LayerControl = dynamic(() => import('@/components/three/LayerControl'));
const ScientificRechartsDeck = dynamic(() => import('@/components/charts/ScientificRechartsDeck'), { ssr: false });
const UnifiedMissionClockDock = dynamic(() => import('@/components/hud/UnifiedMissionClockDock'));
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  Globe,
  Layers,
  Monitor,
  Moon,
  Orbit,
  Radar,
  Settings,
  Sun,
} from 'lucide-react';

const FALLBACK_SITES: LandingSiteRecord[] = [
  {
    id: 'shackleton-rim',
    name: 'Shackleton Crater Rim',
    designation: 'ARTEMIS-SP-001',
    latitude: -89.78,
    longitude: 120.45,
    elevation_km: 2.15,
    crater_name: 'Shackleton (21 km dia, 4.2 km depth)',
    description:
      'Elevated connecting ridge along the Shackleton crater rim crest near the Lunar South Pole. Offers exceptional quasi-continuous grazing solar illumination (>84% in summer) immediately adjacent to a premier permanently shadowed cold trap.',
    scientific_value:
      'Direct rover/EVA access to cryogenic water-ice deposits inside Shackleton interior floor (<0.8 km from rim edge) plus South Pole-Aitken basin impact melt samples.',
    psr_proximity_km: 0.8,
    slope_deg: 5.8,
    is_preset: 1,
    mission_category: 'ARTEMIS',
    region_tier: 'SOUTH_POLE',
    site_status: 'CANDIDATE_REGION',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Mountain',
    designation: 'ARTEMIS-SP-002',
    latitude: -84.9,
    longitude: 12.9,
    elevation_km: 4.85,
    crater_name: 'Malapert Massif Summit Ridge',
    description:
      'Commanding 4.85 km high mountain massif oriented toward the mean sub-Earth meridian (0°E). Provides near-continuous Direct-to-Earth (DTE) line-of-sight communication and unobstructed northern horizon.',
    scientific_value:
      'Primary lunar telecommunications relay peak and ancient pre-Nectarian highland massif sampling from the South Pole-Aitken basin rim.',
    psr_proximity_km: 3.4,
    slope_deg: 7.2,
    is_preset: 1,
    mission_category: 'ARTEMIS',
    region_tier: 'SOUTH_POLE',
    site_status: 'CANDIDATE_REGION',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Crater Rim',
    designation: 'ARTEMIS-SP-003',
    latitude: -85.2,
    longitude: 53.5,
    elevation_km: 1.65,
    crater_name: 'Nobile Crater Western Rim (VIPER Zone)',
    description:
      'Broad, gently sloping highland plateau on the western rim of Nobile Crater. Combines gentle trafficability slopes (<6°) with accessible micro-cold-traps for volatile prospecting.',
    scientific_value:
      'High concentration of shallow subsurface hydrogen signatures (LEND/LCROSS) across accessible thermal stability zones.',
    psr_proximity_km: 1.2,
    slope_deg: 4.9,
    is_preset: 1,
    mission_category: 'ARTEMIS',
    region_tier: 'SOUTH_POLE',
    site_status: 'CANDIDATE_REGION',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'haworth-crater',
    name: 'Haworth Crater',
    designation: 'ARTEMIS-SP-004',
    latitude: -87.4,
    longitude: 354.5,
    elevation_km: 0.85,
    crater_name: 'Haworth Southern Rim Bench',
    description:
      'Polygonal 51 km crater adjacent to Shoemaker and Faustini. Features extensive ultra-cold permanently shadowed floors (<40 K Diviner bolometric temperature) surrounded by steep massif walls.',
    scientific_value:
      'Super-cold trap capable of sequestering ultra-volatile species (CO2, NH3, H2S, H2O) alongside ancient stratified basin ejecta.',
    psr_proximity_km: 0.5,
    slope_deg: 9.4,
    is_preset: 1,
    mission_category: 'ARTEMIS',
    region_tier: 'SOUTH_POLE',
    site_status: 'CANDIDATE_REGION',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'clps-im1-malapert-a',
    name: 'Malapert A (IM-1 Odysseus)',
    designation: 'CLPS-IM1-19A',
    latitude: -80.13,
    longitude: 1.44,
    elevation_km: 0.62,
    crater_name: 'Malapert A Highland Plain',
    description:
      'First U.S. commercial soft lunar landing site (Intuitive Machines Nova-C Odysseus, Feb 2024) in the southern polar highlands.',
    scientific_value:
      'Radio astronomy low-frequency plasma environment baseline and southern highland crustal geology.',
    psr_proximity_km: 6.2,
    slope_deg: 11.2,
    is_preset: 1,
    mission_category: 'CLPS',
    region_tier: 'SOUTH_POLE',
    site_status: 'CONFIRMED_LANDING',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'clps-viper-mons-mouton',
    name: 'Mons Mouton (CLPS Griffin / VIPER)',
    designation: 'CLPS-20A-MM',
    latitude: -84.6,
    longitude: 31.0,
    elevation_km: 5.1,
    crater_name: 'Mons Mouton Flat-Topped Massif',
    description:
      'Expansive, flat-topped 5.1 km mountain plateau near the western rim of Nobile Crater with prolonged summer sunlight.',
    scientific_value:
      'In-situ volatile drill prospecting across four distinct ice-stability thermal depth regimes.',
    psr_proximity_km: 1.1,
    slope_deg: 4.2,
    is_preset: 1,
    mission_category: 'CLPS',
    region_tier: 'SOUTH_POLE',
    site_status: 'PLANNED_TARGET',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'isro-chandrayaan3-shiv-shakti',
    name: 'Statio Shiv Shakti (Chandrayaan-3)',
    designation: 'INTL-ISRO-CY3',
    latitude: -69.373,
    longitude: 32.319,
    elevation_km: 0.45,
    crater_name: 'Manzinus–Boguslawsky Highland Ridge',
    description:
      'Historic ISRO Chandrayaan-3 Vikram lander and Pragyan rover touchdown site in the southern high latitudes.',
    scientific_value:
      'ChaSTE in-situ thermal conductivity profile and APXS sulfur/elemental composition.',
    psr_proximity_km: 18.5,
    slope_deg: 5.5,
    is_preset: 1,
    mission_category: 'INTERNATIONAL',
    region_tier: 'SOUTH_POLE',
    site_status: 'CONFIRMED_LANDING',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'apollo-11-tranquility',
    name: 'Statio Tranquillitatis (Apollo 11)',
    designation: 'APOLLO-11-AS11',
    latitude: 0.674,
    longitude: 23.473,
    elevation_km: -1.9,
    crater_name: 'Mare Tranquillitatis (Sea of Tranquility)',
    description:
      'Historic first human lunar landing site (July 20, 1969). Smooth equatorial titanium-rich basaltic mare plain.',
    scientific_value:
      'Radiometric age calibration benchmark and passive seismic/laser retroreflector reference station.',
    psr_proximity_km: 2680.0,
    slope_deg: 1.8,
    is_preset: 1,
    mission_category: 'APOLLO',
    region_tier: 'EQUATORIAL_MID',
    site_status: 'HISTORICAL_LANDING',
    created_at: '2026-11-01T00:00:00Z',
  },
];

interface WorkspaceNavItem {
  id: SeleneWorkspaceTab;
  label: string;
  shortCode: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { id: 'home', label: 'Editorial Home', shortCode: '00', group: '00. PORTAL', icon: Compass },
  { id: 'overview', label: 'Mission Overview', shortCode: '01', group: '01. EXPLORE & SELECT', icon: Activity },
  { id: 'explorer', label: 'Landing Site Explorer', shortCode: '02', group: '01. EXPLORE & SELECT', icon: Globe },
  { id: 'lunar-bases', label: 'Lunar Bases & Infrastructure', shortCode: '02B', group: '01. EXPLORE & SELECT', icon: Building2 },
  { id: 'site-analysis', label: 'Site Physics & Terrain', shortCode: '03', group: '02. ANALYZE & SIMULATE', icon: Radar },
  { id: 'simulator', label: '3D Orbital & Horizon Lab', shortCode: '04', group: '02. ANALYZE & SIMULATE', icon: Orbit },
  { id: 'timeline', label: 'Illumination & Comms Timeline', shortCode: '05', group: '02. ANALYZE & SIMULATE', icon: CalendarClock },
  { id: 'comparison', label: 'Multi-Site Trade Matrix', shortCode: '06', group: '02. ANALYZE & SIMULATE', icon: BarChart3 },
  { id: 'moon-trek', label: 'NASA Moon Trek GIS', shortCode: '07', group: '03. DATA & PROVENANCE', icon: Layers },
  { id: 'reports', label: 'Data Hub & Reports', shortCode: '08', group: '03. DATA & PROVENANCE', icon: FileText },
  { id: 'settings', label: 'Settings & Constraints', shortCode: '09', group: '03. DATA & PROVENANCE', icon: Settings },
];

function LiveUtcClockText() {
  const [wallUtc, setWallUtc] = useState<string>(() => new Date().toISOString().slice(11, 19) + 'Z');
  useEffect(() => {
    const id = setInterval(() => {
      setWallUtc(new Date().toISOString().slice(11, 19) + 'Z');
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{wallUtc}</span>;
}

export default function ProjectSelenePage() {
  const {
    activeTab,
    setActiveTab,
    themePreference,
    setThemePreference,
    sidebarCollapsed,
    setSidebarCollapsed,
    sites,
    setSites,
    activeSiteId,
    setActiveSiteId,
    scenarios,
    setScenarios,
    selectedComparisonIds,
    setSelectedComparisonIds,
    savedComparisonSiteIds,
    toggleSavedComparisonSite,
    datasets,
    setDatasets,
    simulationEpochUtc,
    setSimulationEpochUtc,
    missionStartDateUtc,
    setMissionStartDateUtc,
    missionDurationDays,
    setMissionDurationDays,
    samplingStepHours,
    setSamplingStepHours,
    constraints,
    setConstraints,
    mcdaWeights,
    setMcdaWeights,
    providerMode,
    setProviderMode,
    lastProviderUsed,
    setLastProviderUsed,
    apiWarnings,
    setApiWarnings,
    isEduMode,
    setIsEduMode,
    globeShaderMode,
    setGlobeShaderMode,
    explorerViewMode,
    setExplorerViewMode,
    moonTrekLayers,
    moonTrekCategory,
    highlightedLayerId,
    moonTrekProjection,
    showGraticule,
    moonTrekSolarAzimuthDeg,
    setMoonTrekCategory,
    toggleMoonTrekLayerVisibility,
    setMoonTrekLayerOpacity,
    setHighlightedLayerId,
    setMoonTrekProjection,
    setShowGraticule,
    setMoonTrekSolarAzimuthDeg,
    liveHorizonsOverride,
  } = useSeleneStore();

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(false);
  const [introState, setIntroState] = useState<'pending' | 'active' | 'done'>('pending');

  // Determine on mount whether to launch the 3D lunar introduction cleanly once per session
  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '');
    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem('selene_intro_completed') === '1';
    } catch {
      alreadySeen = false;
    }
    const isInitialHomeEntry = !rawHash || rawHash === 'home';
    queueMicrotask(() => {
      setIntroState(isInitialHomeEntry && !alreadySeen ? 'active' : 'done');
    });
  }, []);

  // Hydrate theme preference and listen to system color-scheme changes
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('selene_theme_preference') as SeleneThemePreference | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemePreference(saved);
      }
    } catch {
      // Ignore storage access issues
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    queueMicrotask(() => setSystemPrefersDark(mq.matches));
    const listener = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [setThemePreference]);

  const resolvedTheme: 'light' | 'dark' =
    themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference;

  // Bidirectional URL Hash & History Routing synchronization
  useEffect(() => {
    const syncFromHash = (isHistoryNavigation = false) => {
      const rawHash = window.location.hash.replace('#', '') as SeleneWorkspaceTab;
      if (!rawHash) {
        if (isHistoryNavigation) {
          setActiveTab('home');
        }
        return;
      }
      if (WORKSPACE_NAV_ITEMS.some((item) => item.id === rawHash)) {
        setActiveTab(rawHash);
      }
    };
    syncFromHash(false);
    const onHistoryChange = () => syncFromHash(true);
    window.addEventListener('hashchange', onHistoryChange);
    window.addEventListener('popstate', onHistoryChange);
    return () => {
      window.removeEventListener('hashchange', onHistoryChange);
      window.removeEventListener('popstate', onHistoryChange);
    };
  }, [setActiveTab]);

  // Load initial sites, scenarios, datasets dynamically from SQLite backend
  useEffect(() => {
    let mounted = true;
    async function bootstrapData() {
      try {
        const [sitesRes, scenRes, dsRes] = await Promise.all([
          fetch('/api/v1/sites'),
          fetch('/api/v1/scenarios'),
          fetch('/api/v1/datasets'),
        ]);
        if (!mounted) return;

        if (sitesRes.ok) {
          const sJson = await sitesRes.json();
          if (Array.isArray(sJson.data?.sites) && sJson.data.sites.length > 0) {
            setSites(sJson.data.sites);
          }
        }
        if (scenRes.ok) {
          const scJson = await scenRes.json();
          if (Array.isArray(scJson.data?.scenarios)) {
            setScenarios(scJson.data.scenarios);
          }
        }
        if (dsRes.ok) {
          const dJson = await dsRes.json();
          if (Array.isArray(dJson.data?.datasets)) {
            setDatasets(dJson.data.datasets as DatasetRecord[]);
          }
        }
      } catch {
        // Fallback sites already available
      }
    }
    bootstrapData();
    return () => {
      mounted = false;
    };
  }, [setSites, setScenarios, setDatasets]);

  // Probe /api/v1/analysis/instant when activeSiteId or providerMode changes
  useEffect(() => {
    let mounted = true;
    async function probeInstantApi() {
      try {
        const res = await fetch('/api/v1/analysis/instant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site_id: activeSiteId,
            timestamp_utc: simulationEpochUtc,
            provider_mode: providerMode,
            min_solar_elevation_deg: constraints.minSolarElevationDeg,
            min_earth_elevation_deg: constraints.minEarthElevationDeg,
            required_continuous_hours: constraints.requiredContinuousHours,
          }),
        });
        if (!mounted || !res.ok) return;
        const json = await res.json();
        if (json.metadata?.provider) {
          setLastProviderUsed(json.metadata.provider);
        }
        if (Array.isArray(json.warnings)) {
          setApiWarnings(json.warnings);
        }
      } catch {
        // Handled by synchronous local astrodynamics engine
      }
    }
    probeInstantApi();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSiteId, providerMode]);

  const effectiveSites = sites.length > 0 ? sites : FALLBACK_SITES;
  const activeSite =
    effectiveSites.find((s) => s.id === activeSiteId) ?? effectiveSites[0]!;

  // Real-time zero-latency astrodynamics calculations for active site & epoch,
  // with optional Live NASA/JPL Horizons DE441 override when synchronized.
  const ephemeris = useMemo(() => {
    const base = computeCalibratedEphemeris(
      simulationEpochUtc,
      activeSite.latitude,
      activeSite.longitude,
      activeSite.elevation_km
    );
    if (!liveHorizonsOverride) {
      return base;
    }
    return {
      ...base,
      subSolarLatDeg: liveHorizonsOverride.subSolarLatDeg,
      subSolarLonDeg: liveHorizonsOverride.subSolarLonDeg,
      subEarthLatDeg: liveHorizonsOverride.subEarthLatDeg,
      subEarthLonDeg: liveHorizonsOverride.subEarthLonDeg,
      earthHorizon: {
        ...base.earthHorizon,
        rangeKm: liveHorizonsOverride.earthMoonRangeKm,
      },
    };
  }, [simulationEpochUtc, activeSite, liveHorizonsOverride]);

  const timeScales = useMemo(
    () => computeTimeScales(simulationEpochUtc),
    [simulationEpochUtc]
  );

  const lunarPhase = useMemo(
    () => computeLunarPhase(simulationEpochUtc),
    [simulationEpochUtc]
  );

  const physicalState = useMemo(
    () =>
      evaluateDecoupledState({
        siteId: activeSite.id,
        siteLatDeg: activeSite.latitude,
        siteLonDeg: activeSite.longitude,
        siteElevationKm: activeSite.elevation_km,
        solar: ephemeris.solarHorizon,
        earth: ephemeris.earthHorizon,
        constraints,
      }),
    [activeSite, ephemeris, constraints]
  );

  const horizonProfile = useMemo(
    () =>
      generate360HorizonProfile(
        activeSite.id,
        activeSite.latitude,
        activeSite.longitude,
        activeSite.elevation_km,
        5
      ),
    [activeSite]
  );

  const timelineAnalysis = useMemo(
    () =>
      runMissionTimelineAnalysis({
        siteId: activeSite.id,
        siteName: activeSite.name,
        siteLatDeg: activeSite.latitude,
        siteLonDeg: activeSite.longitude,
        siteElevationKm: activeSite.elevation_km,
        psrProximityKm: activeSite.psr_proximity_km,
        siteSlopeDeg: activeSite.slope_deg,
        epochStartUtc: missionStartDateUtc,
        durationDays: missionDurationDays,
        stepHours: samplingStepHours,
        constraints,
        weights: mcdaWeights,
      }),
    [
      activeSite,
      missionStartDateUtc,
      missionDurationDays,
      samplingStepHours,
      constraints,
      mcdaWeights,
    ]
  );

  const handleGlobalDateTimeChange = (value: string) => {
    if (!value) return;
    const iso = value.length === 16 ? `${value}:00Z` : new Date(value).toISOString();
    setSimulationEpochUtc(iso);
    setMissionStartDateUtc(`${iso.slice(0, 10)}T00:00:00Z`);
  };

  const handleStepLunarDay = (deltaDays: number) => {
    const nextMs = new Date(simulationEpochUtc).getTime() + deltaDays * 86400000;
    const nextIso = new Date(nextMs).toISOString();
    setSimulationEpochUtc(nextIso);
    setMissionStartDateUtc(`${nextIso.slice(0, 10)}T00:00:00Z`);
  };

  const activeNavMeta =
    WORKSPACE_NAV_ITEMS.find((item) => item.id === activeTab) ?? WORKSPACE_NAV_ITEMS[1]!;

  const groupedWorkspaceItems = useMemo(() => {
    const groups: Record<string, WorkspaceNavItem[]> = {};
    for (const item of WORKSPACE_NAV_ITEMS) {
      if (item.id === 'home') continue;
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group]!.push(item);
    }
    return groups;
  }, []);

  const handleCompleteIntro = (selectedSeleneSiteId?: string) => {
    try {
      window.sessionStorage.setItem('selene_intro_completed', '1');
    } catch {
      // Ignore storage access errors
    }
    if (selectedSeleneSiteId) {
      setActiveSiteId(selectedSeleneSiteId);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setIntroState('done');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080B12] text-[#F3EEE3] overflow-x-clip">
      {/* Prevent 1-frame flash before client intro state resolves */}
      {introState === 'pending' && (
        <div className="fixed inset-0 z-[100] bg-[#02040a]" aria-hidden="true" />
      )}

      {/* Cinematic 3D Lunar Introduction + Original Introductory Experience */}
      <AnimatePresence>
        {introState === 'active' && (
          <CinematicIntroExperience
            key="selene-cinematic-intro"
            onCompleteToHomepage={handleCompleteIntro}
          />
        )}
      </AnimatePresence>

      {/* Top Editorial Navigation Bar */}
      <EditorialNavbar
        activeTab={activeTab}
        onNavigate={(tab) => {
          if (tab === 'explore') setActiveTab('explorer');
          else if (tab === 'lunar-bases') setActiveTab('lunar-bases');
          else if (tab === 'landing-sites') setActiveTab('site-analysis');
          else if (tab === 'mission-planner') setActiveTab('simulator');
          else if (tab === 'comparison') setActiveTab('comparison');
          else if (tab === 'moon-trek') setActiveTab('moon-trek');
          else if (tab === 'data-science') setActiveTab('reports');
          else if (tab === 'about') setActiveTab('settings');
          else setActiveTab(tab as SeleneWorkspaceTab);
        }}
        onOpenFlightBrief={() => setActiveTab('settings')}
        darkOverlay={activeTab !== 'home'}
        sites={effectiveSites}
        activeSiteId={activeSite.id}
        onSelectSite={setActiveSiteId}
      />

      {/* Strictly Isolated Cinematic Editorial Homepage when activeTab === 'home' */}
      {activeTab === 'home' && (
        <div className="w-full flex flex-col">
          <CinematicSplitHero
            onLaunchMissionControl={() => {
              if (typeof window !== 'undefined') {
                if (window.location.hash !== '#overview') {
                  window.history.pushState(null, '', '#overview');
                }
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
              setActiveTab('overview');
            }}
            onProjectOverview={() => {
              if (typeof window !== 'undefined') {
                const el = document.getElementById('project-overview');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }
            }}
            onOpenPlanner={() => {
              if (typeof window !== 'undefined') {
                if (window.location.hash !== '#simulator') {
                  window.history.pushState(null, '', '#simulator');
                }
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
              setActiveTab('simulator');
            }}
            onReplayIntro={() => {
              try {
                window.sessionStorage.removeItem('selene_intro_completed');
              } catch {
                // Ignore storage errors
              }
              setIntroState('active');
            }}
          />
          <EditorialHomepageBody
            onNavigateTab={(tab) => {
              if (tab === 'explorer') setActiveTab('explorer');
              else if (tab === 'lunar-bases') setActiveTab('lunar-bases');
              else if (tab === 'site-analysis') setActiveTab('site-analysis');
              else if (tab === 'simulator' || tab === 'mission-planner') setActiveTab('simulator');
              else if (tab === 'comparison') setActiveTab('comparison');
              else if (tab === 'moon-trek') setActiveTab('moon-trek');
              else if (tab === 'data-science' || tab === 'reports') setActiveTab('reports');
              else if (tab === 'settings') setActiveTab('settings');
              else setActiveTab('overview');
            }}
            onSelectSite={(id) => {
              setActiveSiteId(id);
              setActiveTab('site-analysis');
            }}
          />
        </div>
      )}

      {/* Scoped Internal Workspace Shell (Editorial Light / Aerospace Dark with Zero Glassmorphism) */}
      {activeTab !== 'home' && (
        <div
          className={`selene-workspace-shell flex-1 flex flex-col pt-14 min-w-0 max-w-full overflow-x-clip ${
            resolvedTheme === 'light' ? 'light-editorial' : 'dark'
          }`}
        >
          {/* Persistent Sticky Mission Timeline Toolbar directly below Editorial Navbar */}
          <UnifiedMissionClockDock
            solarElevationDeg={ephemeris.solarHorizon.elevationDeg}
            solarAzimuthDeg={ephemeris.solarHorizon.azimuthDeg}
            solarTerrainVis={physicalState.solarTerrainVis}
            earthElevationDeg={ephemeris.earthHorizon.elevationDeg}
            dteLinkMarginDb={physicalState.dteLinkMarginDb}
            dteLinkFeasible={physicalState.dteLinkFeasible}
            effectivePowerKw={physicalState.effectiveElectricalPowerKw}
            events={timelineAnalysis.events}
          />

          {/* Top Breadcrumb & Active Mission Context Bar */}
          <div className="bg-[var(--selene-surface)] border-b border-[var(--selene-border)] px-3 sm:px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 min-w-0">
            {/* Left: Sidebar Toggle + Breadcrumb + Active Site Selector + Status Classification */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs font-mono min-w-0 w-full xl:w-auto">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand Workspace Navigation' : 'Collapse Workspace Navigation'}
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] transition-colors shrink-0"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
                <span>{sidebarCollapsed ? 'Menu' : 'Collapse'}</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] min-w-0">
                <span className="text-[var(--selene-text-muted)] truncate">{activeNavMeta.group}</span>
                <span className="text-[var(--selene-text-muted)]">/</span>
                <span className="font-bold text-[var(--selene-text)] truncate">{activeNavMeta.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
                <label htmlFor="global-site-selector" className="text-[var(--selene-text-muted)] font-semibold shrink-0">
                  SITE:
                </label>
                <select
                  id="global-site-selector"
                  aria-label="Select Active Lunar Landing Site"
                  value={activeSite.id}
                  onChange={(e) => setActiveSiteId(e.target.value)}
                  className="min-w-0 w-full sm:w-auto max-w-full sm:max-w-[340px] px-2.5 py-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] font-semibold truncate focus:outline-none focus:border-[var(--selene-accent-earth)]"
                >
                  {effectiveSites.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.designation} — {st.name} (
                      {st.latitude < 0
                        ? `${Math.abs(st.latitude).toFixed(2)}°S`
                        : `${st.latitude.toFixed(2)}°N`}
                      , {st.longitude.toFixed(2)}°E)
                    </option>
                  ))}
                </select>
                <SiteStatusBadge site={activeSite} showTooltip />
              </div>
            </div>

            {/* Right: Epoch, Configurable Duration, Sampling Resolution, Mode & Theme Switcher */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <label htmlFor="global-landing-datetime" className="text-[#F3EEE3]/60">
                  EPOCH UTC:
                </label>
                <input
                  id="global-landing-datetime"
                  type="datetime-local"
                  value={simulationEpochUtc.slice(0, 16)}
                  onChange={(e) => handleGlobalDateTimeChange(e.target.value)}
                  className="px-2 py-1 bg-[#181818] border border-[#2D2D2D] text-[#F3EEE3] tabular-nums focus:outline-none focus:border-[#D9541E]"
                />
                <button
                  type="button"
                  onClick={() => handleStepLunarDay(1)}
                  title="Advance 24 Hours (+1d)"
                  className="px-2 py-1 bg-[#181818] border border-[#2D2D2D] text-[#F3EEE3]/80 hover:border-[#00E5FF]"
                >
                  +24h
                </button>
                <button
                  type="button"
                  onClick={() => handleStepLunarDay(14)}
                  title="Advance 14 Days (Half Synodic Cycle)"
                  className="px-2 py-1 bg-[#181818] border border-[#2D2D2D] text-[#D9541E] hover:border-[#D9541E]"
                >
                  +14d
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="global-mission-duration" className="text-[#F3EEE3]/60">
                  WINDOW:
                </label>
                <select
                  id="global-mission-duration"
                  value={
                    [1, 7, 14, 29.53].includes(Number(missionDurationDays.toFixed(2)))
                      ? String(Number(missionDurationDays.toFixed(2)))
                      : 'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom') {
                      setMissionDurationDays(Number(val));
                    }
                  }}
                  className="px-2 py-1 bg-[#181818] border border-[#2D2D2D] text-[#F3EEE3] font-semibold"
                >
                  <option value="1">24 Hours (1d)</option>
                  <option value="7">7 Days (168h)</option>
                  <option value="14">14 Days (336h)</option>
                  <option value="29.53">~29.53 Days (1 Synodic)</option>
                  <option value="custom">Custom ({missionDurationDays}d)</option>
                </select>
              </div>

              {/* Theme Switcher: System / Light / Dark */}
              <div
                role="group"
                aria-label="Workspace Theme Mode"
                className="inline-flex items-center bg-[#181818] border border-[#2D2D2D] p-0.5"
              >
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'Auto', icon: Monitor },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  const active = themePreference === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setThemePreference(mode.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono transition-colors ${
                        active
                          ? 'bg-[#111111] text-[#00E5FF] font-bold border border-[#2D2D2D]'
                          : 'text-[#F3EEE3]/65 hover:text-[#F3EEE3]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsEduMode(!isEduMode)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border transition-colors whitespace-nowrap shrink-0 ${
                  isEduMode
                    ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E] font-bold'
                    : 'bg-[#181818] border-[#2D2D2D] text-[#00E5FF] font-semibold hover:border-[#00E5FF]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isEduMode ? 'Explorer Mode' : 'Engineering (±1σ)'}</span>
              </button>
            </div>
          </div>

          {/* Main Split Console: Collapsible Left Rail + Spacious Editorial Workspace Stage */}
          <div className="flex-1 flex flex-col lg:flex-row min-w-0">
            <aside
              aria-label="Workspace Modules Sidebar"
              className={`hidden lg:flex w-full ${
                sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
              } shrink-0 bg-[var(--selene-surface)] border-r border-[var(--selene-border)] p-3 flex-col justify-between transition-all duration-200 min-w-0`}
            >
              <div className="space-y-3 min-w-0">
                {Object.entries(groupedWorkspaceItems).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="space-y-1 min-w-0">
                    {!sidebarCollapsed && (
                      <div className="px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest text-[var(--selene-text-muted)] uppercase">
                        {groupTitle}
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-w-full">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            title={`${item.shortCode} — ${item.label}`}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center ${
                              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                            } gap-2 text-[11.5px] font-mono transition-colors whitespace-nowrap shrink-0 border ${
                              isActive
                                ? 'bg-[var(--selene-surface-alt)] text-[var(--selene-accent-earth)] border-[var(--selene-accent-earth)] font-bold'
                                : 'text-[var(--selene-text-secondary)] hover:bg-[var(--selene-surface-alt)] hover:text-[var(--selene-text)] border-transparent'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  isActive ? 'text-[var(--selene-accent-solar)]' : 'text-[var(--selene-text-muted)]'
                                }`}
                              />
                              {!sidebarCollapsed && <span>{item.label}</span>}
                            </span>
                            {!sidebarCollapsed && (
                              <span className="text-[10px] text-[var(--selene-text-muted)] tabular-nums">
                                {item.shortCode}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Database Provenance Summary */}
              {!sidebarCollapsed && (
                <div className="hidden lg:block mt-6 p-3.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] space-y-2 text-[11px] font-mono">
                  <div className="text-[var(--selene-accent-solar)] font-bold flex items-center justify-between">
                    <span>LIVE DB PROVENANCE</span>
                    <span className="text-[var(--selene-accent-green)]">ONLINE</span>
                  </div>
                  <div className="space-y-1 text-[var(--selene-text-secondary)]">
                    <div className="flex justify-between">
                      <span>Sites in DB:</span>
                      <span className="font-bold text-[var(--selene-text)]">{effectiveSites.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Datasets Registered:</span>
                      <span className="font-bold text-[var(--selene-text)]">{datasets.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ephemeris Kernel:</span>
                      <span className="font-bold text-[var(--selene-accent-earth)]">
                        {liveHorizonsOverride ? 'JPL-HORIZONS-DE441' : 'DE441-MOON_ME'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wall UTC:</span>
                      <LiveUtcClockText />
                    </div>
                  </div>
                  {apiWarnings.length > 0 && (
                    <div className="pt-2 border-t border-[var(--selene-border)] text-[10px] text-[var(--selene-accent-amber)]">
                      NOTE: {apiWarnings[0]?.code}
                    </div>
                  )}
                </div>
              )}
            </aside>

            {/* Active Workspace Stage */}
            <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 overflow-y-auto space-y-6 sm:space-y-8 max-w-[1680px] mx-auto w-full">
              {/* Explorer Mode Banner */}
              {isEduMode && (
                <div className="bg-[var(--selene-surface)] border border-[var(--selene-accent-green)]/50 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-4xl">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--selene-accent-green)]">
                      EXPLORER MODE ACTIVE — PLAIN-ENGLISH ASTRODYNAMICS INTERPRETATION
                    </div>
                    <p className="text-sm text-[var(--selene-text-secondary)] leading-relaxed">
                      At <strong className="text-[var(--selene-text)]">{activeSite.name}</strong> (
                      {activeSite.latitude < 0
                        ? `${Math.abs(activeSite.latitude).toFixed(2)}°S`
                        : `${activeSite.latitude.toFixed(2)}°N`}
                      ), the Moon’s 1.54° axial tilt keeps the Sun grazing near the polar horizon while crater
                      interiors remain below 40 K. Earth weaves <strong className="text-[var(--selene-text)]">±6.7°</strong> due to orbital libration
                      (modeled via <code>DE441-MOON_ME</code>). Switch to <strong className="text-[var(--selene-text)]">Engineering Mode</strong> to
                      inspect raw JD(TDB) epochs, Ka-band link margins, and ±1σ uncertainty bounds.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEduMode(false)}
                    className="px-3.5 py-2 text-xs font-mono font-bold bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)] shrink-0"
                  >
                    Switch to Engineering Mode
                  </button>
                </div>
              )}

              {/* Render Active Hash Route Workspace */}
              {activeTab === 'overview' && (
                <OverviewWorkspace
                  sites={effectiveSites}
                  activeSite={activeSite}
                  onSelectSite={setActiveSiteId}
                  shaderMode={globeShaderMode}
                  onChangeShaderMode={setGlobeShaderMode}
                  simulationEpochUtc={simulationEpochUtc}
                  solarHorizon={ephemeris.solarHorizon}
                  earthHorizon={ephemeris.earthHorizon}
                  subSolarLatDeg={ephemeris.subSolarLatDeg}
                  subSolarLonDeg={ephemeris.subSolarLonDeg}
                  physicalState={physicalState}
                  timelineAnalysis={timelineAnalysis}
                  onNavigateTab={setActiveTab}
                  isEduMode={isEduMode}
                />
              )}

              {activeTab === 'explorer' && (
                <ExplorerWorkspace
                  sites={effectiveSites}
                  activeSite={activeSite}
                  onSelectSite={setActiveSiteId}
                  onSiteCreated={(newSite) => {
                    setSites([...effectiveSites, newSite]);
                    setActiveSiteId(newSite.id);
                  }}
                  shaderMode={globeShaderMode}
                  onChangeShaderMode={setGlobeShaderMode}
                  subSolarLatDeg={ephemeris.subSolarLatDeg}
                  subSolarLonDeg={ephemeris.subSolarLonDeg}
                  savedComparisonSiteIds={savedComparisonSiteIds}
                  onToggleSavedSite={toggleSavedComparisonSite}
                  explorerViewMode={explorerViewMode}
                  onChangeExplorerViewMode={setExplorerViewMode}
                  horizonProfile={horizonProfile}
                  solarHorizon={ephemeris.solarHorizon}
                  earthHorizon={ephemeris.earthHorizon}
                  constraints={constraints}
                  onNavigateComparison={() => setActiveTab('comparison')}
                />
              )}

              {activeTab === 'lunar-bases' && (
                <LunarBasesWorkspace
                  activeSiteId={activeSite.id}
                  onSelectSeleneSite={setActiveSiteId}
                  onNavigateTo3DGlobe={(siteId) => {
                    setActiveSiteId(siteId);
                    setExplorerViewMode('3d-terrain');
                    setActiveTab('explorer');
                  }}
                  onNavigateToSitePhysics={(siteId) => {
                    setActiveSiteId(siteId);
                    setActiveTab('site-analysis');
                  }}
                />
              )}

              {activeTab === 'site-analysis' && (
                <SiteAnalysisWorkspace
                  site={activeSite}
                  simulationEpochUtc={simulationEpochUtc}
                  onChangeEpochUtc={setSimulationEpochUtc}
                  missionStartDateUtc={missionStartDateUtc}
                  horizonProfile={horizonProfile}
                  solarHorizon={ephemeris.solarHorizon}
                  earthHorizon={ephemeris.earthHorizon}
                  physicalState={physicalState}
                  timeScales={timeScales}
                  constraints={constraints}
                  onChangeConstraints={setConstraints}
                  timelineAnalysis={timelineAnalysis}
                  isEduMode={isEduMode}
                />
              )}

              {activeTab === 'simulator' && (
                <div className="space-y-6">
                  <SimulatorWorkspace
                    site={activeSite}
                    simulationEpochUtc={simulationEpochUtc}
                    onChangeEpochUtc={setSimulationEpochUtc}
                    missionStartDateUtc={missionStartDateUtc}
                    constraints={constraints}
                    horizonProfile={horizonProfile}
                    solarHorizon={ephemeris.solarHorizon}
                    earthHorizon={ephemeris.earthHorizon}
                    timelineAnalysis={timelineAnalysis}
                  />
                  <NasaLiveIntegrationPanel
                    siteId={activeSite.id}
                    siteName={activeSite.name}
                    siteLatDeg={activeSite.latitude}
                    siteLonDeg={activeSite.longitude}
                    siteElevationKm={activeSite.elevation_km}
                    simulationEpochUtc={simulationEpochUtc}
                  />
                </div>
              )}

              {activeTab === 'comparison' && (
                <ComparisonWorkspace
                  sites={effectiveSites}
                  activeSite={activeSite}
                  scenarios={scenarios}
                  selectedScenarioIds={selectedComparisonIds}
                  onChangeSelectedScenarioIds={setSelectedComparisonIds}
                  savedComparisonSiteIds={savedComparisonSiteIds}
                  onToggleSavedSite={toggleSavedComparisonSite}
                  onScenarioCreated={(newScen: ScenarioRecord) => {
                    setScenarios([newScen, ...scenarios]);
                    setSelectedComparisonIds([
                      newScen.id,
                      selectedComparisonIds[0] ?? 'scen-artemis-iii-shackleton',
                      selectedComparisonIds[1] ?? 'scen-clps-malapert-relay',
                    ]);
                  }}
                  globalConstraints={constraints}
                  missionStartDateUtc={missionStartDateUtc}
                  missionDurationDays={missionDurationDays}
                  mcdaWeights={mcdaWeights}
                  onChangeMcdaWeights={setMcdaWeights}
                  isEduMode={isEduMode}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineWorkspace
                  site={activeSite}
                  timelineAnalysis={timelineAnalysis}
                  missionStartDateUtc={missionStartDateUtc}
                  onChangeStartDateUtc={setMissionStartDateUtc}
                  missionDurationDays={missionDurationDays}
                  onChangeDurationDays={setMissionDurationDays}
                  samplingStepHours={samplingStepHours}
                  onChangeSamplingStepHours={setSamplingStepHours}
                  onSelectEpochUtc={setSimulationEpochUtc}
                  onOpenDataHub={() => setActiveTab('reports')}
                />
              )}

              {activeTab === 'moon-trek' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    <div className="lg:col-span-4">
                      <LayerControl
                        layers={moonTrekLayers}
                        activeCategory={moonTrekCategory}
                        onSelectCategory={setMoonTrekCategory}
                        onToggleVisibility={toggleMoonTrekLayerVisibility}
                        onChangeOpacity={setMoonTrekLayerOpacity}
                        highlightedLayerId={highlightedLayerId}
                        onSelectHighlight={setHighlightedLayerId}
                        projection={moonTrekProjection}
                        onChangeProjection={setMoonTrekProjection}
                        showGraticule={showGraticule}
                        onToggleGraticule={setShowGraticule}
                        solarAzimuthDeg={moonTrekSolarAzimuthDeg}
                        onChangeSolarAzimuth={setMoonTrekSolarAzimuthDeg}
                      />
                    </div>
                    <div className="lg:col-span-8 min-w-0">
                      <MoonTrekViewer
                        layers={moonTrekLayers}
                        highlightedLayerId={highlightedLayerId}
                        projection={moonTrekProjection}
                        showGraticule={showGraticule}
                        solarAzimuthDeg={ephemeris.solarHorizon.azimuthDeg || moonTrekSolarAzimuthDeg}
                        sites={effectiveSites}
                        activeSiteId={activeSite.id}
                        onSelectSite={setActiveSiteId}
                      />
                    </div>
                  </div>
                  <NasaLiveIntegrationPanel
                    siteId={activeSite.id}
                    siteName={activeSite.name}
                    siteLatDeg={activeSite.latitude}
                    siteLonDeg={activeSite.longitude}
                    siteElevationKm={activeSite.elevation_km}
                    simulationEpochUtc={simulationEpochUtc}
                  />
                  <ScientificRechartsDeck
                    siteLatDeg={activeSite.latitude}
                    siteLonDeg={activeSite.longitude}
                    timelineAnalysis={timelineAnalysis}
                    defaultTab="elevation-profile"
                  />
                  <DatasetIntegrationSlot
                    domain="TERRAIN_ELEVATION_DEM"
                    activeDatabaseCount={datasets.length}
                    activeSourceLabel="LRO LOLA LDEM_80S v1.4 GDS (5m/px) & LROC WAC CDR v2.1"
                    onOpenDataHub={() => setActiveTab('reports')}
                  />
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <NasaLiveIntegrationPanel
                    siteId={activeSite.id}
                    siteName={activeSite.name}
                    siteLatDeg={activeSite.latitude}
                    siteLonDeg={activeSite.longitude}
                    siteElevationKm={activeSite.elevation_km}
                    simulationEpochUtc={simulationEpochUtc}
                  />
                  <ReportsWorkspace
                    sites={effectiveSites}
                    activeSite={activeSite}
                    datasets={datasets}
                    timelineAnalysis={timelineAnalysis}
                    constraints={constraints}
                    missionStartDateUtc={missionStartDateUtc}
                    missionDurationDays={missionDurationDays}
                  />
                </div>
              )}

              {activeTab === 'settings' && (
                <SettingsWorkspace
                  constraints={constraints}
                  onChangeConstraints={setConstraints}
                  mcdaWeights={mcdaWeights}
                  onChangeMcdaWeights={setMcdaWeights}
                  providerMode={providerMode}
                  onChangeProviderMode={setProviderMode}
                  isEduMode={isEduMode}
                  onToggleEduMode={setIsEduMode}
                  themePreference={themePreference}
                  onChangeThemePreference={setThemePreference}
                />
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
