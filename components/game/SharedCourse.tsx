'use client';

import { useMemo } from 'react';
import { PalmTree, Rock, Flag, MountainRange } from './CourseProps';
import { Ocean } from './Ocean';
import { Lagoon } from './Lagoon';
import { TerrainShaderMesh } from './TerrainShader';
// HazardSensors는 Rapier 기반이므로 경량 물리에서는 사용하지 않음
// 해저드 감지는 BallSimulator의 TerrainSampler에서 수행
import { HOLE_1_LAYOUT, getTerrainHeight } from '@/lib/game/courseLayout';

/** 열대 해변 코스 길이 (450m) */
export const COURSE_LENGTH = 450;

/** 그린 위치 (S-커브 끝) - Y는 지형 높이에서 계산 */
const GREEN_X = -15;
const GREEN_Z = 380;
export const GREEN_POSITION = {
  x: GREEN_X,
  z: GREEN_Z,
  get y() { return getTerrainHeight(GREEN_X, GREEN_Z, HOLE_1_LAYOUT); }
};

interface SharedCourseProps {
  /** 물리 충돌 활성화 (더 이상 사용하지 않음 - 경량 물리 사용) */
  enablePhysics?: boolean;
  /** 해저드 진입 콜백 (더 이상 사용하지 않음 - BallSimulator에서 처리) */
  onHazardEnter?: (hazardId: string) => void;
}

/**
 * 열대 해변 골프 코스
 * - 왼쪽: 청록색 바다 + 백사장 해변
 * - 오른쪽 상단: 라군/워터 해저드
 * - S-커브 페어웨이
 * - 야자수 군락
 */
export function SharedCourse({
  enablePhysics = false,
  onHazardEnter,
}: SharedCourseProps) {
  // 야자수 배치 - 해변, 러프, 라군 주변에 자연스럽게 군락
  // 지형 높이에 맞춤
  const palmPositions = useMemo(() => {
    const arr: Array<{
      position: [number, number, number];
      scale: number;
    }> = [];

    // 왼쪽 해변 야자수 (바다와 코스 사이) - 더 넓게
    for (let i = 0; i < 50; i++) {
      const z = -100 + i * 14 + Math.random() * 8;
      const x = -90 - Math.random() * 40;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 2.0 + Math.random() * 1.2,
      });
    }

    // 오른쪽 숲 가장자리 야자수 - 더 넓게
    for (let i = 0; i < 35; i++) {
      const z = -30 + i * 16 + Math.random() * 10;
      const x = 70 + Math.random() * 60;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 2.2 + Math.random() * 1.0,
      });
    }

    // 라군 주변 야자수
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 35 + Math.random() * 10;
      const x = 55 + Math.cos(angle) * radius;
      const z = 320 + Math.sin(angle) * radius * 0.8;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 1.8 + Math.random() * 0.8,
      });
    }

    // 그린 뒤쪽 야자수
    for (let i = 0; i < 10; i++) {
      const x = -50 + i * 12 + Math.random() * 5;
      const z = 420 + Math.random() * 20;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 2.5 + Math.random() * 1.0,
      });
    }

    // 티박스 주변 야자수
    for (let i = 0; i < 6; i++) {
      const x = (i < 3 ? -45 : 45) + Math.random() * 10;
      const z = -10 + Math.random() * 30;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 2.0 + Math.random() * 0.8,
      });
    }

    return arr;
  }, []);

  // 해변/해안가 바위 배치 - 지형 높이에 맞춤
  const rockPositions = useMemo(() => {
    const arr: Array<{
      position: [number, number, number];
      scale: number;
      variant: 'small' | 'medium' | 'large';
    }> = [];

    // 해안선 바위 - 더 넓게
    for (let i = 0; i < 30; i++) {
      const z = -80 + i * 22 + Math.random() * 15;
      const x = -130 - Math.random() * 30;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT) - 0.3;
      arr.push({
        position: [x, y, z],
        scale: 0.8 + Math.random() * 0.8,
        variant: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small',
      });
    }

    // 라군 주변 바위
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 1.5 + Math.PI * 0.25;
      const x = 55 + Math.cos(angle) * 28;
      const z = 320 + Math.sin(angle) * 22;
      const y = getTerrainHeight(x, z, HOLE_1_LAYOUT);
      arr.push({
        position: [x, y, z],
        scale: 0.5 + Math.random() * 0.4,
        variant: 'medium',
      });
    }

    return arr;
  }, []);

  return (
    <group>
      {/* 거대한 바닥 평면 (모든 빈 공간 채움) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 200]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#2d6b3a" roughness={0.95} />
      </mesh>

      {/* 지형 - ShaderMaterial로 픽셀 단위 선명한 경계 */}
      <TerrainShaderMesh layout={HOLE_1_LAYOUT} length={COURSE_LENGTH} width={1000} />

      {/* 바다 (왼쪽) - 지평선까지 펼쳐짐 */}
      <Ocean
        position={[-300, -0.3, 250]}
        size={[300, 900]}
      />

      {/* 라군/워터 해저드 (오른쪽 상단) */}
      <Lagoon
        position={[55, -0.2, 320]}
        size={[50, 60]}
        hazardId="lagoon"
      />

      {/*
        그린, 티박스, 벙커는 TerrainMesh에서 색상+높이로 통합 처리됨
        - 그린: 밝은 초록색 + 평평한 영역
        - 티박스: 짙은 초록색
        - 벙커: 모래색 + 움푹 파인 지형
        별도 오버레이 메시 불필요 (언덕 굴곡과 맞지 않는 문제 해결)
      */}

      {/* 티 마커만 표시 */}
      <mesh position={[0, getTerrainHeight(0, 5, HOLE_1_LAYOUT) + 0.5, 5]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.9, 8]} />
        <meshStandardMaterial color="#d4b896" />
      </mesh>

      {/* 야자수들 */}
      {palmPositions.map((palm, i) => (
        <PalmTree
          key={`palm-${i}`}
          position={palm.position}
          scale={palm.scale}
          physics={enablePhysics}
        />
      ))}

      {/* 바위들 */}
      {rockPositions.map((rock, i) => (
        <Rock
          key={`rock-${i}`}
          position={rock.position}
          scale={rock.scale}
          variant={rock.variant}
        />
      ))}

      {/* 배경 열대 산맥 - 넓게 펼쳐짐 */}
      <MountainRange z={COURSE_LENGTH + 150} spread={700} count={18} baseColor="#3a7a55" />
      <MountainRange z={COURSE_LENGTH + 100} spread={500} count={12} baseColor="#4a8a60" />

      {/* 깃발 */}
      <Flag position={[GREEN_POSITION.x, GREEN_POSITION.y, GREEN_POSITION.z]} height={7} />

      {/*
        해저드 센서는 경량 물리 시뮬레이터에서 불필요
        BallSimulator.getState().zone으로 현재 지형 타입 확인 가능
      */}
    </group>
  );
}
