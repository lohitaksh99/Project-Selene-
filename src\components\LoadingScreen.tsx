import React, { useState, useEffect } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface LoadingScreenProps {
  onLoaded: () => void;
}

const BOOT_LOGS = [
  'INITIALIZING CISLUNAR TRAJECTORY PROPAGATOR...',
  'STREAMING LOLA 50M HIGH-RELIEF LUNAR TOPOGRAPHY...',
  'INDEXING SOUTH POLE CANDIDATE TOUCHDOWN ZONES...',
  'CALIBRATING DIRECT-TO-EARTH TELEMETRY LINK...',
  'SURVEY FLIGHT DECK READY.'
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsReady(true);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 15) + 10;
        return next > 100 ? 100 : next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setLogIndex(prev => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 200);
    return () => clearInterval(logInterval);
  }, []);

  const handleStartMission = () => {
    soundEngine.init();
    soundEngine.setAmbientMuted(false);
    soundEngine.setNarrationMuted(false);
    soundEngine.playThrusterBurst();
    onLoaded();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-12 bg-[#02040a] text-slate-100 font-sans select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <span className="font-semibold text-xs tracking-wider text-white">
            PROJECT SELENE
          </span>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            / NASA LUNAR SOUTH POLE MISSION CONTROL
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          CISLUNAR RECONNAISSANCE
        </span>
      </div>

      {/* Center Prompt */}
      <div className="max-w-md w-full flex flex-col items-center text-center my-auto">
        <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-6">
          <Compass className="w-5 h-5 text-sky-400 animate-spin-slow" />
        </div>

        <h2 className="font-sans font-bold text-2xl sm:text-3xl text-white tracking-tight mb-2">
          NAVIGATE THE UNKNOWN.
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 font-light max-w-sm mb-6 leading-relaxed">
          Exploring the lunar south pole through terrain intelligence, illumination analysis and landing-site evaluation.
        </p>

        {/* Diagnostic Log Window */}
        <div className="w-full bg-black/60 rounded-lg border border-white/10 p-3 mb-5 text-left h-20 overflow-hidden flex flex-col justify-end text-[11px] font-mono">
          {BOOT_LOGS.slice(0, logIndex + 1).slice(-2).map((log, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-400 py-0.5">
              <span className="text-slate-500">&gt;</span>
              <span className={idx === 1 ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                {log}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>CALIBRATION</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Start Button */}
        {isReady && (
          <button
            onClick={handleStartMission}
            className="mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs tracking-wide transition-all shadow-lg cursor-pointer animate-fade-in"
          >
            <span>START LUNAR APPROACH</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/10 pt-4">
        <span>TOPOGRAPHY: LOLA / LRO ELEVATION ARCHIVE</span>
        <span>TOUCHDOWN SAFETY THRESHOLD: &lt;8°</span>
      </div>
    </div>
  );
};
