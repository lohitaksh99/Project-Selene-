import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { CinematicPhase } from '../types/mission';
import { soundEngine } from '../utils/soundEngine';

interface CinematicDirectorProps {
  phase: CinematicPhase;
  setPhase: (phase: CinematicPhase) => void;
  isPlaying: boolean;
  timelineProgress: number;
  setTimelineProgress: (prog: number) => void;
  isInteractive: boolean;
  setIsInteractive: (interactive: boolean) => void;
}

export const CinematicDirector: React.FC<CinematicDirectorProps> = ({
  phase,
  setPhase,
  isPlaying,
  timelineProgress,
  setTimelineProgress,
  isInteractive,
  setIsInteractive
}) => {
  const { camera } = useThree();
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lookAtTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // 9.5-second cinematic lunar trajectory timeline
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setPhase('hero_active');
      setIsInteractive(true);
      camera.position.set(0, 1.8, 12.2);
      camera.lookAt(0, 0, 0);
      return;
    }

    const tl = gsap.timeline({
      paused: !isPlaying,
      onUpdate: () => {
        setTimelineProgress(tl.progress());
      },
      onComplete: () => {
        setPhase('hero_active');
        setIsInteractive(true);
        soundEngine.startPhaseAudio('hero_active');
      }
    });

    timelineRef.current = tl;

    // Initial camera position: cislunar deep space
    camera.position.set(0, 22, 75);
    lookAtTarget.current.set(-5, 4, 0);

    // ================= 0–1s: BRIEF MILKY WAY / DEEP-SPACE OPENING =================
    tl.to(camera.position, {
      x: -6,
      y: 16,
      z: 55,
      duration: 1.0,
      ease: 'power1.inOut',
      onStart: () => {
        setPhase('deep_space');
        soundEngine.startPhaseAudio('deep_space');
      }
    });

    // ================= 1–2s: QUICK EARTH REVEAL =================
    // Camera glides past Earth in the mid-ground, looking out towards the Moon
    tl.to(lookAtTarget.current, {
      x: -12,
      y: 6,
      z: -8,
      duration: 1.0,
      ease: 'power1.inOut'
    }, 'earth');
    tl.to(camera.position, {
      x: -18,
      y: 8,
      z: 32,
      duration: 1.0,
      ease: 'power1.inOut',
      onStart: () => {
        setPhase('earth_reveal');
        soundEngine.startPhaseAudio('earth_reveal');
      }
    }, 'earth');

    // ================= 2–5s: DRAMATIC APPROACH TOWARDS THE MOON =================
    // Spacecraft burns thrusters and accelerates rapidly towards the Moon
    tl.to(lookAtTarget.current, {
      x: 0,
      y: 0,
      z: 0,
      duration: 3.0,
      ease: 'power2.inOut'
    }, 'moon_approach');
    tl.to(camera.position, {
      x: 0,
      y: 4.2,
      z: 17.5,
      duration: 3.0,
      ease: 'power2.inOut',
      onStart: () => {
        setPhase('lunar_approach');
        soundEngine.startPhaseAudio('lunar_approach');
      }
    }, 'moon_approach');

    // ================= 5–7s: DETAILED LUNAR SURFACE REVEAL =================
    // Low lunar orbital descent revealing craters, topography, and terminator relief
    tl.to(camera.position, {
      x: 0,
      y: 2.2,
      z: 13.0,
      duration: 2.0,
      ease: 'power1.out',
      onStart: () => {
        setPhase('lunar_surface');
        soundEngine.startPhaseAudio('lunar_surface');
      }
    });

    // ================= 7–9s: LANDING-SITE MARKERS & COORDINATES =================
    tl.to(camera.position, {
      x: 0.2,
      y: 2.0,
      z: 12.5,
      duration: 2.0,
      ease: 'sine.inOut',
      onStart: () => {
        setPhase('site_targeting');
        soundEngine.startPhaseAudio('site_targeting');
      }
    });

    // ================= 9–10s: HERO SECTION & CTA =================
    // Asymmetric cinematic composition: frames the Moon prominently with balanced typography room
    tl.to(camera.position, {
      x: typeof window !== 'undefined' && window.innerWidth > 768 ? 1.6 : 0,
      y: 1.4,
      z: 12.6,
      duration: 0.6,
      ease: 'power2.out',
      onStart: () => {
        setPhase('hero_active');
        soundEngine.startPhaseAudio('hero_active');
      }
    });

    return () => {
      tl.kill();
    };
  }, []);

  // Sync play/pause state
  useEffect(() => {
    if (timelineRef.current) {
      if (isPlaying) {
        timelineRef.current.play();
      } else {
        timelineRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Keep camera facing lookAtTarget during cinematic flight
  useFrame(() => {
    if (!isInteractive) {
      camera.lookAt(lookAtTarget.current);
    }
  });

  return null;
};
