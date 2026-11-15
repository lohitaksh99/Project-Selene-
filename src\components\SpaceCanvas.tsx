import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CinematicPhase, LandingSite } from '../types/mission';
import { Galaxy } from './Galaxy';
import { EarthSystem } from './EarthSystem';
import { LunarSurface } from './LunarSurface';
import { CinematicDirector } from './CinematicDirector';

interface SpaceCanvasProps {
  phase: CinematicPhase;
  setPhase: (phase: CinematicPhase) => void;
  isPlaying: boolean;
  timelineProgress: number;
  setTimelineProgress: (prog: number) => void;
  isInteractive: boolean;
  setIsInteractive: (interactive: boolean) => void;
  selectedSite: LandingSite | null;
  onSelectSite: (site: LandingSite) => void;
  wireframeMode: boolean;
  showOverlays: boolean;
}

export const SpaceCanvas: React.FC<SpaceCanvasProps> = ({
  phase,
  setPhase,
  isPlaying,
  timelineProgress,
  setTimelineProgress,
  isInteractive,
  setIsInteractive,
  selectedSite,
  onSelectSite,
  wireframeMode,
  showOverlays
}) => {
  // Requirement A: Milky Way as distant galactic background during opening,
  // gradually fading out so lunar approach takes place in natural black space with distant stars.
  const galaxyOpacity =
    phase === 'deep_space'
      ? 0.55
      : phase === 'earth_reveal'
      ? 0.22
      : phase === 'lunar_approach'
      ? 0.05
      : 0.0;

  return (
    <div className="absolute inset-0 z-0 bg-[#02040a]">
      <Canvas
        camera={{ position: [0, 22, 75], fov: 45, near: 0.1, far: 2000 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      >
        <color attach="background" args={['#02040a']} />

        {/* Deep Astronomical Space Lighting (Preserves rich, deep black space contrast) */}
        <ambientLight color="#02040a" intensity={0.12} />
        <directionalLight position={[-40, 12, 28]} intensity={1.2} color="#fffdf5" />

        {/* 9.5-Second Lunar Trajectory Director */}
        <CinematicDirector
          phase={phase}
          setPhase={setPhase}
          isPlaying={isPlaying}
          timelineProgress={timelineProgress}
          setTimelineProgress={setTimelineProgress}
          isInteractive={isInteractive}
          setIsInteractive={setIsInteractive}
        />

        {/* Free Orbit Controls for Lunar Surface Exploration */}
        {isInteractive && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={7.5}
            maxDistance={24}
            maxPolarAngle={Math.PI * 0.92}
            minPolarAngle={0.08}
          />
        )}

        {/* Deep Space Background Stars */}
        <Stars
          radius={300}
          depth={70}
          count={5000}
          factor={3.5}
          saturation={0.3}
          fade
          speed={0.3}
        />

        <Suspense fallback={null}>
          {/* Distant Milky Way background in deep space (fades out as camera approaches Moon) */}
          <Galaxy visible={galaxyOpacity > 0.001} opacity={galaxyOpacity} />

          {/* Cislunar Earth in the Background */}
          <group position={[-36, 12, -42]}>
            <EarthSystem scale={1.25} showMoon={false} />
          </group>

          {/* Central Hero Body: High-Relief Moon with Candidate Landing Sites */}
          <LunarSurface
            visible={true}
            selectedSite={selectedSite}
            onSelectSite={onSelectSite}
            showScientificOverlays={showOverlays}
            wireframeMode={wireframeMode}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
