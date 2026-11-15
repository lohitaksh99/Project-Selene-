import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Radio
} from 'lucide-react';
import { CinematicPhase } from '../types/mission';
import { soundEngine } from '../utils/soundEngine';

interface CinematicHUDProps {
  phase: CinematicPhase;
  onSkipIntro: () => void;
  onReplay: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  timelineProgress: number;
  onSeek: (progress: number) => void;
  wireframeMode: boolean;
  onToggleWireframe: () => void;
  showOverlays: boolean;
  onToggleOverlays: () => void;
}

const PHASES_LIST: { id: CinematicPhase; label: string; progress: number }[] = [
  { id: 'deep_space', label: 'DEEP SPACE', progress: 0.0 },
  { id: 'earth_reveal', label: 'EARTH TRANSIT', progress: 0.15 },
  { id: 'lunar_approach', label: 'LUNAR APPROACH', progress: 0.35 },
  { id: 'lunar_surface', label: 'SURFACE RECON', progress: 0.65 },
  { id: 'site_targeting', label: 'SITE TARGETING', progress: 0.85 },
  { id: 'hero_active', label: 'DECISION', progress: 1.0 }
];

export const CinematicHUD: React.FC<CinematicHUDProps> = ({
  phase,
  onSkipIntro,
  onReplay,
  isPlaying,
  onTogglePlay,
  timelineProgress,
  onSeek,
  wireframeMode,
  onToggleWireframe,
  showOverlays,
  onToggleOverlays
}) => {
  const [ambientMuted, setAmbientMuted] = useState(soundEngine.getAmbientMuted());
  const [narrationMuted, setNarrationMuted] = useState(soundEngine.getNarrationMuted());
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAmbientToggle = () => {
    const newState = soundEngine.toggleAmbient();
    setAmbientMuted(newState);
  };

  const handleNarrationToggle = () => {
    const newState = soundEngine.toggleNarration();
    setNarrationMuted(newState);
  };

  const handleEnableAllAudio = () => {
    soundEngine.init();
    soundEngine.setAmbientMuted(false);
    soundEngine.setNarrationMuted(false);
    setAmbientMuted(false);
    setNarrationMuted(false);
    soundEngine.replayNarration();
  };

  const isHeroPhase = phase === 'hero_active';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-8 overflow-hidden select-none">
      {/* ================= REFINED EDITORIAL HEADER ================= */}
      <header className="flex items-center justify-between w-full">
        {/* Project Branding */}
        <div className="pointer-events-auto flex items-center gap-3 bg-[#050811]/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-xs tracking-wider text-white">
                PROJECT SELENE
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                / NASA LUNAR SOUTH POLE MISSION CONTROL
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 tracking-tight">
              LOLA TOPOGRAPHY 50M • T+{String(elapsedSec).padStart(3, '0')}S
            </span>
          </div>
        </div>

        {/* Center Prompt / Unobtrusive Audio Unblock Callout */}
        {(ambientMuted || narrationMuted) ? (
          <button
            onClick={handleEnableAllAudio}
            className="pointer-events-auto hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-400/40 text-sky-200 text-xs font-mono transition-all backdrop-blur-md cursor-pointer animate-fade-in"
            title="Enable ambient audio and voice narration"
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            <span>ENABLE AUDIO &amp; NARRATION</span>
          </button>
        ) : (
          /* Live Trajectory Sensor Status when Audio is Active */
          <div className="hidden md:flex pointer-events-auto items-center gap-5 bg-[#050811]/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 text-[11px] font-mono text-slate-400">
            <div>
              <span className="text-slate-500 uppercase text-[9px] block">Target Zone</span>
              <span className="text-slate-200 font-medium">SOUTH POLE · 85°S–90°S</span>
            </div>
            <div className="w-px h-5 bg-white/10" />
            <div>
              <span className="text-slate-500 uppercase text-[9px] block">Terrain Sensor</span>
              <span className="text-sky-300 font-medium">LASER ALTIMETER NOMINAL</span>
            </div>
          </div>
        )}

        {/* Right Engineering Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Topographic Elevation Wireframe Toggle */}
          <button
            onClick={onToggleWireframe}
            title="Toggle Lunar Topographic Elevation Grid"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${
              wireframeMode
                ? 'bg-sky-950/80 border-sky-400 text-sky-200'
                : 'bg-[#050811]/80 border-white/10 hover:border-white/25 text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">CONTOURS</span>
          </button>

          {/* Ambient Sound Toggle */}
          <button
            onClick={handleAmbientToggle}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${
              !ambientMuted
                ? 'bg-sky-950/80 border-sky-400 text-sky-300'
                : 'bg-[#050811]/80 border-white/10 hover:border-white/25 text-slate-400'
            }`}
            title={ambientMuted ? 'Unmute Ambient Sound' : 'Mute Ambient Sound'}
          >
            {ambientMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-sky-400" />}
            <span className="hidden sm:inline text-[11px]">AUDIO</span>
          </button>

          {/* Documentary Voice Narration Toggle (No microphone icon) */}
          <button
            onClick={handleNarrationToggle}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${
              !narrationMuted
                ? 'bg-sky-950/80 border-sky-400 text-sky-300'
                : 'bg-[#050811]/80 border-white/10 hover:border-white/25 text-slate-400'
            }`}
            title={narrationMuted ? 'Enable Voice Narration' : 'Mute Voice Narration'}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">VOICE</span>
          </button>

          {/* Dedicated Replay Voice Narration Button */}
          <button
            onClick={() => {
              soundEngine.replayNarration();
              setNarrationMuted(false);
            }}
            className="px-2 py-1.5 rounded-lg bg-[#050811]/80 hover:bg-slate-900 border border-white/10 hover:border-white/25 text-slate-300 transition-all backdrop-blur-md cursor-pointer flex items-center gap-1 text-[11px] font-mono"
            title="Replay Voice Narration"
          >
            <RotateCcw className="w-3 h-3 text-sky-400" />
            <span className="hidden lg:inline">REPLAY VOICE</span>
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-lg bg-[#050811]/80 hover:bg-slate-900 border border-white/10 hover:border-white/25 text-slate-300 transition-all backdrop-blur-md cursor-pointer"
            title={isPlaying ? 'Pause Intro' : 'Play Intro'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-white" />}
          </button>

          {/* Replay Sequence Button */}
          <button
            onClick={onReplay}
            className="p-2 rounded-lg bg-[#050811]/80 hover:bg-slate-900 border border-white/10 hover:border-white/25 text-slate-300 transition-all backdrop-blur-md cursor-pointer"
            title="Replay Trajectory Sequence"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Skip Intro CTA */}
          {!isHeroPhase && (
            <button
              onClick={onSkipIntro}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-mono font-medium backdrop-blur-md transition-all cursor-pointer"
            >
              <span>SKIP</span>
              <FastForward className="w-3 h-3 text-slate-300" />
            </button>
          )}
        </div>
      </header>

      {/* ================= MINIMAL BOTTOM TIMELINE ================= */}
      <footer className="w-full max-w-xl mx-auto flex flex-col gap-1.5 mb-2">
        {/* Timeline Chapters */}
        <div className="pointer-events-auto flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
          {PHASES_LIST.map(p => {
            const isActive = phase === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSeek(p.progress)}
                className={`transition-colors cursor-pointer ${
                  isActive ? 'text-white font-semibold' : 'hover:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Minimal Progress Bar */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeek(pct);
          }}
          className="pointer-events-auto h-0.5 w-full bg-white/10 rounded-full cursor-pointer relative overflow-hidden group hover:h-1 transition-all"
        >
          <div
            className="h-full bg-white transition-all duration-100"
            style={{ width: `${Math.round(timelineProgress * 100)}%` }}
          />
        </div>
      </footer>
    </div>
  );
};
