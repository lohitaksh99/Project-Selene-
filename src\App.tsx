import React, { useState, useEffect } from 'react';
import { SpaceCanvas } from './components/SpaceCanvas';
import { CinematicHUD } from './components/CinematicHUD';
import { HeroSection } from './components/HeroSection';
import { LandingSiteModal } from './components/LandingSiteModal';
import { MissionOverviewModal, ChallengeId } from './components/MissionOverviewModal';
import { LoadingScreen } from './components/LoadingScreen';
import { FallbackView } from './components/FallbackView';
import { CinematicPhase, LandingSite } from './types/mission';
import { CANDIDATE_LANDING_SITES, MISSION_CONTROL_URL } from './config/missionConfig';
import { soundEngine } from './utils/soundEngine';

export const App: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [phase, setPhase] = useState<CinematicPhase>('deep_space');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timelineProgress, setTimelineProgress] = useState<number>(0);
  const [isInteractive, setIsInteractive] = useState<boolean>(false);
  const [selectedSite, setSelectedSite] = useState<LandingSite | null>(null);
  const [isMissionOverviewOpen, setIsMissionOverviewOpen] = useState<boolean>(false);
  const [initialChallengeId, setInitialChallengeId] = useState<ChallengeId>('terrain');
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);

  // Check WebGL availability on mount
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
      }
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  // Skip Intro handler (jumps directly to the Moon hero state)
  const handleSkipIntro = () => {
    soundEngine.stopAll();
    soundEngine.playTelemetryBeep(1800, 0.08);
    setPhase('hero_active');
    setIsInteractive(true);
    setTimelineProgress(1.0);
  };

  // Replay sequence handler
  const handleReplay = () => {
    soundEngine.stopAll();
    soundEngine.restartAmbient();
    setPhase('deep_space');
    setIsInteractive(false);
    setTimelineProgress(0);
    setIsPlaying(true);
  };

  const handleSeek = (progress: number) => {
    setTimelineProgress(progress);
    if (progress >= 0.9) {
      setPhase('hero_active');
      setIsInteractive(true);
    } else if (progress >= 0.7) {
      setPhase('site_targeting');
      setIsInteractive(false);
    } else if (progress >= 0.5) {
      setPhase('lunar_surface');
      setIsInteractive(false);
    } else if (progress >= 0.2) {
      setPhase('lunar_approach');
      setIsInteractive(false);
    } else if (progress >= 0.1) {
      setPhase('earth_reveal');
      setIsInteractive(false);
    } else {
      setPhase('deep_space');
      setIsInteractive(false);
    }
  };

  const handleEnterMissionControl = () => {
    soundEngine.playUiClick();
    if (
      MISSION_CONTROL_URL &&
      MISSION_CONTROL_URL !== 'YOUR_APPLICATION_URL' &&
      MISSION_CONTROL_URL.trim() !== ''
    ) {
      window.open(MISSION_CONTROL_URL, '_blank', 'noopener,noreferrer');
    } else {
      setSelectedSite(null);
      setIsMissionOverviewOpen(false);
      setPhase('hero_active');
      setIsInteractive(true);
    }
  };

  if (!hasWebGL) {
    return <FallbackView />;
  }

  const showHero = phase === 'hero_active' || phase === 'site_targeting';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02040a]">
      {/* 1. Fast, Clean Loading Screen */}
      {!isLoaded && <LoadingScreen onLoaded={() => setIsLoaded(true)} />}

      {/* 2. Main 3D Lunar & Cislunar Space Canvas */}
      {isLoaded && (
        <>
          <SpaceCanvas
            phase={phase}
            setPhase={setPhase}
            isPlaying={isPlaying}
            timelineProgress={timelineProgress}
            setTimelineProgress={setTimelineProgress}
            isInteractive={isInteractive}
            setIsInteractive={setIsInteractive}
            selectedSite={selectedSite}
            onSelectSite={(site) => {
              soundEngine.playTelemetryBeep(1760, 0.08);
              setSelectedSite(site);
            }}
            wireframeMode={wireframeMode}
            showOverlays={showOverlays}
          />

          {/* 3. Refined Aerospace HUD Telemetry & Navigation */}
          <CinematicHUD
            phase={phase}
            onSkipIntro={handleSkipIntro}
            onReplay={handleReplay}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            timelineProgress={timelineProgress}
            onSeek={handleSeek}
            wireframeMode={wireframeMode}
            onToggleWireframe={() => setWireframeMode(!wireframeMode)}
            showOverlays={showOverlays}
            onToggleOverlays={() => setShowOverlays(!showOverlays)}
          />

          {/* 4. Project Selene Hero Section ("NAVIGATE THE UNKNOWN.") */}
          {showHero && (
            <HeroSection
              onDiscoverMission={() => {
                setInitialChallengeId('terrain');
                setIsMissionOverviewOpen(true);
              }}
              onOpenSitePicker={() => setSelectedSite(CANDIDATE_LANDING_SITES[0])}
              onOpenConstraint={(id) => {
                setInitialChallengeId(id);
                setIsMissionOverviewOpen(true);
              }}
            />
          )}

          {/* 5. Candidate Landing Site Terrain & Environmental Dossier */}
          <LandingSiteModal
            site={selectedSite}
            onClose={() => setSelectedSite(null)}
            onSelectAnotherSite={(site) => setSelectedSite(site)}
            onEnterMissionControl={handleEnterMissionControl}
          />

          {/* 6. Touchdown Evaluation Challenge & Constraints Modal */}
          <MissionOverviewModal
            isOpen={isMissionOverviewOpen}
            onClose={() => setIsMissionOverviewOpen(false)}
            onSelectSite={(site) => setSelectedSite(site)}
            onEnterMissionControl={handleEnterMissionControl}
            initialChallengeId={initialChallengeId}
          />
        </>
      )}
    </div>
  );
};

export default App;
