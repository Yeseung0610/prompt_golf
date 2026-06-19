'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls, Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';
import type { Hole, Team } from '@/lib/game/types';
import { BallMarker } from './BallMarker';
import { SharedCourse, COURSE_LENGTH } from './SharedCourse';

const LABEL_COLORS = ['#2f7fb0', '#7a55c9', '#1f9d57', '#e07a2f', '#c2456a', '#0f9aa6'];

interface DashboardSceneProps {
  teams: Team[];
  hole: Hole;
}

/**
 * 대시보드 3D 씬
 * - 조감도 카메라 (자동 회전)
 * - 게임 화면과 동일한 코스 지오메트리
 */
export function DashboardScene({ teams, hole }: DashboardSceneProps) {

  // 필드 정중앙 좌표 (티: z=5, 그린: z=380 → 중앙: z=190)
  const FIELD_CENTER_Z = 190;
  const FIELD_CENTER_Y = 8;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 150, FIELD_CENTER_Z - 200], fov: 50, near: 0.1, far: 2000 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Sky sunPosition={[200, 80, -200]} turbidity={5} rayleigh={1} />
        <Clouds material={THREE.MeshBasicMaterial} position={[0, 100, FIELD_CENTER_Z]}>
          <Cloud seed={2} bounds={[300, 20, 100]} volume={40} color="#ffffff" opacity={0.6} />
          <Cloud seed={5} bounds={[250, 15, 80]} volume={30} color="#f0f5ff" opacity={0.5} />
        </Clouds>

        <hemisphereLight args={['#cfe8ff', '#3a5a32', 0.75]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[150, 200, FIELD_CENTER_Z]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-350}
          shadow-camera-right={350}
          shadow-camera-top={350}
          shadow-camera-bottom={-350}
          shadow-camera-far={800}
        />

        {/* 공유 코스 (물리 없음) */}
        <SharedCourse enablePhysics={false} />

        {/* 모든 팀 공 표시 */}
        {teams.map((team, i) => {
          const progress = hole.distance > 0 ? team.totalDistance / hole.distance : 0;
          const teamZ = 5 + THREE.MathUtils.clamp(progress, 0, 1) * 375;
          const teamX = THREE.MathUtils.clamp(team.ballPosition.x * 0.4, -30, 30);
          const isAtTee = progress < 0.005;

          return (
            <BallMarker
              key={team.id}
              position={[isAtTee ? 0 : teamX, 1.5, isAtTee ? 5 : teamZ]}
              radius={1.2}
              label={team.name}
              labelColor={LABEL_COLORS[i % LABEL_COLORS.length]}
              imageUrl={team.imageUrl}
              snap
            />
          );
        })}

        {/* 조감도 카메라 (필드 정중앙 기준, 자동 회전) */}
        <OrbitControls
          target={[0, FIELD_CENTER_Y, FIELD_CENTER_Z]}
          enablePan={false}
          minPolarAngle={0.3}
          maxPolarAngle={1.3}
          minDistance={150}
          maxDistance={500}
          autoRotate
          autoRotateSpeed={0.2}
        />

        <fog attach="fog" args={['#bfdcf0', 500, 1400]} />
      </Suspense>
    </Canvas>
  );
}
