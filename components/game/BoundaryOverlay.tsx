'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { CourseLayout } from '@/lib/game/types';
import { getFairwayCenterX, getFairwayWidth, getTerrainHeight } from '@/lib/game/courseLayout';

/**
 * 벙커 정의
 */
const BUNKERS = [
  { x: -35, z: 365, radius: 10 },
  { x: -40, z: 385, radius: 8 },
  { x: 10, z: 370, radius: 11 },
  { x: -10, z: 400, radius: 12 },
  { x: 25, z: 160, radius: 10 },
  { x: -30, z: 270, radius: 9 },
];

interface BoundaryOverlayProps {
  layout: CourseLayout;
}

/**
 * 원형 경계선 포인트 생성 (그린, 벙커용)
 */
function createCirclePoints(
  centerX: number,
  centerZ: number,
  radius: number,
  segments: number,
  layout: CourseLayout,
  yOffset: number = 0.15
): [number, number, number][] {
  const points: [number, number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const y = getTerrainHeight(x, z, layout) + yOffset;
    points.push([x, y, z]);
  }

  return points;
}

/**
 * S-커브 페어웨이 경계선 포인트 생성
 */
function createFairwayBoundaryPoints(
  layout: CourseLayout,
  side: 'left' | 'right',
  yOffset: number = 0.15
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const startZ = 10;
  const endZ = 380;
  const step = 5;

  for (let z = startZ; z <= endZ; z += step) {
    const centerX = getFairwayCenterX(z);
    const width = getFairwayWidth(z);
    const halfWidth = width / 2;

    const x = side === 'left' ? centerX - halfWidth : centerX + halfWidth;
    const y = getTerrainHeight(x, z, layout) + yOffset;
    points.push([x, y, z]);
  }

  return points;
}

/**
 * 티박스 경계선 포인트 생성
 */
function createTeeboxBoundaryPoints(
  layout: CourseLayout,
  yOffset: number = 0.15
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const corners: [number, number][] = [
    [-9, 0], [9, 0], [9, 10], [-9, 10], [-9, 0]
  ];

  for (const [x, z] of corners) {
    const y = getTerrainHeight(x, z, layout) + yOffset;
    points.push([x, y, z]);
  }

  return points;
}

/**
 * 경계선 오버레이 컴포넌트
 * 페어웨이, 그린, 벙커, 티박스의 경계를 선명하게 표시
 */
export function BoundaryOverlay({ layout }: BoundaryOverlayProps) {
  const lineData = useMemo(() => {
    const greenCenter = { x: -15, z: 380 };
    const greenRadius = 30;
    const fringeRadius = 35;

    return {
      // 그린 경계
      green: createCirclePoints(greenCenter.x, greenCenter.z, greenRadius, 64, layout),
      fringe: createCirclePoints(greenCenter.x, greenCenter.z, fringeRadius, 64, layout),

      // 벙커 경계들
      bunkers: BUNKERS.map(b => createCirclePoints(b.x, b.z, b.radius, 32, layout)),

      // 페어웨이 경계
      fairwayLeft: createFairwayBoundaryPoints(layout, 'left'),
      fairwayRight: createFairwayBoundaryPoints(layout, 'right'),

      // 티박스 경계
      teebox: createTeeboxBoundaryPoints(layout),
    };
  }, [layout]);

  return (
    <group>
      {/* 그린 경계 */}
      <Line
        points={lineData.green}
        color="#2d5a2d"
        lineWidth={2}
        transparent
        opacity={0.7}
      />
      <Line
        points={lineData.fringe}
        color="#1a3d1a"
        lineWidth={1.5}
        transparent
        opacity={0.5}
      />

      {/* 벙커 경계들 */}
      {lineData.bunkers.map((points, i) => (
        <Line
          key={`bunker-${i}`}
          points={points}
          color="#8b7355"
          lineWidth={2}
          transparent
          opacity={0.8}
        />
      ))}

      {/* 페어웨이 경계 */}
      <Line
        points={lineData.fairwayLeft}
        color="#1a3d1a"
        lineWidth={1.5}
        transparent
        opacity={0.5}
      />
      <Line
        points={lineData.fairwayRight}
        color="#1a3d1a"
        lineWidth={1.5}
        transparent
        opacity={0.5}
      />

      {/* 티박스 경계 */}
      <Line
        points={lineData.teebox}
        color="#1a3d1a"
        lineWidth={1.5}
        transparent
        opacity={0.5}
      />
    </group>
  );
}
