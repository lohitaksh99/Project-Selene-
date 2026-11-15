'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  Info,
  Mountain,
  Radio,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import {
  INTRO_CANDIDATE_SITES,
  type ChallengeId,
  type IntroLandingSite,
} from './introMissionData';

interface IntroMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSite: (site: IntroLandingSite) => void;
  onEnterMissionControl: () => void;
  initialChallengeId?: ChallengeId;
}

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
      'South pole terrain models allow precise slope gradient mapping (<8° safe touchdown envelope).',
    ],
    keyParameters: [
      { label: 'Max Relief Delta', value: '~9.0 km' },
      { label: 'Dataset Source', value: 'LOLA / LRO Grids' },
      { label: 'Evaluation Goal', value: 'High plateau identification' },
    ],
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
      'Permanently Shadowed Regions (PSRs) serve as cold-traps harboring water ice volatiles.',
    ],
    keyParameters: [
      { label: 'Lunar Axial Tilt', value: '1.54°' },
      { label: 'Peak Illumination', value: '86% – 92%' },
      { label: 'PSR Cold Trap Temp', value: '< 40 Kelvin' },
    ],
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
      'Local topography can occult the Earth disk when landing inside depression floors or behind crater rims.',
      'Elevated promontories (such as Malapert Peak) maintain unobstructed direct sightlines to Earth ground stations.',
    ],
    keyParameters: [
      { label: 'Libration Range', value: '±6.7° oscillation' },
      { label: 'LOS Geometry', value: 'Near-horizon line-of-sight' },
      { label: 'Topographic Masking', value: 'Occultation risk at low elevations' },
    ],
  },
  {
    id: 'comms',
    index: '04',
    title: 'Communication Windows',
    subtitle: 'Deep Space Network link availability & transmission constraints',
    icon: Radio,
    accentColor: '#34d399',
    whyItMatters:
      'Continuous telemetry, command links, and high-bandwidth science data downlinks depend on predictable communication windows. Without direct line-of-sight to Earth or lunar relay satellites, ground operations face blackout periods.',
    technicalDetails: [
      'Direct-to-Earth (DTE) communication connects directly with NASA Deep Space Network (Goldstone, Madrid, Canberra).',
      'Communication availability correlates directly with Earth visibility angle above local terrain obstacles.',
      'Sites with >85% annual Earth visibility provide robust telemetry links with minimal relay reliance.',
    ],
    keyParameters: [
      { label: 'Link Type', value: 'Direct-to-Earth (DTE)' },
      { label: 'DSN Frequency Bands', value: 'S-band / X-band / Ka-band' },
      { label: 'Critical Constraint', value: 'Zero blackout during descent' },
    ],
  },
  {
    id: 'safety',
    index: '05',
    title: 'Landing Safety',
    subtitle: 'Slope hazards, boulder dispersion & touchdown stability envelopes',
    icon: ShieldCheck,
    accentColor: '#f43f5e',
    whyItMatters:
      'Touchdown is the most hazardous phase of any lunar flight. The landing system must safely touch down without tipping over, striking meter-scale boulders, or sliding down steep crater walls.',
    technicalDetails: [
      'Critical slope threshold for Artemis/commercial landers is <8° to ensure vertical stability on contact.',
      'Crater rims offer smooth plateaus, while adjacent inner walls often exceed 25°–35°.',
      'Autonomous Terrain Relative Navigation (TRN) requires uniform regolith lighting and slope clearance.',
    ],
    keyParameters: [
      { label: 'Max Safe Slope', value: '< 8° threshold' },
      { label: 'Landing Ellipse', value: '100m – 300m radius' },
      { label: 'Hazard Avoidance', value: 'Boulder & scarp clearance' },
    ],
  },
];

