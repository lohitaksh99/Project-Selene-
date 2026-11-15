import React from 'react';
import { CANDIDATE_LANDING_SITES, MISSION_CONTROL_URL } from '../config/missionConfig';
import { ArrowRight, AlertTriangle, Sun, Droplets, Mountain, Compass } from 'lucide-react';

export const FallbackView: React.FC = () => {
  const handleLaunch = () => {
    if (MISSION_CONTROL_URL && MISSION_CONTROL_URL !== "YOUR_APPLICATION_URL") {
      window.open(MISSION_CONTROL_URL, '_blank');
    } else {
      alert("Mission Control URL is pending configuration in src/config/missionConfig.ts");
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 p-6 sm:p-12 font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0b3d91] flex items-center justify-center font-bold text-xs text-white">
            NASA
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-cyan-300">
              ARTEMIS LUNAR TOUCHDOWN INITIATIVE
            </h1>
            <p className="text-xs text-slate-500 font-mono">2D Compatibility Mode</p>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <main className="max-w-4xl mx-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono">
          <AlertTriangle className="w-4 h-4" />
          <span>WebGL Acceleration Disabled / Reduced Graphics Mode</span>
        </div>

        <h2 className="font-display font-black text-4xl sm:text-6xl text-white mb-4">
          THE MOON IS CALLING.
        </h2>
        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 font-light leading-relaxed">
          Every landing begins with a decision. Evaluate candidate lunar sites, compare environmental conditions, and find the right window to touch down.
        </p>

        <button
          onClick={handleLaunch}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-display font-bold text-sm uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(0,240,255,0.4)]"
        >
          <span>ENTER MISSION CONTROL</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Candidate Sites Grid */}
        <div className="mt-16 text-left">
          <h3 className="font-display font-bold text-xl text-white mb-6 flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>Artemis South Pole Candidate Landing Zones</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CANDIDATE_LANDING_SITES.map(site => (
              <div
                key={site.id}
                className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-display font-bold text-base text-white">{site.name}</h4>
                    <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30">
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

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 border-t border-slate-900 pt-4">
        NASA Space Apps / Hackathon Lunar Touchdown Evaluation Portal
      </footer>
    </div>
  );
};
