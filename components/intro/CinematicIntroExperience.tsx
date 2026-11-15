'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { INTRO_TEXTURES_PRELOAD } from './introMissionData';
import { SpaceCinematicCanvas } from './SpaceCinematicCanvas';
import { CinematicHUD } from './CinematicHUD';
import { IntroFallbackView } from './IntroFallbackView';

interface CinematicIntroExperienceProps {
  onCompleteToHomepage: (selectedSeleneSiteId?: string) => void;
}

export const CinematicIntroExperience: React.FC<CinematicIntroExperienceProps> = ({
  onCompleteToHomepage,
}) => {
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [showFinalHeading, setShowFinalHeading] = useState<boolean>(false);
  const [exiting, setExiting] = useState<boolean>(false);

  // Preload critical NASA planetary textures and verify WebGL context capability
  useEffect(() => {
    for (const src of INTRO_TEXTURES_PRELOAD) {
      const img = new window.Image();
      img.src = src;
    }

    try {
      const probeCanvas = document.createElement('canvas');
      const gl =
        probeCanvas.getContext('webgl2') ||
        probeCanvas.getContext('webgl') ||
        probeCanvas.getContext('experimental-webgl');
      if (!gl) {
        queueMicrotask(() => setHasWebGL(false));
      } else {
        const loseCtx = (gl as WebGLRenderingContext).getExtension?.('WEBGL_lose_context');
        loseCtx?.loseContext();
      }
    } catch {
      queueMicrotask(() => setHasWebGL(false));
    }
  }, []);

  const handleFinalPhase = useCallback(() => {
    setShowFinalHeading(true);
  }, []);

  const triggerSmoothExit = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      onCompleteToHomepage();
    }, 360);
  }, [exiting, onCompleteToHomepage]);

  if (!hasWebGL) {
    return <IntroFallbackView onEnterMissionControl={triggerSmoothExit} />;
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.02 : 1 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] w-screen h-screen overflow-hidden bg-[#02040a]"
    >
      <SpaceCinematicCanvas
        onFinalPhase={handleFinalPhase}
        onIntroComplete={triggerSmoothExit}
        onWebGLError={() => setHasWebGL(false)}
      />

      <CinematicHUD onSkipIntro={triggerSmoothExit} />

      {/* Final Phase Bold Heading Revealed While Entering the Moon Into the Homepage */}
      <AnimatePresence>
        {showFinalHeading && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-6 text-center select-none"
          >
            <div className="inline-flex items-center gap-2.5 mb-3 px-3 py-1 bg-[#050811]/80 border border-[#F1F52E]/50">
              <span className="w-2 h-2 bg-[#F1F52E]" />
              <span className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.26em] text-[#F1F52E] uppercase">
                LUNAR SOUTH POLE · MISSION CONTROL
              </span>
            </div>

            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[108px] font-black tracking-[-0.04em] leading-[0.88] uppercase text-[#F7F7F3] drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)]">
              PROJECT SELENE
            </h1>

            <div className="mt-4 h-0.5 w-20 bg-[#F1F52E]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
