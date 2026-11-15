import React from 'react';
import { PlanetData } from '../types/mission';
import { PLANETS_DATA } from '../config/missionConfig';
import { X, Globe2, Compass, Thermometer, Orbit, Scale, Clock } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface PlanetModalProps {
  planetName: string | null;
  onClose: () => void;
  onSelectPlanet: (name: string) => void;
}

export const PlanetModal: React.FC<PlanetModalProps> = ({
  planetName,
  onClose,
  onSelectPlanet
}) => {
  if (!planetName) return null;

  const planet = PLANETS_DATA.find(
    p => p.name.toLowerCase() === planetName.toLowerCase()
  );

  if (!planet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#070e1e] border border-cyan-500/40 shadow-[0_0_50px_rgba(0,240,255,0.3)] p-6 text-left">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: planet.color }}
              />
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase">
                NASA PLANETARY RECONNAISSANCE ARCHIVE
              </span>
            </div>
            <h3 className="font-display font-extrabold text-2xl text-white tracking-wide">
              {planet.name.toUpperCase()}
            </h3>
          </div>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Planet Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-slate-800/80 scrollbar-none">
          {PLANETS_DATA.map(p => (
            <button
              key={p.name}
              onClick={() => {
                soundEngine.playUiClick();
                onSelectPlanet(p.name);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-all cursor-pointer ${
                p.name === planet.name
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(0,240,255,0.5)]'
                  : 'bg-black/60 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Synopsis */}
        <p className="text-xs text-slate-300 leading-relaxed font-light my-4">
          {planet.description}
        </p>

        {/* Key Planetary Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-black/60 border border-slate-800 flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-cyan-400" /> Equatorial Diameter
            </span>
            <span className="font-bold text-white text-sm mt-0.5">
              {planet.stats.diameter}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/60 border border-slate-800 flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Rotation Period
            </span>
            <span className="font-bold text-white text-sm mt-0.5">
              {planet.stats.dayLength}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/60 border border-slate-800 flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-rose-400" /> Surface Temp
            </span>
            <span className="font-bold text-rose-300 text-sm mt-0.5">
              {planet.stats.temperature}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/60 border border-slate-800 flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3 text-emerald-400" /> Surface Gravity
            </span>
            <span className="font-bold text-emerald-300 text-sm mt-0.5">
              {planet.stats.gravity}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-500">
            Source: NASA Planetary Fact Sheets
          </span>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-display font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer"
          >
            Dismiss Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
