import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { nasaTextureLoader } from '../utils/nasaTextureLoader';
import { AtmosphereVertexShader, AtmosphereFragmentShader } from '../shaders/atmosphereShader';
import { Html } from '@react-three/drei';

interface EarthSystemProps {
  position?: [number, number, number];
  scale?: number;
  showMoon?: boolean;
  onMoonClick?: () => void;
  isFocused?: boolean;
}

export const EarthSystem: React.FC<EarthSystemProps> = ({
  position = [0, 0, 0],
  scale = 1.0,
  showMoon = true,
  onMoonClick,
  isFocused = false
}) => {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const moonOrbitGroupRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);

  // Genuine NASA Blue Marble & Cloud textures
  const earthTexture = React.useMemo(() => nasaTextureLoader.getEarthTexture(), []);
  const cloudsTexture = React.useMemo(() => nasaTextureLoader.getEarthClouds(), []);
  const moonTexture = React.useMemo(() => nasaTextureLoader.getMoonTexture(), []);
  const moonBumpMap = React.useMemo(() => nasaTextureLoader.getMoonBump(), []);

  const atmosphereUniforms = React.useMemo(
    () => ({
      uColor: { value: new THREE.Color('#38bdf8') }, // NASA Blue Marble atmospheric limb
      uCoefficient: { value: 0.85 },
      uPower: { value: 2.2 }
    }),
    []
  );

  useFrame((_, delta) => {
    // Earth axial rotation
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.08;
    }
    // Atmospheric winds / clouds travel slightly faster
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.105;
    }
    // Moon revolution
    if (moonOrbitGroupRef.current) {
      moonOrbitGroupRef.current.rotation.y += delta * 0.025;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.rotation.y += delta * 0.025;
    }
  });

  const earthRadius = 2.2 * scale;
  const moonRadius = 0.6 * scale;
  const moonDistance = 7.5 * scale;

  return (
    <group position={position}>
      {/* Earth Group with 23.4° Axial Tilt */}
      <group rotation={[0.409, 0, 0]}>
        {/* Genuine NASA Earth Surface Mesh */}
        <mesh ref={earthRef} castShadow receiveShadow>
          <sphereGeometry args={[earthRadius, 64, 64]} />
          <meshStandardMaterial
            map={earthTexture}
            color="#ffffff"
            roughness={0.55}
            metalness={0.06}
            emissive="#1e3a8a"
            emissiveIntensity={0.12}
          />
        </mesh>

        {/* Dynamic Genuine NASA Cloud Sphere */}
        <mesh ref={cloudsRef} scale={[1.02, 1.02, 1.02]}>
          <sphereGeometry args={[earthRadius, 64, 64]} />
          <meshStandardMaterial
            map={cloudsTexture}
            transparent
            opacity={0.88}
            depthWrite={false}
            roughness={0.9}
          />
        </mesh>

        {/* Rayleigh Atmosphere Scattering Glow */}
        <mesh scale={[1.18, 1.18, 1.18]}>
          <sphereGeometry args={[earthRadius, 32, 32]} />
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
      </group>

      {/* Orbiting Moon with Genuine NASA LRO Texture */}
      {showMoon && (
        <group ref={moonOrbitGroupRef}>
          <mesh
            ref={moonMeshRef}
            position={[moonDistance, 0.4, 0]}
            castShadow
            receiveShadow
            onClick={onMoonClick}
          >
            <sphereGeometry args={[moonRadius, 48, 48]} />
            <meshStandardMaterial
              map={moonTexture}
              bumpMap={moonBumpMap}
              bumpScale={0.045}
              color="#ffffff"
              roughness={0.85}
              metalness={0.05}
              emissive="#334155"
              emissiveIntensity={0.12}
            />
          </mesh>

          {/* Lunar Orbit Indicator Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[moonDistance - 0.04, moonDistance + 0.04, 64]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* 3D Targeting HUD Tag */}
      <Html position={[0, earthRadius + 1.4, 0]} center distanceFactor={25}>
        <div
          className={`flex flex-col items-center pointer-events-auto cursor-pointer transition-all ${
            isFocused ? 'scale-110 opacity-100' : 'opacity-85 hover:opacity-100 hover:scale-105'
          }`}
        >
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/85 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.4)] whitespace-nowrap text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-display font-bold text-white tracking-wider">
              EARTH // THE CRADLE
            </span>
            <span className="text-cyan-300 text-[9px]">
              12,742 km • 1.00g
            </span>
          </div>
          <div className="w-px h-3 bg-cyan-400/60" />
        </div>
      </Html>
    </group>
  );
};
