import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANETS_DATA } from '../config/missionConfig';
import { PlanetMesh } from './PlanetMesh';
import { EarthSystem } from './EarthSystem';
import { nasaTextureLoader } from '../utils/nasaTextureLoader';
import { SunCoronaVertexShader, SunCoronaFragmentShader } from '../shaders/atmosphereShader';

interface SolarSystemProps {
  visible?: boolean;
  timeScale?: number;
  highlightedPlanet?: string | null;
  onSelectPlanet?: (name: string) => void;
}

// Compute deterministic coordinates for each planet in a cinematic corridor
export function getPlanetCoordinates(name: string, time: number = 0): [number, number, number] {
  const planet = PLANETS_DATA.find(p => p.name.toLowerCase() === name.toLowerCase()) || PLANETS_DATA[0];
  // Deterministic starting angles forming an interplanetary corridor
  const angleOffsets: { [key: string]: number } = {
    Mercury: 0.25,
    Venus: 0.75,
    Earth: 1.25,
    Mars: 1.75,
    Jupiter: 2.25,
    Saturn: 2.80,
    Uranus: 3.35,
    Neptune: 3.90
  };
  const baseAngle = angleOffsets[planet.name] ?? 0;
  const currentAngle = baseAngle + time * planet.orbitalSpeed * 0.15;

  const x = Math.cos(currentAngle) * planet.orbitRadius;
  const z = Math.sin(currentAngle) * planet.orbitRadius;
  const y = Math.sin(currentAngle * 2.0) * 1.5; // subtle realistic orbital inclination

  return [x, y, z];
}

export const SolarSystem: React.FC<SolarSystemProps> = ({
  visible = true,
  timeScale = 1.0,
  highlightedPlanet = null,
  onSelectPlanet
}) => {
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const coronaMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const planetPositionsRef = useRef<{ [key: string]: [number, number, number] }>({});
  const [, setTick] = React.useState(0);

  const sunTexture = React.useMemo(() => nasaTextureLoader.getSunTexture(), []);

  const coronaUniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color('#fff2a3') },
      uColorCorona: { value: new THREE.Color('#f97316') }
    }),
    []
  );

  useFrame((state, delta) => {
    if (!visible) return;

    const elapsedTime = state.clock.getElapsedTime();

    // Sun rotation & corona animation
    if (sunMeshRef.current) {
      sunMeshRef.current.rotation.y += delta * 0.02 * timeScale;
    }
    if (coronaMaterialRef.current) {
      coronaMaterialRef.current.uniforms.uTime.value += delta * 1.5;
    }

    // Update planetary coordinates dynamically
    PLANETS_DATA.forEach(planet => {
      planetPositionsRef.current[planet.name] = getPlanetCoordinates(planet.name, elapsedTime * timeScale);
    });
  });

  if (!visible) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* ================= COMPREHENSIVE LIGHTING SYSTEM ================= */}
      {/* 1. Deep Space Ambient Fill: Guarantees zero pitch-black planets */}
      <ambientLight color="#94a3b8" intensity={1.1} />

      {/* 2. Interplanetary Hemisphere Light: Sky blue to cosmic navy */}
      <hemisphereLight args={['#38bdf8', '#0b1329', 0.75]} />

      {/* 3. Camera Angle Fill Light */}
      <directionalLight position={[30, 45, 60]} intensity={1.2} color="#f8fafc" />
      <directionalLight position={[-30, -20, -50]} intensity={0.6} color="#38bdf8" />

      {/* ================= SUN & PRIMARY SOLAR ILLUMINATION ================= */}
      <group position={[0, 0, 0]}>
        {/* Sun Photosphere */}
        <mesh ref={sunMeshRef}>
          <sphereGeometry args={[5.2, 64, 64]} />
          <meshBasicMaterial map={sunTexture} color="#fffbeb" />
        </mesh>

        {/* Dynamic Coronal Flare Atmosphere */}
        <mesh scale={[1.32, 1.32, 1.32]}>
          <sphereGeometry args={[5.2, 32, 32]} />
          <shaderMaterial
            ref={coronaMaterialRef}
            vertexShader={SunCoronaVertexShader}
            fragmentShader={SunCoronaFragmentShader}
            uniforms={coronaUniforms}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Sunlight Omni Point Light */}
        <pointLight
          color="#fffaf0"
          intensity={6.0}
          distance={500}
          decay={0.7}
        />
      </group>

      {/* ================= PLANETS & ORBITAL TRACKS ================= */}
      {PLANETS_DATA.map(planet => {
        const isEarth = planet.name === 'Earth';
        const isHighlighted = highlightedPlanet === planet.name;
        // Use initial deterministic position or current
        const pos = planetPositionsRef.current[planet.name] || getPlanetCoordinates(planet.name, 0);

        return (
          <group key={planet.name}>
            {/* Orbital Track Line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[planet.orbitRadius - 0.08, planet.orbitRadius + 0.08, 128]} />
              <meshBasicMaterial
                color={isHighlighted ? '#00f0ff' : '#38bdf8'}
                transparent
                opacity={isHighlighted ? 0.75 : 0.22}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Planet Body positioned at its 3D orbital location */}
            <group position={pos}>
              {isEarth ? (
                <EarthSystem
                  scale={1.0}
                  isFocused={isHighlighted}
                  onMoonClick={() => onSelectPlanet?.('Moon')}
                />
              ) : (
                <PlanetMesh
                  planet={planet}
                  isFocused={isHighlighted}
                  onClick={() => onSelectPlanet?.(planet.name)}
                />
              )}
            </group>
          </group>
        );
      })}
    </group>
  );
};
