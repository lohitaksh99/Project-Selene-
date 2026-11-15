import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetData } from '../types/mission';
import { nasaTextureLoader } from '../utils/nasaTextureLoader';
import { AtmosphereVertexShader, AtmosphereFragmentShader } from '../shaders/atmosphereShader';
import { Html } from '@react-three/drei';

interface PlanetMeshProps {
  planet: PlanetData;
  position?: [number, number, number];
  scaleMultiplier?: number;
  showAtmosphere?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
}

export const PlanetMesh: React.FC<PlanetMeshProps> = ({
  planet,
  position = [0, 0, 0],
  scaleMultiplier = 1.0,
  showAtmosphere = true,
  isFocused = false,
  onClick
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Load authentic NASA planetary surface texture & bump map
  const { map: texture, bump: bumpMap } = React.useMemo(() => {
    return nasaTextureLoader.getPlanetTexture(planet.name);
  }, [planet.name]);

  const ringTexture = React.useMemo(() => {
    if (!planet.hasRings) return null;
    return nasaTextureLoader.getSaturnRing();
  }, [planet.hasRings]);

  // Atmospheric shader uniforms
  const atmosphereUniforms = React.useMemo(() => {
    if (!planet.atmosphereColor) return null;
    return {
      uColor: { value: new THREE.Color(planet.atmosphereColor) },
      uCoefficient: { value: 0.75 },
      uPower: { value: 2.2 }
    };
  }, [planet.atmosphereColor]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * planet.rotationSpeed * 8;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.003;
    }
  });

  const radius = planet.size * scaleMultiplier;

  return (
    <group position={position} onClick={onClick}>
      {/* Planetary Body with Genuine NASA Texture */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={bumpMap}
          bumpScale={0.05}
          color="#ffffff"
          roughness={0.65}
          metalness={0.04}
          emissive={planet.color}
          emissiveIntensity={0.12}
        />
      </mesh>

      {/* Saturn Rings with Genuine NASA Texture */}
      {planet.hasRings && (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2.3, 0.35, 0]}
          receiveShadow
        >
          {/* Ring geometry: inner radius, outer radius, segments */}
          <ringGeometry args={[radius * 1.35, radius * 2.8, 64]} />
          <meshStandardMaterial
            map={ringTexture || undefined}
            color="#fef08a"
            side={THREE.DoubleSide}
            transparent
            opacity={0.96}
            roughness={0.4}
            metalness={0.1}
            emissive="#78350f"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}

      {/* Atmospheric Rayleigh Scattering Glow */}
      {showAtmosphere && atmosphereUniforms && (
        <mesh scale={[1.18, 1.18, 1.18]}>
          <sphereGeometry args={[radius, 32, 32]} />
          <shaderMaterial
            vertexShader={AtmosphereVertexShader}
            fragmentShader={AtmosphereFragmentShader}
            uniforms={atmosphereUniforms}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 3D Targeting HUD Tag */}
      <Html position={[0, radius + 1.2, 0]} center distanceFactor={25}>
        <div
          className={`flex flex-col items-center pointer-events-auto cursor-pointer transition-all ${
            isFocused ? 'scale-110 opacity-100' : 'opacity-85 hover:opacity-100 hover:scale-105'
          }`}
        >
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/85 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.4)] whitespace-nowrap text-[10px] font-mono">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: planet.color }}
            />
            <span className="font-display font-bold text-white tracking-wider">
              {planet.name.toUpperCase()}
            </span>
            <span className="text-cyan-300 text-[9px]">
              {planet.stats.diameter}
            </span>
          </div>
          <div className="w-px h-3 bg-cyan-400/60" />
        </div>
      </Html>
    </group>
  );
};
