import React, { useState } from 'react';
import { ArrowRight, Compass, ExternalLink, Activity, SlidersHorizontal } from 'lucide-react';
import { MISSION_CONTROL_URL } from '../config/missionConfig';
import { soundEngine } from '../utils/soundEngine';
import { ChallengeId } from './MissionOverviewModal';

interface HeroSectionProps {
  onDiscoverMission: () => void;
  onOpenSitePicker: () => void;
  onOpenConstraint?: (id: ChallengeId) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onDiscoverMission,
  onOpenSitePicker,
  onOpenConstraint
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const handleEnterMissionControl = () => {
    soundEngine.playUiClick();

    // Check if teammate URL has been configured yet
    if (
      !MISSION_CONTROL_URL ||
      MISSION_CONTROL_URL === "YOUR_APPLICATION_URL" ||
      MISSION_CONTROL_URL.trim() === ""
    ) {
      setShowConfigModal(true);
    } else {
      window.open(MISSION_CONTROL_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCustomLaunch = () => {
    if (!customUrlInput) return;
    const finalUrl = customUrlInput.startsWith('http') ? customUrlInput : `https://${customUrlInput}`;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <section className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-end p-6 sm:p-12 pb-16 sm:pb-20 text-left">
        <div className="pointer-events-auto max-w-2xl flex flex-col items-start animate-fade-in">
          {/* Mission Designation Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-white/5 border border-white/15 text-slate-300 text-[11px] font-mono tracking-wider backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="font-semibold text-white tracking-widest">PROJECT SELENE</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">NASA LUNAR SOUTH POLE MISSION CONTROL</span>
          </div>

          {/* Headline (Requirement 2) */}
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl tracking-tight text-white mb-3 leading-[1.08]">
            NAVIGATE THE UNKNOWN.
          </h1>

          {/* Supporting Description (Requirement 2) */}
          <p className="font-sans text-sm sm:text-base md:text-lg text-slate-300 max-w-xl font-normal leading-relaxed mb-6">
            Exploring the lunar south pole through terrain intelligence, illumination analysis and landing-site evaluation.
          </p>

          {/* Primary & Secondary Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Primary CTA (Requirement 2) */}
            <button
              onClick={handleEnterMissionControl}
              className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-sans font-semibold text-sm tracking-wide transition-all duration-200 shadow-lg cursor-pointer"
            >
              <span>ENTER MISSION CONTROL</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-slate-950" />
            </button>

            {/* Secondary CTA: Explore the Mission (Requirement 3) */}
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onDiscoverMission();
              }}
              className="group flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-black/60 hover:bg-white/10 border border-white/20 hover:border-white/40 text-slate-200 font-sans font-medium text-sm transition-all duration-200 backdrop-blur-sm cursor-pointer"
            >
              <Compass className="w-4 h-4 text-sky-400 group-hover:text-white transition-colors" />
              <span>EXPLORE THE MISSION</span>
            </button>
          </div>

          {/* Scientific Constraints 1-Click Access Strip */}
          <div className="mt-5 flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              5 Scientific Constraints:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'terrain' as const, label: '01 TERRAIN & ELEVATION' },
                { id: 'sunlight' as const, label: '02 SUNLIGHT' },
                { id: 'earth_vis' as const, label: '03 EARTH VISIBILITY' },
                { id: 'comms' as const, label: '04 COMMS' },
                { id: 'safety' as const, label: '05 SAFETY' }
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenConstraint?.(c.id);
                  }}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 text-slate-300 hover:text-white text-[10px] font-mono transition-all cursor-pointer backdrop-blur-sm"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Micro Telemetry Footer */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
            <span>6 SOUTH POLE SITES SURVEYED</span>
            <span className="text-slate-600">•</span>
            <span>SLOPE THRESHOLD: &lt;8°</span>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onOpenSitePicker();
              }}
              className="text-sky-300 hover:text-white underline underline-offset-4 cursor-pointer"
            >
              Select survey beacon on 3D Moon
            </button>
          </div>
        </div>

        {/* Tactical Orbital Recon Telemetry (Desktop Only) */}
        <div className="pointer-events-auto fixed bottom-16 right-8 sm:right-12 hidden lg:flex flex-col items-end gap-2 text-right font-mono text-[11px] text-slate-400 select-none animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#050811]/70 border border-white/10 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-medium">RECON ORBIT 100KM</span>
            <span className="text-slate-500">•</span>
            <span className="text-sky-300">INC 89.9° POLAR</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#050811]/60 border border-white/10 backdrop-blur-md space-y-1.5 min-w-[220px]">
            <div className="flex justify-between gap-4 text-[10px]">
              <span className="text-slate-500 uppercase">Sector</span>
              <span className="text-slate-200">SHACKLETON / POLE</span>
            </div>
            <div className="flex justify-between gap-4 text-[10px]">
              <span className="text-slate-500 uppercase">Altimetry</span>
              <span className="text-slate-200">LOLA 50M HIGH-RELIEF</span>
            </div>
            <div className="flex justify-between gap-4 text-[10px]">
              <span className="text-slate-500 uppercase">Direct Link</span>
              <span className="text-emerald-300">DSN NOMINAL</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MISSION CONTROL INTEGRATION MODAL ================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg p-6 sm:p-7 rounded-xl bg-[#090e1a] border border-white/15 shadow-2xl font-sans text-left">
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-white/5 border border-white/10 text-sky-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white">
                    Mission Control Application Gateway
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    Integration Point for Independent Team Application
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-md bg-black/60 border border-white/10 font-mono text-[11px] text-slate-300">
                <span className="text-slate-500">// Configure your teammate&apos;s app URL in src/config/missionConfig.ts:</span>
                <br />
                <span className="text-purple-400">export const</span>{' '}
                <span className="text-sky-300">MISSION_CONTROL_URL</span> ={' '}
                <span className="text-emerald-300">&quot;{MISSION_CONTROL_URL}&quot;</span>;
              </div>

              <p>
                The landing page connects directly to your team&apos;s evaluation dashboard. Once your teammate provides the deployment or local URL, update the configuration or enter it below to launch:
              </p>

              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Launch Custom URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="http://localhost:3000 or your hosted app"
                    className="flex-1 px-3 py-2 rounded-md bg-black/80 border border-white/15 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white/40"
                  />
                  <button
                    onClick={handleCustomLaunch}
                    className="px-4 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                <span className="text-slate-500">Quick Test Ports:</span>
                <button
                  onClick={() => setCustomUrlInput('http://localhost:3000')}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 cursor-pointer"
                >
                  localhost:3000
                </button>
                <button
                  onClick={() => setCustomUrlInput('http://localhost:5174')}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 cursor-pointer"
                >
                  localhost:5174
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-5 mt-4 border-t border-white/10">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
              >
                Close Gateway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
