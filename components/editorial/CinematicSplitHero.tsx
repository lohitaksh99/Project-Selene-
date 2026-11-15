'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

interface CinematicSplitHeroProps {
  onLaunchMissionControl: () => void;
  onProjectOverview: () => void;
  onOpenPlanner: () => void;
  onReplayIntro?: () => void;
}

export default function CinematicSplitHero({
  onLaunchMissionControl,
  onProjectOverview,
  onOpenPlanner,
  onReplayIntro,
}: CinematicSplitHeroProps) {
  return (
    <section className="relative w-full min-h-[calc(100vh-3.5rem)] bg-[#111111] text-[#F7F7F3] overflow-hidden flex flex-col justify-end">
      {/* 50/50 Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 w-full flex-1">
        {/* LEFT PANEL: Astronaut & Rover close-up with bottom-left headline */}
        <div className="relative min-h-[460px] lg:min-h-[calc(100vh-3.5rem)] border-b lg:border-b-0 lg:border-r border-[#2B303B] overflow-hidden flex flex-col justify-end p-8 sm:p-10 lg:p-12 xl:p-16">
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/hero_left.jpg"
              alt="Lunar Artemis astronaut with rover on the Moon's South Pole"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover object-center brightness-[0.75] contrast-[1.12]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/55 to-[#0B0D12]/15" />
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="w-2.5 h-2.5 bg-[#F1F52E] shrink-0" />
              <span className="text-xs font-mono font-black tracking-[0.22em] text-[#F1F52E] uppercase">
                PROJECT SELENE
              </span>
              <span className="text-[11px] font-mono font-bold tracking-[0.16em] text-[#EAE9E4] uppercase">
                · LUNAR SOUTH POLE
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[64px] xl:text-[86px] 2xl:text-[102px] font-black tracking-[-0.04em] leading-[0.88] uppercase text-[#F7F7F3]">
              Navigate<br />The Unknown
            </h1>
          </div>
        </div>

        {/* RIGHT PANEL: Shackleton Crater Rim landscape with grazing light */}
        <div className="relative min-h-[460px] lg:min-h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col justify-end p-8 sm:p-12 md:p-16">
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/hero_right.jpg"
              alt="Lunar South Pole crater rim with low-angle grazing sunlight and deep shadows"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover object-center brightness-[0.78] contrast-[1.15]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/60 to-[#0B0D12]/15" />
          </div>

          <div className="relative z-10 max-w-xl lg:ml-auto">
            <div className="text-[11px] font-mono font-bold tracking-[0.16em] text-[#F1F52E] uppercase mb-3">
              TOPOGRAPHIC CRATER INTEL · DTE COMMUNICATIONS
            </div>

            <p className="text-base sm:text-lg text-[#F7F7F3] font-normal leading-relaxed mb-8">
              Explore the Moon&apos;s most challenging terrain. Compare landing locations, understand sunlight conditions, and evaluate Earth communication visibility.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLaunchMissionControl}
                className="cursor-pointer inline-flex items-center gap-3 px-6 py-3.5 bg-[#F1F52E] text-[#111111] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#FFFFFF] transition-colors whitespace-nowrap"
              >
                <span>LAUNCH MISSION CONTROL</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={onProjectOverview}
                className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#111318]/85 border border-[#F7F7F3]/50 text-[#F7F7F3] font-mono text-xs font-bold tracking-wider uppercase hover:border-[#F1F52E] hover:text-[#F1F52E] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>PROJECT OVERVIEW</span>
              </button>

              <button
                type="button"
                onClick={onOpenPlanner}
                className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#111318]/85 border border-[#F7F7F3]/50 text-[#F7F7F3] font-mono text-xs font-bold tracking-wider uppercase hover:border-[#F1F52E] hover:text-[#F1F52E] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>MISSION PLANNER</span>
              </button>
            </div>

            {onReplayIntro && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onReplayIntro}
                  className="text-[11px] font-mono tracking-wider uppercase text-[#EAE9E4]/75 hover:text-[#F1F52E] underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Replay 3D Lunar Introduction
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
