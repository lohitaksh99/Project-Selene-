'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Compass } from 'lucide-react';
import type { ChallengeId } from './introMissionData';

interface IntroHeroOverlayProps {
  onEnterMissionControl: () => void;
  onDiscoverMission: () => void;
  onOpenSitePicker: () => void;
  onOpenConstraint: (id: ChallengeId) => void;
}

export const IntroHeroOverlay: React.FC<IntroHeroOverlayProps> = ({
  onEnterMissionControl,
  onDiscoverMission,
  onOpenSitePicker,
  onOpenConstraint,
}) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-end p-6 sm:p-12 text-left"
    >
      <div className="pointer-events-auto max-w-2xl flex flex-col items-start">
        {/* Mission Designation Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-[#050811]/85 border border-white/15 text-slate-300 text-[11px] font-mono tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="font-semibold text-white tracking-widest">PROJECT SELENE</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-300">BEFORE WE LAND, WE UNDERSTAND.</span>
        </div>

        {/* Original Intro Headline */}
        <h1 className="font-sans font-black text-3xl sm:text-5xl md:text-6xl tracking-tight text-white mb-3 leading-[1.06]">
          NAVIGATE THE UNKNOWN.
        </h1>

        {/* Supporting Description */}
        <p className="font-sans text-sm sm:text-base md:text-lg text-slate-200 max-w-xl font-normal leading-relaxed mb-6">
          Exploring the lunar south pole through terrain intelligence, illumination analysis and landing-site evaluation.
        </p>

        {/* Primary & Secondary Action CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onEnterMissionControl}
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-white hover:bg-[#F1F52E] text-slate-950 font-sans font-semibold text-sm tracking-wide transition-colors duration-200 shadow-lg cursor-pointer"
          >
            <span>ENTER MISSION CONTROL</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-slate-950" />
          </button>

          <button
            type="button"
            onClick={onDiscoverMission}
            className="group flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-[#050811]/85 hover:bg-white/15 border border-white/25 hover:border-white/45 text-slate-100 font-sans font-medium text-sm transition-colors duration-200 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-sky-400 group-hover:text-white transition-colors" />
            <span>EXPLORE THE MISSION</span>
          </button>
        </div>

        {/* Scientific Constraints 1-Click Access Strip */}
        <div className="mt-5 flex flex-col gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            5 Scientific Constraints:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'terrain' as const, label: '01 TERRAIN & ELEVATION' },
              { id: 'sunlight' as const, label: '02 SUNLIGHT' },
              { id: 'earth_vis' as const, label: '03 EARTH VISIBILITY' },
              { id: 'comms' as const, label: '04 COMMS' },
              { id: 'safety' as const, label: '05 SAFETY' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenConstraint(c.id)}
                className="px-2 py-1 rounded bg-[#050811]/80 hover:bg-white/15 border border-white/15 hover:border-white/30 text-slate-200 hover:text-white text-[10px] font-mono transition-colors cursor-pointer"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Micro Telemetry Footer */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300">
          <span>6 SOUTH POLE SITES SURVEYED</span>
          <span className="text-slate-600">•</span>
          <span>SLOPE THRESHOLD: &lt;8°</span>
          <span className="text-slate-600">•</span>
          <button
            type="button"
            onClick={onOpenSitePicker}
            className="text-sky-300 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Select survey beacon on 3D Moon
          </button>
        </div>
      </div>

      {/* Tactical Orbital Recon Telemetry (Desktop Only) */}
      <div className="pointer-events-auto fixed bottom-10 right-8 sm:right-12 hidden lg:flex flex-col items-end gap-2 text-right font-mono text-[11px] text-slate-300 select-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#050811]/90 border border-white/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-white font-medium">RECON ORBIT 100KM</span>
          <span className="text-slate-500">•</span>
          <span className="text-sky-300">INC 89.9° POLAR</span>
        </div>
        <div className="p-3.5 rounded-xl bg-[#050811]/85 border border-white/15 space-y-1.5 min-w-[220px]">
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
    </motion.section>
  );
};
