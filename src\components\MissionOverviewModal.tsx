import React, { useState, useEffect } from 'react';
import { CANDIDATE_LANDING_SITES, MISSION_CONTROL_URL } from '../config/missionConfig';
import { LandingSite } from '../types/mission';
import {
  X,
  Mountain,
  Sun,
  Radio,
  Eye,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Info
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface MissionOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSite: (site: LandingSite) => void;
  onEnterMissionControl: () => void;
  initialChallengeId?: ChallengeId;
}

export type ChallengeId = 'terrain' | 'sunlight' | 'earth_vis' | 'comms' | 'safety';

interface ScientificChallenge {
  id: ChallengeId;
  index: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  whyItMatters: string;
  technicalDetails: string[];
  keyParameters: { label: string; value: string }[];
  diagramType: 'terrain' | 'sunlight' | 'earth_vis' | 'comms' | 'safety';
}

const SCIENTIFIC_CHALLENGES: ScientificChallenge[] = [
  {
    id: 'terrain',
    index: '01',
    title: 'Terrain and Elevation',
    subtitle: 'Lunar topography, elevation profiles and slope constraints',
    icon: Mountain,
    accentColor: '#38bdf8',
    whyItMatters:
      'The lunar south pole features dramatic topographic relief, from deep impact depressions like Shackleton crater (-4.2 km) to towering massifs like Malapert Mountain (+5.0 km). Accurate elevation and local slope profiling are paramount to identify flat plateaus and avoid treacherous scarps.',
    technicalDetails: [
      'Topographic data derived from Lunar Orbiter Laser Altimeter (LOLA) 50m precision elevation grids.',
      'Elevation differences of up to 9 kilometers across short lateral distances create severe local shadowing.',
      'South pole terrain models allow precise slope gradient mapping (<8° safe touchdown envelope).'
    ],
    keyParameters: [
      { label: 'Max Relief Delta', value: '~9.0 km' },
      { label: 'Dataset Source', value: 'LOLA / LRO Grids' },
      { label: 'Evaluation Goal', value: 'High plateau identification' }
    ],
    diagramType: 'terrain'
  },
  {
    id: 'sunlight',
    index: '02',
    title: 'Sunlight Conditions',
    subtitle: 'Grazing solar elevation angles & permanently shadowed regions (PSRs)',
    icon: Sun,
    accentColor: '#fbbf24',
    whyItMatters:
      'Because the Moon has an axial tilt of only 1.54°, the Sun skims across the south polar horizon at extremely low grazing angles. High ridges receive prolonged solar illumination (up to 86–92% of the year), while crater interiors remain plunged into permanent cryogenic shadow below 40 Kelvin.',
    technicalDetails: [
      'Grazing solar incidence angles (<1.5° above local horizon) cast long, dynamic surface shadows.',
      'Peaks of eternal light provide continuous photovoltaic generation for landers and habitats.',
      'Permanently Shadowed Regions (PSRs) serve as cold-traps harboring billions of tons of water ice volatiles.'
    ],
    keyParameters: [
      { label: 'Lunar Axial Tilt', value: '1.54°' },
      { label: 'Peak Illumination', value: '86% – 92%' },
      { label: 'PSR Cold Trap Temp', value: '< 40 Kelvin' }
    ],
    diagramType: 'sunlight'
  },
  {
    id: 'earth_vis',
    index: '03',
    title: 'Earth Visibility',
    subtitle: 'Direct line-of-sight geometry & lunar libration effects',
    icon: Eye,
    accentColor: '#a855f7',
    whyItMatters:
      'Direct line-of-sight to Earth is required for uninterrupted mission telemetry and crew safety. Because the lunar south pole sits near the limb of the visible disc, Earth hovers very close to the northern horizon and dips below surrounding topography during lunar libration cycles.',
    technicalDetails: [
      'Earth appears permanently low on the horizon, oscillating by ±6.7° due to lunar libration in latitude.',
      'Local topography can easily occult the Earth disk if landing in depression floors or behind mountain rims.',
      'Elevated promontories (such as Malapert Peak) maintain unobstructed direct sightlines back to Earth ground stations.'
    ],
    keyParameters: [
      { label: 'Libration Range', value: '±6.7° oscillation' },
      { label: 'LOS Geometry', value: 'Near-horizon line-of-sight' },
      { label: 'Topographic Masking', value: 'Occultation risk at low elevations' }
    ],
    diagramType: 'earth_vis'
  },
  {
    id: 'comms',
    index: '04',
    title: 'Communication Windows',
    subtitle: 'Deep Space Network link availability & transmission constraints',
    icon: Radio,
    accentColor: '#34d399',
    whyItMatters:
      'Continuous telemetry, command links, and high-bandwidth science data downlinks depend on predictable communication windows. Without a direct line-of-sight to Earth or lunar relay satellites, ground operations face complete blackout periods.',
    technicalDetails: [
      'Direct-to-Earth (DTE) communication connects directly with NASA Deep Space Network (Goldstone, Madrid, Canberra).',
      'Communication availability is correlated directly with Earth visibility angle above local terrain obstacles.',
      'Sites with >85% annual Earth visibility provide robust telemetry links with minimal reliance on relay constellations.'
    ],
    keyParameters: [
      { label: 'Link Type', value: 'Direct-to-Earth (DTE)' },
      { label: 'DSN Frequency Bands', value: 'S-band / X-band / Ka-band' },
      { label: 'Critical Constraint', value: 'Zero communication blackout during descent' }
    ],
    diagramType: 'comms'
  },
  {
    id: 'safety',
    index: '05',
    title: 'Landing Safety',
    subtitle: 'Slope hazards, boulder dispersion & touchdown stability envelopes',
    icon: ShieldCheck,
    accentColor: '#f43f5e',
    whyItMatters:
      'Touchdown is the most hazardous phase of any lunar flight. The landing system must safely touch down without tipping over, striking meter-scale boulders, or sliding down steep crater walls. Candidate sites must provide sufficiently wide hazard-free landing ellipses.',
    technicalDetails: [
      'Critical slope threshold for typical Artemis/commercial landers is <8° to ensure vertical stability upon leg contact.',
      'Crater rims offer relatively smooth plateaus, but adjacent inner slopes often exceed 25°–35°.',
      'Autonomous Terrain Relative Navigation (TRN) and Hazard Detection and Avoidance (HDA) require uniform surface textures.'
    ],
    keyParameters: [
      { label: 'Max Safe Slope', value: '< 8° threshold' },
      { label: 'Landing Ellipse', value: '100m – 300m designated radius' },
      { label: 'Hazard Avoidance', value: 'Boulder & scarp clearance' }
    ],
    diagramType: 'safety'
  }
];

