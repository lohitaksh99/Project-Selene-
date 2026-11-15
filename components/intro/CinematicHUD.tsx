'use client';

import React from 'react';
import { FastForward } from 'lucide-react';

interface CinematicHUDProps {
  onSkipIntro: () => void;
}

export const CinematicHUD: React.FC<CinematicHUDProps> = ({ onSkipIntro }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col p-4 sm:p-8 overflow-hidden select-none">
      <header className="flex items-center justify-between w-full gap-3">
        <div className="pointer-events-auto flex items-center gap-3 bg-[#050811]/90 px-3.5 py-2 border border-white/15">
          <div className="w-2 h-2 bg-[#F1F52E]" />
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-xs tracking-wider text-white uppercase">
              PROJECT SELENE
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              / LUNAR SOUTH POLE EXPLORATION
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkipIntro}
          className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 bg-[#050811]/90 hover:bg-[#F1F52E] border border-white/30 hover:border-[#F1F52E] text-white hover:text-[#111111] text-xs font-mono font-semibold tracking-wider uppercase transition-colors cursor-pointer"
        >
          <span>SKIP INTRODUCTION</span>
          <FastForward className="w-3 h-3" />
        </button>
      </header>
    </div>
  );
};
