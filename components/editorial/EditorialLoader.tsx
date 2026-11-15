'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface EditorialLoaderProps {
  onComplete?: () => void;
  brandName?: string;
  missionDesignation?: string;
}

export default function EditorialLoader({
  onComplete,
  brandName = 'LUNAR LANDING NAVIGATOR',
  missionDesignation = 'NASA ARTEMIS SOUTH POLE EXPEDITION',
}: EditorialLoaderProps) {
  const [percent, setPercent] = useState(0);
  const [stepText, setStepText] = useState('CALIBRATING TOPOCENTRIC ENU DATUM');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1400; // Fast and snappy 1.4s

    const steps = [
      { p: 18, text: 'RESOLVING IAU MOON_ME ELLIPSOID (R = 1737.4 KM)' },
      { p: 42, text: 'INGESTING LOLA 5M SOUTH POLAR ALTIMETRY' },
      { p: 68, text: 'SYNCHRONIZING JPL DE441 EPHEMERIS EPOCH' },
      { p: 92, text: 'COMPUTING CO-VISIBILITY & POWER LINKS' },
      { p: 100, text: 'SYSTEM READY — LAUNCHING NAVIGATOR' },
    ];

    let frameId: number;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const currentPercent = Math.round(progress * 100);
      setPercent(currentPercent);

      const currentStep = steps.find((s) => currentPercent <= s.p) || steps[steps.length - 1]!;
      setStepText(currentStep.text);

      if (progress < 1.0) {
        frameId = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          setIsDone(true);
          onComplete?.();
        }, 220);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[9999] flex flex-col justify-between bg-[#111111] text-[#F7F7F3] p-8 md:p-14 select-none"
        >
          {/* Top Row: Mission Header & Telemetry */}
          <div className="flex items-start justify-between border-b border-[#2D2D2D] pb-6">
            <div className="flex items-center gap-3">
              <span className="inline-block w-3.5 h-3.5 bg-[#F1F52E]" />
              <span className="text-xs font-mono font-bold tracking-[0.14em] text-[#F7F7F3] uppercase">
                {brandName}
              </span>
            </div>
            <div className="text-right font-mono text-[11px] tracking-wider text-[#B7B5AD]">
              <div>{missionDesignation}</div>
              <div className="text-[#F1F52E] font-bold">STATUS: INITIALIZING KINEMATICS</div>
            </div>
          </div>

          {/* Center: Massive Monospaced Percent and Editorial Monogram */}
          <div className="my-auto">
            <div className="text-xs font-mono tracking-[0.2em] text-[#898B89] uppercase mb-2">
              ORBITAL EPHEMERIS / TOPOCENTRIC GIS
            </div>
            <div className="text-7xl sm:text-9xl md:text-[140px] font-black tracking-tighter tabular-nums leading-none text-[#F7F7F3]">
              {String(percent).padStart(3, '0')}
              <span className="text-3xl sm:text-5xl md:text-6xl text-[#F1F52E] font-bold ml-1">%</span>
            </div>
            <div className="mt-4 text-xs sm:text-sm font-mono tracking-wider text-[#F1F52E] flex items-center gap-3">
              <span className="inline-block w-2 h-2 bg-[#F1F52E]" />
              <span>{stepText}</span>
            </div>
          </div>

          {/* Bottom Row: Minimal Precision Progress Bar & Specs */}
          <div className="space-y-4">
            <div className="w-full h-[3px] bg-[#222222] overflow-hidden">
              <motion.div
                className="h-full bg-[#F1F52E]"
                style={{ width: `${percent}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-[#898B89] tracking-wider uppercase">
              <span>LATITUDE: -89.78°S · LONGITUDE: 120.45°E</span>
              <span>DATUM: IAU/IAG MOON_ME</span>
              <span>NASA SPACE APPS CHALLENGE</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
