import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GalaxyVertexShader, GalaxyFragmentShader } from '../shaders/galaxyShader';

interface GalaxyProps {
  visible?: boolean;
  opacity?: number;
}

export const Galaxy: React.FC<GalaxyProps> = ({ visible = true, opacity = 1.0 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate 50,000 spiral galaxy stars with realistic arms & bulge
  const { positions, colors, sizes, twinkleSpeeds, brightnesses } = useMemo(() => {
    const count = 48000;
    const branches = 4; // 4-arm spiral like the Milky Way
    const radius = 90;
    const spin = 1.4;
    const randomness = 0.45;
    const power = 3.5;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    const brightnesses = new Float32Array(count);

    // Color palettes for Milky Way
    // Core: warm stellar gold/amber (Population II stars)
    // Arms: hot young blue/cyan O/B stars and H-II reddish dust regions
    const colorInside = new THREE.Color('#ffdfa0');
    const colorMid = new THREE.Color('#64b5f6');
    const colorOutside = new THREE.Color('#38bdf8');
    const colorNebulaDust = new THREE.Color('#d946ef');

    for (let i = 0; i < count; i++) {
      // Distance from galactic center (densest at center)
      const r = Math.pow(Math.random(), power) * radius;

      // Arm branch angle
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * (spin / 10);

      // Random scatter offsets (thicker near core, thinner in disk)
      const diskThickness = Math.max(0.6, (1.0 - r / radius) * 6.0);
      const randomX = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
      const randomY = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1) * randomness * diskThickness;
      const randomZ = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;

      const angle = branchAngle + spinAngle;

      positions[i * 3] = Math.cos(angle) * r + randomX;
      positions[i * 3 + 1] = randomY;
      positions[i * 3 + 2] = Math.sin(angle) * r + randomZ;

      // Color gradation
      const mixedColor = colorInside.clone();
      const normRadius = r / radius;

      if (normRadius < 0.25) {
        mixedColor.lerp(colorMid, normRadius * 4);
      } else if (normRadius < 0.7) {
        mixedColor.copy(colorMid).lerp(colorOutside, (normRadius - 0.25) / 0.45);
      } else {
        mixedColor.copy(colorOutside).lerp(colorNebulaDust, (normRadius - 0.7) / 0.3);
      }

      // Add slight chromatic aberration / color jitter
      colors[i * 3] = mixedColor.r + (Math.random() - 0.5) * 0.12;
      colors[i * 3 + 1] = mixedColor.g + (Math.random() - 0.5) * 0.12;
      colors[i * 3 + 2] = mixedColor.b + (Math.random() - 0.5) * 0.12;

      // Star point sizes
      sizes[i] = r < 12 ? Math.random() * 2.8 + 1.2 : Math.random() * 2.2 + 0.6;
      twinkleSpeeds[i] = 1.0 + Math.random() * 3.5;
      brightnesses[i] = 0.5 + Math.random() * 0.5;
    }

    return { positions, colors, sizes, twinkleSpeeds, brightnesses };
  }, []);

  // Custom uniforms for galaxy shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 },
      uOpacity: { value: opacity }
    }),
    []
  );

  useFrame((state, delta) => {
    if (!visible || opacity <= 0.001) return;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uOpacity.value,
        opacity,
        0.08
      );
    }
    if (pointsRef.current) {
      // Galaxy slow rotation around supermassive black hole Sag A*
      pointsRef.current.rotation.y += delta * 0.02;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.03;
    }
  });

  if (!visible || opacity <= 0.001) return null;

  return (
    <group position={[-20, 15, -160]} rotation={[0.55, 0.2, 0.3]} scale={[1.4, 1.4, 1.4]}>
      {/* Galactic Bulge / Core Glow Mesh */}
      <mesh ref={coreRef} position={[0, 0, 0]}>
        <sphereGeometry args={[4.5, 32, 32]} />
        <meshBasicMaterial
          color="#ffebc2"
          transparent
          opacity={0.85 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Secondary Volumetric Core Halo */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[8.5, 32, 32]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.35 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 50,000 Particle Spiral Starfield */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            count={sizes.length}
            array={sizes}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aTwinkleSpeed"
            count={twinkleSpeeds.length}
            array={twinkleSpeeds}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBrightness"
            count={brightnesses.length}
            array={brightnesses}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={GalaxyVertexShader}
          fragmentShader={GalaxyFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
