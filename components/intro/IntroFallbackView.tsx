'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, Compass, Droplets, Mountain, Sun } from 'lucide-react';
import { INTRO_CANDIDATE_SITES } from './introMissionData';

interface IntroFallbackViewProps {
  onEnterMissionControl: () => void;
}

export const IntroFallbackView: React.FC<IntroFallbackViewProps> = ({
  onEnterMissionControl,
}) => {
  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 p-6 sm:p-12 font-sans flex flex-col justify-between overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0b3d91] flex items-center justify-center font-bold text-xs text-white">
            SL
          </div>
          <div>
            <h1 className="font-sans font-bold text-sm text-sky-300">
              PROJECT SELENE — LUNAR TOUCHDOWN INITIATIVE
            </h1>
            <p className="text-xs text-slate-500 font-mono">2D Compatibility Mode</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEnterMissionControl}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white cursor-pointer"
        >
          SKIP TO PROJECT SELENE
        </button>
      </header>

      <main className="max-w-4xl mx-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono">
          <AlertTriangle className="w-4 h-4" />
          <span>WebGL 3D Initialization Unavailable — Reduced Graphics Mode</span>
        </div>

        <p className="text-xs font-mono tracking-[0.2em] text-sky-300 uppercase mb-2">
          BEFORE WE LAND, WE UNDERSTAND.
        </p>

        <h2 className="font-sans font-black text-4xl sm:text-6xl text-white mb-4">
          NAVIGATE THE UNKNOWN.
        </h2>
        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 font-light leading-relaxed">
          Exploring the lunar south pole through terrain intelligence, illumination analysis, and landing-site evaluation.
        </p>

        <button
          type="button"
          onClick={onEnterMissionControl}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-[#F1F52E] text-black font-sans font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
        >
          <span>ENTER MISSION CONTROL</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-16 text-left">
          <h3 className="font-sans font-bold text-xl text-white mb-6 flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            <span>Artemis South Pole Candidate Landing Zones</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INTRO_CANDIDATE_SITES.map((site) => (
              <div
                key={site.id}
                className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-sans font-bold text-base text-white">{site.name}</h4>
                    <span className="text-[10px] font-mono text-sky-300 px-2 py-0.5 rounded bg-sky-950 border border-sky-500/30">
                      {site.designation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-4">{site.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-[11px] font-mono">
                  <div className="text-amber-300 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5" /> {site.illuminationPct}% Light
                  </div>
                  <div className="text-sky-300 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" /> {site.icePotential} Ice
                  </div>
                  <div className="text-emerald-300 flex items-center gap-1">
                    <Mountain className="w-3.5 h-3.5" /> {site.slopeRisk.split(' ')[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 border-t border-slate-900 pt-4">
        Project Selene — NASA Lunar South Pole Mission Control
      </footer>
    </div>
  );
};
