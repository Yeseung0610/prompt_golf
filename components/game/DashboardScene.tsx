'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls, Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';
import type { Hole, Team } from '@/lib/game/types';
import { Tree, Bunker, WaterHazard, Flag, MountainRange } from './CourseProps';
import { BallMarker } from './BallMarker';

const LEN = 82;

const LABEL_COLORS = ['#2f7fb0', '#7a55c9', '#1f9d57', '#e07a2f', '#c2456a', '#0f9aa6'];

interface DashboardSceneProps {
  teams: Team[];
  hole: Hole;
}

function Field() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -LEN / 2]} receiveShadow>
        <planeGeometry args={[160, LEN + 80]} />
        <meshStandardMaterial color="#2f6d33" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -LEN / 2]} receiveShadow>
        <planeGeometry args={[18, LEN + 8]} />
        <meshStandardMaterial color="#54a64f" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -LEN + 4]} receiveShadow>
        <circleGeometry args={[11, 40]} />
        <meshStandardMaterial color="#6fcf63" roughness={0.85} />
      </mesh>

      <WaterHazard position={[-24, 0, -26]} args={[28, 34]} />
      <WaterHazard position={[26, 0, -58]} args={[22, 26]} />

      <Bunker position={[-8, 0.02, -LEN + 9]} scale={3.2} />
      <Bunker position={[9, 0.02, -LEN + 6]} scale={3.6} />
      <Bunker position={[6, 0.02, -34]} scale={2.6} />

      {Array.from({ length: 10 }).map((_, i) => {
        const z = -6 - i * 8;
        return (
          <group key={i}>
            <Tree position={[-13, 0, z]} scale={1.1 + (i % 3) * 0.2} />
            <Tree position={[13.5, 0, z]} scale={1 + (i % 2) * 0.3} />
          </group>
        );
      })}

      <MountainRange z={-LEN - 26} spread={200} count={12} baseColor="#5f7d68" />

      <Flag position={[0, 0, -LEN + 4]} height={3.6} />
    </group>
  );
}

export function DashboardScene({ teams, hole }: DashboardSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [22, 34, 46], fov: 42, near: 0.1, far: 600 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Sky sunPosition={[60, 40, -60]} turbidity={5} rayleigh={1} />
        <Clouds material={THREE.MeshBasicMaterial} position={[0, 34, -50]}>
          <Cloud seed={2} bounds={[80, 6, 30]} volume={12} color="#ffffff" opacity={0.65} />
        </Clouds>

        <hemisphereLight args={['#cfe8ff', '#3a5a32', 0.75]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[40, 50, 20]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-90}
          shadow-camera-right={90}
          shadow-camera-top={90}
          shadow-camera-bottom={-90}
          shadow-camera-far={200}
        />

        <Field />

        {teams.map((team, i) => {
          const progress = hole.distance > 0 ? team.totalDistance / hole.distance : 0;
          const z = -THREE.MathUtils.clamp(progress, 0, 1) * (LEN - 4);
          const x = THREE.MathUtils.clamp(team.ballPosition.x * 0.12, -8, 8);
          return (
            <BallMarker
              key={team.id}
              position={[x, 0.1, z]}
              radius={0.5}
              label={team.name}
              labelColor={LABEL_COLORS[i % LABEL_COLORS.length]}
              imageUrl={team.imageUrl}
              snap
            />
          );
        })}

        <OrbitControls
          target={[0, 1, -38]}
          enablePan={false}
          minPolarAngle={0.5}
          maxPolarAngle={1.15}
          minDistance={30}
          maxDistance={90}
          autoRotate
          autoRotateSpeed={0.35}
        />

        <fog attach="fog" args={['#bfdcf0', 130, 320]} />
      </Suspense>
    </Canvas>
  );
}