export const MissionOverviewModal: React.FC<MissionOverviewModalProps> = ({
  isOpen,
  onClose,
  onSelectSite,
  onEnterMissionControl,
  initialChallengeId
}) => {
  const [activeTab, setActiveTab] = useState<'challenges' | 'sites'>('challenges');
  const [selectedChallengeId, setSelectedChallengeId] = useState<ChallengeId>('terrain');

  useEffect(() => {
    if (initialChallengeId) {
      setSelectedChallengeId(initialChallengeId);
      setActiveTab('challenges');
    }
  }, [initialChallengeId, isOpen]);

  if (!isOpen) return null;

  const activeChallenge =
    SCIENTIFIC_CHALLENGES.find(c => c.id === selectedChallengeId) || SCIENTIFIC_CHALLENGES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#070b14] border border-white/15 shadow-2xl overflow-hidden text-left">
        {/* ================= MODAL HEADER ================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#050810]/80">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wider">
                  PROJECT SELENE
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  / NASA LUNAR SOUTH POLE MISSION CONTROL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                FIVE SCIENTIFIC CONSTRAINTS &amp; CANDIDATE TOUCHDOWN SITES
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= PRIMARY NAVIGATION SWITCHER ================= */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/10 bg-black/40 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('challenges');
              }}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeTab === 'challenges'
                  ? 'bg-white text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              5 SCIENTIFIC CONSIDERATIONS
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('sites');
              }}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeTab === 'sites'
                  ? 'bg-white text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              6 SURVEYED CANDIDATE SITES
            </button>
          </div>

          <span className="text-[10px] text-slate-500 hidden sm:inline">
            BEFORE WE LAND, WE UNDERSTAND
          </span>
        </div>

        {/* ================= BODY CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {activeTab === 'challenges' && (
            <div className="space-y-6">
              {/* Introduction Callout */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                    Landing near the lunar south pole presents an unprecedented engineering challenge.
                    Unlike Apollo equatorial landings, south polar missions must navigate extreme topographic relief,
                    perpetual grazing sunlight, cryogenic shadow cold-traps, and near-horizon Earth line-of-sight constraints.
                  </p>
                </div>
              </div>

              {/* Horizontal 5 Challenge Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SCIENTIFIC_CHALLENGES.map(ch => {
                  const Icon = ch.icon;
                  const isSelected = ch.id === selectedChallengeId;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSelectedChallengeId(ch.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-white/10 border-white/30 text-white shadow-md'
                          : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-medium opacity-60">
                          {ch.index}
                        </span>
                        <Icon
                          className="w-4 h-4"
                          style={{ color: isSelected ? ch.accentColor : undefined }}
                        />
                      </div>
                      <span className="font-sans font-semibold text-xs leading-tight text-slate-100">
                        {ch.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Challenge Deep-Dive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                {/* Left 7 Columns: Technical Rationale & Parameters */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                        CONSIDERATION {activeChallenge.index} OF 05
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        PROJECT SELENE CORE FRAMEWORK
                      </span>
                    </div>

                    <h3 className="font-sans font-bold text-xl sm:text-2xl text-white mb-1.5 tracking-tight">
                      {activeChallenge.title}
                    </h3>

                    <p className="text-xs font-mono text-slate-400 mb-4">
                      {activeChallenge.subtitle}
                    </p>

                    <div className="mb-4">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 font-semibold">
                        Why It Matters to Landing-Site Selection:
                      </span>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                        {activeChallenge.whyItMatters}
                      </p>
                    </div>

                    <div className="space-y-2 mb-4">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1 font-semibold">
                        Technical Observations & Constraints:
                      </span>
                      {activeChallenge.technicalDetails.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Parameter Badges */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
                    {activeChallenge.keyParameters.map((param, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[9px] font-mono text-slate-500 uppercase block truncate">
                          {param.label}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-200 block truncate">
                          {param.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right 5 Columns: Restrained Technical Visualization Diagram */}
                <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-black/50 border border-white/10">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10 text-[10px] font-mono text-slate-400">
                    <span>TECHNICAL DIAGRAM // {activeChallenge.id.toUpperCase()}</span>
                    <span className="text-sky-300">SCHEMATIC MODEL</span>
                  </div>

                  {/* Bespoke Restrained Technical Visualizations */}
                  <div className="relative w-full h-52 flex items-center justify-center overflow-hidden rounded-lg bg-[#040711] border border-white/5 p-3">
                    {activeChallenge.diagramType === 'terrain' && (
                      <svg viewBox="0 0 240 140" className="w-full h-full text-slate-400 font-mono text-[8px]">
                        {/* Grid lines */}
                        <line x1="20" y1="20" x2="220" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                        <line x1="20" y1="60" x2="220" y2="60" stroke="#1e293b" strokeDasharray="3 3" />
                        <line x1="20" y1="100" x2="220" y2="100" stroke="#1e293b" strokeDasharray="3 3" />

                        {/* Topography Curve */}
                        <path
                          d="M 20 110 Q 50 105 70 80 T 110 30 Q 130 30 140 55 T 180 120 Q 200 125 220 115"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                        />
                        {/* Fill under terrain */}
                        <path
                          d="M 20 110 Q 50 105 70 80 T 110 30 Q 130 30 140 55 T 180 120 Q 200 125 220 115 L 220 135 L 20 135 Z"
                          fill="rgba(56, 189, 248, 0.08)"
                        />

                        {/* Peak label */}
                        <circle cx="110" cy="30" r="3.5" fill="#38bdf8" />
                        <text x="110" y="20" textAnchor="middle" fill="#bae6fd" fontWeight="bold">+5.0 km Peak</text>

                        {/* Crater depression label */}
                        <circle cx="180" cy="120" r="3.5" fill="#f43f5e" />
                        <text x="180" y="132" textAnchor="middle" fill="#fca5a5">-4.2 km Floor</text>

                        {/* Safe landing plateau highlight */}
                        <rect x="95" y="28" width="30" height="4" fill="#34d399" rx="1" />
                        <text x="50" y="55" fill="#94a3b8">Slope &lt; 8° Safe Zone</text>
                        <line x1="75" y1="52" x2="95" y2="35" stroke="#94a3b8" strokeDasharray="2 2" />
                      </svg>
                    )}

                    {activeChallenge.diagramType === 'sunlight' && (
                      <svg viewBox="0 0 240 140" className="w-full h-full font-mono text-[8px]">
                        {/* Horizon and Terrain */}
                        <path
                          d="M 20 110 Q 60 100 85 45 Q 115 50 130 125 Q 170 128 200 110 L 220 110"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2"
                        />
                        <path
                          d="M 85 45 Q 115 50 130 125 Q 170 128 200 110 L 220 110 L 220 135 L 20 135 L 20 110 Z"
                          fill="rgba(15, 23, 42, 0.8)"
                        />

                        {/* Low grazing sunlight vector rays (<1.5 deg) */}
                        <line x1="10" y1="35" x2="230" y2="42" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 2" />
                        <line x1="10" y1="45" x2="85" y2="47" stroke="#fbbf24" strokeWidth="2.5" />
                        <circle cx="85" cy="45" r="4" fill="#fbbf24" />

                        {/* Sunlight Label */}
                        <text x="35" y="30" fill="#fde047" fontWeight="bold">Grazing Solar Vector (~1.5°)</text>

                        {/* Shadow cone in crater */}
                        <path
                          d="M 85 45 L 220 54 L 220 135 L 130 125 Z"
                          fill="rgba(0, 0, 0, 0.75)"
                        />
                        <text x="170" y="90" textAnchor="middle" fill="#67e8f9" fontWeight="bold">Permanently Shadowed</text>
                        <text x="170" y="100" textAnchor="middle" fill="#94a3b8">Region (PSR) &lt; 40K</text>
                        <text x="85" y="25" textAnchor="middle" fill="#fde047">Peak of Light (92%)</text>
                      </svg>
                    )}

                    {activeChallenge.diagramType === 'earth_vis' && (
                      <svg viewBox="0 0 240 140" className="w-full h-full font-mono text-[8px]">
                        {/* Earth in the distance */}
                        <circle cx="205" cy="40" r="14" fill="#3b82f6" />
                        <path d="M 197 34 Q 205 32 208 40 Q 200 48 205 52" fill="#10b981" opacity="0.8" />
                        <circle cx="205" cy="40" r="16" fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
                        <text x="205" y="20" textAnchor="middle" fill="#93c5fd" fontWeight="bold">Earth Disc</text>

                        {/* Lunar terrain profile */}
                        <path
                          d="M 20 120 Q 60 70 90 70 Q 120 70 140 125 Q 180 125 220 120"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2"
                        />

                        {/* Direct Line-of-sight vector from peak */}
                        <line x1="90" y1="70" x2="190" y2="43" stroke="#a855f7" strokeWidth="2.5" />
                        <circle cx="90" cy="70" r="3.5" fill="#a855f7" />
                        <text x="90" y="60" textAnchor="middle" fill="#d8b4fe" fontWeight="bold">Malapert Massif</text>
                        <text x="135" y="48" fill="#e9d5ff">Clear Line of Sight (LOS)</text>

                        {/* Blocked line of sight from crater floor */}
                        <line x1="140" y1="125" x2="160" y2="100" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2 2" />
                        <text x="145" y="115" fill="#fca5a5">LOS Blocked</text>
                      </svg>
                    )}

                    {activeChallenge.diagramType === 'comms' && (
                      <svg viewBox="0 0 240 140" className="w-full h-full font-mono text-[8px]">
                        {/* Ground Station Antennas on Earth */}
                        <circle cx="30" cy="40" r="10" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
                        <path d="M 25 35 Q 30 25 35 35" fill="none" stroke="#34d399" strokeWidth="2" />
                        <text x="30" y="60" textAnchor="middle" fill="#6ee7b7">NASA DSN</text>

                        {/* High-frequency microwave link beam */}
                        <path
                          d="M 40 40 Q 115 15 190 60"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <text x="115" y="25" textAnchor="middle" fill="#a7f3d0" fontWeight="bold">X/Ka-Band Telemetry Link</text>

                        {/* Lander Receiver on elevated ridge */}
                        <circle cx="190" cy="60" r="4" fill="#34d399" />
                        <line x1="190" y1="60" x2="190" y2="75" stroke="#94a3b8" strokeWidth="2" />
                        <path d="M 170 75 Q 190 70 215 78 L 225 120 L 160 120 Z" fill="#1e293b" />
                        <text x="190" y="95" textAnchor="middle" fill="#f8fafc">Lander Receiver</text>
                        <text x="190" y="105" textAnchor="middle" fill="#94a3b8">&gt;85% Annual Link</text>
                      </svg>
                    )}

                    {activeChallenge.diagramType === 'safety' && (
                      <svg viewBox="0 0 240 140" className="w-full h-full font-mono text-[8px]">
                        {/* Terrain profile with flat safe spot and steep dangerous slope */}
                        <path
                          d="M 20 100 L 90 98 L 150 45 L 220 40"
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="2"
                        />

                        {/* Safe Lander (<8 degree slope) */}
                        <rect x="40" y="80" width="16" height="12" fill="#34d399" rx="2" />
                        <line x1="38" y1="92" x2="34" y2="99" stroke="#34d399" strokeWidth="2" />
                        <line x1="58" y1="92" x2="62" y2="99" stroke="#34d399" strokeWidth="2" />
                        <text x="48" y="73" textAnchor="middle" fill="#6ee7b7" fontWeight="bold">Stable (&lt;5°)</text>

                        {/* Unsafe Slope Hazard (>25 degrees) */}
                        <line x1="90" y1="98" x2="150" y2="45" stroke="#f43f5e" strokeWidth="2.5" />
                        <rect x="115" y="60" width="16" height="12" fill="#f43f5e" rx="2" transform="rotate(-35 123 66)" opacity="0.8" />
                        <text x="145" y="80" fill="#fca5a5" fontWeight="bold">Tip Hazard (&gt;25°)</text>
                        <text x="145" y="90" fill="#94a3b8">Crater Rim Scarp</text>
                      </svg>
                    )}
                  </div>

                  <div className="pt-3 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>SELECTION CRITERION</span>
                    <button
                      onClick={() => setActiveTab('sites')}
                      className="text-sky-300 hover:text-white underline cursor-pointer"
                    >
                      Compare against 6 Candidate Sites &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sites' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-bold text-base text-white">
                    Candidate Landing Sites (South Pole & Equatorial Benchmark)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Select any site to position the 3D Moon and inspect geodetic beacon coordinates.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CANDIDATE_LANDING_SITES.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onSelectSite(s);
                      onClose();
                    }}
                    className="group p-4 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 hover:border-white/30 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-sans font-semibold text-sm text-white group-hover:text-sky-300 transition-colors">
                          {s.name}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          {s.designation}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mb-3 font-light leading-relaxed">
                        {s.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/10 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Elevation:</span>
                        <span className="text-slate-200">{s.elevation}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Solar Illumination:</span>
                        <span className="text-amber-300 font-medium">{s.illuminationPct}% annual</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Volatile Ice Potential:</span>
                        <span className="text-sky-300">{s.icePotential}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Local Slope Risk:</span>
                        <span className="text-emerald-300">{s.slopeRisk}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-sky-400 group-hover:text-white transition-colors">
                      <span>Inspect 3D Surface Coordinates</span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER WITH MISSION CONTROL INTEGRATION ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#050810]/90">
          <div className="text-[11px] font-mono text-slate-400 text-center sm:text-left">
            <span>Project Selene evaluation dashboard is ready for site-scoring.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 font-sans text-xs transition-colors cursor-pointer w-1/2 sm:w-auto"
            >
              Back to 3D Orbit
            </button>

            <button
              onClick={() => {
                soundEngine.playUiClick();
                onEnterMissionControl();
              }}
              className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-sans font-semibold text-xs tracking-wide transition-all shadow-md cursor-pointer w-1/2 sm:w-auto"
            >
              <span>ENTER MISSION CONTROL</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
