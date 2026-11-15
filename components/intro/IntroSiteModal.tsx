'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Droplets,
  Mountain,
  Sun,
  Thermometer,
  X,
} from 'lucide-react';
import { INTRO_CANDIDATE_SITES, type IntroLandingSite } from './introMissionData';

interface IntroSiteModalProps {
  site: IntroLandingSite | null;
  onClose: () => void;
  onSelectAnotherSite: (site: IntroLandingSite) => void;
  onEnterMissionControl: (site?: IntroLandingSite) => void;
}

export const IntroSiteModal: React.FC<IntroSiteModalProps> = ({
  site,
  onClose,
  onSelectAnotherSite,
  onEnterMissionControl,
}) => {
  if (!site) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-sans">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#090e1a] border border-white/15 shadow-2xl p-6 sm:p-7 text-left">
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider bg-white/10 text-slate-300">
                {site.designation}
              </span>
              {site.artemisPriority && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-sky-950 text-sky-300 border border-sky-800">
                  PRIORITY CANDIDATE
                </span>
              )}
            </div>
            <h2 className="font-sans font-bold text-xl sm:text-2xl text-white tracking-tight">
              {site.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close site dossier"
            className="p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Site Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-white/10 scrollbar-none text-xs font-mono">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 pr-1">
            Compare Sites:
          </span>
          {INTRO_CANDIDATE_SITES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectAnotherSite(s)}
              className={`px-2.5 py-1 rounded text-[10px] shrink-0 transition-colors cursor-pointer ${
                s.id === site.id
                  ? 'bg-white text-slate-950 font-semibold'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-400" /> Coordinates
            </span>
            <span className="font-mono text-sm font-semibold text-white mt-1">
              {site.lat > 0 ? `+${site.lat}` : site.lat}°
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {site.lng}° ({site.elevation})
            </span>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-400" /> Illumination
            </span>
            <span className="font-mono text-sm font-semibold text-amber-300 mt-1">
              {site.illuminationPct}%
            </span>
            <span className="font-mono text-[11px] text-slate-400">Solar Exposure Window</span>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-400" /> Volatiles / PSR
            </span>
            <span className="font-mono text-sm font-semibold text-sky-300 mt-1">
              {site.icePotential}
            </span>
            <span className="font-mono text-[11px] text-slate-400">Cold-Trap Proximity</span>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Mountain className="w-3 h-3 text-emerald-400" /> Terrain Slope
            </span>
            <span className="font-mono text-sm font-semibold text-emerald-300 mt-1">
              {site.slopeRisk.split(' ')[0]}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {site.slopeRisk.split(' ')[1] || '<5° Grade'}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
            Terrain &amp; Environmental Profile
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed font-light">{site.description}</p>
        </div>

        <div className="mb-4">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            Touchdown Site Objectives
          </h4>
          <div className="space-y-1.5">
            {site.scienceObjectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <span>{obj}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between text-xs font-mono mb-5 text-slate-300">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-slate-400" />
            <span>Thermal Envelope:</span>
          </div>
          <span className="text-slate-200 font-semibold">{site.thermalRange}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <span className="text-[11px] font-mono text-slate-400 text-center sm:text-left">
            Compare environmental conditions in Project Selene.
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-colors w-full sm:w-auto cursor-pointer"
            >
              Back to 3D Terrain
            </button>
            <button
              type="button"
              onClick={() => onEnterMissionControl(site)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-[#F1F52E] text-slate-950 font-medium text-xs transition-colors shadow-md w-full sm:w-auto cursor-pointer"
            >
              <span>Evaluate in Mission Control</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
