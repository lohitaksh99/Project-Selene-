import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDIDATE_LANDING_SITES } from '../config/missionConfig';
import { LandingSite } from '../types/mission';
import { nasaTextureLoader } from '../utils/nasaTextureLoader';
import { Html } from '@react-three/drei';

interface LunarSurfaceProps {
  visible?: boolean;
  selectedSite: LandingSite | null;
  onSelectSite: (site: LandingSite) => void;
  showScientificOverlays?: boolean;
  wireframeMode?: boolean;
}

// Convert Lunar latitude & longitude to 3D Cartesian coordinates on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export const LunarSurface: React.FC<LunarSurfaceProps> = ({
  visible = true,
  selectedSite,
  onSelectSite,
  showScientificOverlays = true,
  wireframeMode = false
}) => {
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const gridGroupRef = useRef<THREE.Group>(null);
  const scanRingRef = useRef<THREE.Mesh>(null);

  // High-resolution genuine NASA LRO surface texture & LOLA topography bump
  const moonTexture = useMemo(() => nasaTextureLoader.getMoonTexture(), []);
  const moonBumpMap = useMemo(() => nasaTextureLoader.getMoonBump(), []);

  const moonRadius = 6.0;

  // Compute 3D positions for candidate landing sites
  const sitesWith3dPos = useMemo(() => {
    return CANDIDATE_LANDING_SITES.map(site => {
      const pos = latLngToVector3(site.lat, site.lng, moonRadius);
      const normal = pos.clone().normalize();
      return {
        ...site,
        pos3d: pos,
        normal
      };
    });
  }, [moonRadius]);

  useFrame((_, delta) => {
    if (!visible) return;

    // Slow, realistic lunar rotation
    if (moonMeshRef.current) {
      moonMeshRef.current.rotation.y += delta * 0.005;
    }
    if (gridGroupRef.current) {
      gridGroupRef.current.rotation.y += delta * 0.005;
    }

    // Gentle topographic laser altimeter sweep
    if (scanRingRef.current) {
      scanRingRef.current.position.y = -moonRadius + Math.sin(Date.now() * 0.001) * (moonRadius * 1.8);
      const currentY = scanRingRef.current.position.y;
      const r = Math.sqrt(Math.max(0.1, moonRadius * moonRadius - currentY * currentY)) * 1.02;
      scanRingRef.current.scale.set(r, r, 1);
    }
  });

  if (!visible) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* ================= PHOTOREALISTIC HIGH-RELIEF MOON ================= */}
      <mesh
        ref={moonMeshRef}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[moonRadius, 128, 128]} />
        <meshStandardMaterial
          map={moonTexture}
          bumpMap={moonBumpMap}
          bumpScale={0.16}
          roughness={0.86}
          metalness={0.04}
          color="#f8fafc"
          wireframe={wireframeMode}
          wireframeLinewidth={1}
        />
      </mesh>

      {/* Primary directional sunlight: sharp grazing terminator shadows across south pole craters */}
      <directionalLight
        position={[-38, 7, 24]}
        intensity={3.8}
        color="#fffbf0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />

      {/* Earthshine fill light: cool subtle starlight reflection on lunar nightside */}
      <directionalLight
        position={[28, -8, -16]}
        intensity={0.28}
        color="#7dd3fc"
      />
      <ambientLight color="#050814" intensity={0.15} />

      {/* ================= SCIENTIFIC SURVEY OVERLAYS & TOPOGRAPHY ================= */}
      {showScientificOverlays && (
        <group ref={gridGroupRef}>
          {/* Subtle Topographic Laser Altimeter Contour Ring */}
          <mesh
            ref={scanRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.995, 1.005, 96]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Coordinate Wireframe Sphere (Latitude / Longitude Grids) */}
          <mesh scale={[1.004, 1.004, 1.004]}>
            <sphereGeometry args={[moonRadius, 36, 18]} />
            <meshBasicMaterial
              color="#94a3b8"
              wireframe
              transparent
              opacity={0.08}
            />
          </mesh>

          {/* South Polar Target Zone Boundary */}
          <group position={[0, -moonRadius * 0.985, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <ringGeometry args={[1.3, 1.32, 64]} />
              <meshBasicMaterial
                color="#e2e8f0"
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh>
              <ringGeometry args={[2.2, 2.21, 64]} />
              <meshBasicMaterial
                color="#94a3b8"
                transparent
                opacity={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Precision Aerospace Survey Beacons */}
          {sitesWith3dPos.map(site => {
            const isSelected = selectedSite?.id === site.id;
            const markerPos = site.pos3d.clone().multiplyScalar(1.008);

            return (
              <group key={site.id} position={markerPos.toArray()}>
                {/* Thin Geodetic Survey Pin */}
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([
                        0, 0, 0,
                        site.normal.x * 0.55, site.normal.y * 0.55, site.normal.z * 0.55
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial
                    color={isSelected ? '#38bdf8' : '#e2e8f0'}
                    linewidth={1}
                    transparent
                    opacity={isSelected ? 0.9 : 0.5}
                  />
                </line>

                {/* Touchdown Target Circle on Terrain */}
                <mesh
                  position={[site.normal.x * 0.02, site.normal.y * 0.02, site.normal.z * 0.02]}
                  quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), site.normal)}
                >
                  <ringGeometry args={[0.08, 0.12, 32]} />
                  <meshBasicMaterial
                    color={isSelected ? '#38bdf8' : '#e2e8f0'}
                    transparent
                    opacity={isSelected ? 0.9 : 0.6}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Precision Survey Marker Label */}
                <Html
                  position={[site.normal.x * 0.7, site.normal.y * 0.7, site.normal.z * 0.7]}
                  center
                  distanceFactor={16}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSite(site);
                    }}
                    className={`group relative flex items-center gap-2.5 px-3 py-1.5 rounded-md border transition-all duration-200 font-mono text-left cursor-pointer backdrop-blur-sm ${
                      isSelected
                        ? 'bg-[#060c1c]/95 border-sky-400 text-sky-200 shadow-lg'
                        : 'bg-[#050811]/90 hover:bg-[#0b1328]/95 border-white/20 hover:border-sky-400/60 text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-sky-400' : 'bg-slate-400 group-hover:bg-sky-300'
                      }`}
                    />
                    <div className="flex flex-col whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold tracking-wide text-[11px] text-white">
                          {site.name}
                        </span>
                        {site.artemisPriority && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                            PRIORITY
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono tracking-tight">
                        {site.lat > 0 ? `+${site.lat}` : site.lat}° · {site.lng}° | {site.elevation}
                      </span>
                    </div>
                  </button>
                </Html>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
};
