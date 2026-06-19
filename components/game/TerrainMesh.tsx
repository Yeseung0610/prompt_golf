'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { CourseLayout, HillDefinition } from '@/lib/game/types';
import { getFairwayCenterX, getFairwayWidth, HOLE_1_LAYOUT } from '@/lib/game/courseLayout';

// Rapier 기반 물리 충돌체는 경량 시뮬레이터로 대체됨
// TerrainCollider, TerrainMesh는 더 이상 사용되지 않음

interface TerrainMeshProps {
  layout: CourseLayout;
  length?: number;
  width?: number;
  segments?: number;
}

/**
 * 벙커 정의 (위치, 반경, 깊이)
 * 깊이를 현실적으로 조정 (실제 벙커는 1~2m 정도 파여있음)
 */
const BUNKERS = [
  { x: -35, z: 365, radius: 10, depth: 1.8 },  // 그린사이드 벙커 (깊음)
  { x: -40, z: 385, radius: 8, depth: 1.5 },   // 그린사이드 벙커
  { x: 10, z: 370, radius: 11, depth: 2.0 },   // 그린사이드 벙커 (가장 깊음)
  { x: -10, z: 400, radius: 12, depth: 1.6 },  // 그린 뒤 벙커
  { x: 25, z: 160, radius: 10, depth: 1.2 },   // 페어웨이 벙커
  { x: -30, z: 270, radius: 9, depth: 1.0 },   // 페어웨이 벙커
];

// 벙커 데이터 export (게임 로직에서 사용)
export { BUNKERS };

/**
 * 벙커 정보 반환 (안에 있는지, 테두리인지, 깊이)
 */
function getBunkerInfo(x: number, z: number): { inside: boolean; isEdge: boolean; depth: number } {
  for (const bunker of BUNKERS) {
    const dx = x - bunker.x;
    const dz = z - bunker.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < bunker.radius) {
      const t = dist / bunker.radius;
      const depth = bunker.depth * (1 - t * t);
      // 테두리: 반지름의 85% ~ 100% 영역
      const isEdge = t > 0.85;
      return { inside: true, isEdge, depth };
    }
  }
  return { inside: false, isEdge: false, depth: 0 };
}

/**
 * 벙커 깊이만 반환 (높이 계산용)
 */
function getBunkerDepth(x: number, z: number): number {
  return getBunkerInfo(x, z).depth;
}

/**
 * Calculate height at a position based on hills
 */
function calculateHeight(x: number, z: number, hills: HillDefinition[]): number {
  let height = 0;

  for (const hill of hills) {
    const dx = x - hill.position[0];
    const dz = z - hill.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < hill.radius) {
      const t = dist / hill.radius;
      const contribution = (hill.height * (1 + Math.cos(Math.PI * t))) / 2;
      height = Math.max(height, contribution);
    }
  }

  // 벙커 영역은 파인 깊이만큼 낮춤
  const bunkerDepth = getBunkerDepth(x, z);
  height -= bunkerDepth;

  return height;
}

// 노이즈 함수 제거 - 선명한 경계를 위해 단색 사용

/**
 * Tropical Seaside Golf Course Colors
 * - 그린: 밝고 선명한 열대 잔디
 * - 페어웨이: 청록빛 밝은 잔디
 * - 러프: 열대 식물 느낌
 * - 해변: 백사장
 * - 바다: 청록색 그라데이션
 */