export const IntroMissionModal: React.FC<IntroMissionModalProps> = ({
  isOpen,
  onClose,
  onSelectSite,
  onEnterMissionControl,
  initialChallengeId,
}) => {
  const [activeTab, setActiveTab] = useState<'challenges' | 'sites'>('challenges');
  const [selectedChallengeId, setSelectedChallengeId] = useState<ChallengeId>(
    initialChallengeId ?? 'terrain'
  );

  if (!isOpen) return null;

  const activeChallenge =
    SCIENTIFIC_CHALLENGES.find((c) => c.id === selectedChallengeId) || SCIENTIFIC_CHALLENGES[0]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#070b14] border border-white/15 shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#050810]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wider">PROJECT SELENE</span>
                <span className="text-[11px] font-mono text-slate-400">
                  / NASA LUNAR SOUTH POLE MISSION CONTROL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                FIVE SCIENTIFIC CONSTRAINTS &amp; CANDIDATE TOUCHDOWN SITES
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close mission overview"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Switcher */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/10 bg-black/40 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('challenges')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'challenges'
                  ? 'bg-white text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              5 SCIENTIFIC CONSIDERATIONS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sites')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'sites'
                  ? 'bg-white text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              6 SURVEYED CANDIDATE SITES
            </button>
          </div>

          <span className="text-[10px] text-slate-400 hidden sm:inline">
            BEFORE WE LAND, WE UNDERSTAND
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'challenges' && (
            <div className="space-y-6">
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

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SCIENTIFIC_CHALLENGES.map((ch) => {
                  const Icon = ch.icon;
                  const isSelected = ch.id === selectedChallengeId;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChallengeId(ch.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-white/10 border-white/30 text-white'
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

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
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

                    <p className="text-xs font-mono text-slate-400 mb-4">{activeChallenge.subtitle}</p>

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
                        Technical Observations &amp; Constraints:
                      </span>
                      {activeChallenge.technicalDetails.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

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

                <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-black/50 border border-white/10">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10 text-[10px] font-mono text-slate-400">
                    <span>TECHNICAL PARAMETERS // {activeChallenge.id.toUpperCase()}</span>
                    <span className="text-sky-300">SCHEMATIC SUMMARY</span>
                  </div>

                  <div className="flex-1 flex flex-col justify-center gap-3 py-4">
                    {activeChallenge.keyParameters.map((kp) => (
                      <div
                        key={kp.label}
                        className="p-3 rounded-lg bg-[#040711] border border-white/10 flex items-center justify-between font-mono text-xs"
                      >
                        <span className="text-slate-400">{kp.label}</span>
                        <span className="text-sky-300 font-semibold">{kp.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-white/10">
                    <span>SELECTION CRITERION</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sites')}
                      className="text-sky-300 hover:text-white underline cursor-pointer"
                    >
                      Compare 6 Candidate Sites &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sites' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-sans font-bold text-base text-white">
                  Candidate Landing Sites (South Pole &amp; Equatorial Benchmark)
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Select any site to inspect geodetic coordinates on the 3D Moon.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INTRO_CANDIDATE_SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSite(s);
                      onClose();
                    }}
                    className="group p-4 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 hover:border-white/30 transition-colors cursor-pointer flex flex-col justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
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

                    <div className="space-y-2 pt-2 border-t border-white/10 text-[11px] font-mono w-full">
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

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-sky-400 group-hover:text-white transition-colors w-full">
                      <span>Inspect 3D Surface Coordinates</span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#050810]">
          <div className="text-[11px] font-mono text-slate-400 text-center sm:text-left">
            Project Selene evaluation dashboard is ready for site-scoring.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 font-sans text-xs transition-colors cursor-pointer w-1/2 sm:w-auto"
            >
              Back to 3D Orbit
            </button>

            <button
              type="button"
              onClick={onEnterMissionControl}
              className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-[#F1F52E] text-slate-950 font-sans font-semibold text-xs tracking-wide transition-colors shadow-md cursor-pointer w-1/2 sm:w-auto"
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