function getGroundColor(x: number, z: number, length: number): THREE.Color {
  // === 벙커 영역 체크 (가장 먼저) ===
  const bunkerInfo = getBunkerInfo(x, z);
  if (bunkerInfo.inside) {
    // 벙커 내부 - 밝은 모래색
    return new THREE.Color('#F5E8D0');
  }

  // === 티박스 영역 (z: 0~10, x: -9~9) ===
  const teeBoxX = 9, teeBoxZMin = 0, teeBoxZMax = 10;
  if (z >= teeBoxZMin && z <= teeBoxZMax && Math.abs(x) <= teeBoxX) {
    // 티박스 - 밝은 잔디
    return new THREE.Color('#5DBE62');
  }

  // === 바다 영역 (왼쪽, x < -150) ===
  if (x < -150) {
    // 열대 청록색 바다
    return new THREE.Color('#20B2AA');
  }

  // === 해변 영역 (-150 < x < -70) ===
  if (x < -70) {
    // 백사장
    return new THREE.Color('#F5DEB3');
  }

  // === 그린 영역 ===
  const greenCenterX = -15;
  const greenCenterZ = 380;
  const greenRadius = 30;
  const distToGreen = Math.sqrt(
    (x - greenCenterX) * (x - greenCenterX) +
    (z - greenCenterZ) * (z - greenCenterZ)
  );

  // 그린 내부 - 매우 밝은 초록
  if (distToGreen <= greenRadius) {
    return new THREE.Color('#7CCD7C');
  }

  // 프린지 (칼라)
  if (distToGreen <= greenRadius + 5) {
    return new THREE.Color('#5CB85C');
  }

  // === 페어웨이 계산 ===
  const fairwayCenterX = getFairwayCenterX(z);
  const fairwayWidth = getFairwayWidth(z);
  const distFromFairwayCenter = Math.abs(x - fairwayCenterX);
  const halfWidth = fairwayWidth / 2;

  if (z >= 10 && z <= 420) {
    // === 페어웨이 중심 - 스트라이프 패턴 ===
    if (distFromFairwayCenter <= halfWidth) {
      // 선명한 스트라이프 패턴
      const stripeIndex = Math.floor(z / 10);
      const isLightStripe = stripeIndex % 2 === 0;
      return new THREE.Color(isLightStripe ? '#6FCF6F' : '#5DBF5D');
    }

    // === 퍼스트 컷 (세미러프) ===
    if (distFromFairwayCenter <= halfWidth + 6) {
      return new THREE.Color('#4CAF50');
    }

    // === 세컨드 컷 (라이트 러프) ===
    if (distFromFairwayCenter <= halfWidth + 12) {
      return new THREE.Color('#3D8B40');
    }
  }

  // === 러프 영역 ===
  return new THREE.Color('#2E7D32');
}

/**
 * 특정 위치의 높이 계산 (지형 생성용)
 */
function getHeightAt(x: number, z: number, hills: HillDefinition[]): number {
  if (x < -150) {
    return -0.8; // 바다
  } else if (x < -75) {
    const beachProgress = (x + 150) / 75;
    return beachProgress * 0.5; // 해변
  } else {
    return calculateHeight(x, z, hills); // 코스
  }
}

/**
 * Generate terrain geometry with hills and S-curved fairway
 * 기본 indexed geometry 사용 - 부드러운 색상 보간
 */
function createTerrainGeometry(
  layout: CourseLayout,
  length: number,
  width: number,
  segments: number
) {
  // 시야 끝까지 펼쳐지는 넓은 지형 (티박스 뒤쪽까지 확장)
  const extendedLength = length + 400;

  // 기본 PlaneGeometry 생성
  const geo = new THREE.PlaneGeometry(width, extendedLength, segments, segments);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (length / 2) + 50);

  const positions = geo.attributes.position;
  const colors: number[] = [];

  // 각 vertex의 높이와 색상 설정
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    // 높이 설정
    const h = getHeightAt(x, z, layout.hills);
    positions.setY(i, h);

    // 색상 설정 (vertex colors - 자연스럽게 보간됨)
    const color = getGroundColor(x, z, length);
    colors.push(color.r, color.g, color.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Extract for physics
  const posArray = geo.attributes.position.array as Float32Array;
  const vertices = Array.from(posArray);

  return { geometry: geo, vertices, indices: [] };
}

/**
 * Visual terrain mesh (renders independently of physics)
 */
export function TerrainVisual({
  layout,
  length = 450,
  width = 1000,
  segments = 150,  // 적절한 해상도
}: TerrainMeshProps) {
  const geometry = useMemo(() => {
    return createTerrainGeometry(layout, length, width, segments).geometry;
  }, [layout, length, width, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} />
    </mesh>
  );
}

// TerrainCollider와 TerrainMesh는 경량 물리 시뮬레이터로 대체됨
// 충돌 검사는 BallSimulator가 TerrainSampler를 통해 높이맵으로 수행
