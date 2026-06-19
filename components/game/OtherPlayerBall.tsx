'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BALL_RADIUS } from '@/lib/physics/config';

interface OtherPlayerBallProps {
  /** 플레이어 ID */
  playerId: string;
  /** 플레이어 이름 */
  name: string;
  /** 공 위치 */
  position: { x: number; z: number };
  /** 총 이동 거리 (고도 계산용) */
  totalDistance: number;
  /** 홀 총 거리 */
  holeDistance: number;
  /** 공이 날아가는 중인지 */
  isFlying?: boolean;
  /** 공 색상 */
  color?: string;
}

/**
 * 다른 플레이어의 골프공
 *
 * 멀티플레이어 모드에서 다른 플레이어의 공을 표시합니다.
 * - 이름 라벨이 위에 표시됨
 * - 색상으로 구분
 * - 비행 중일 때 약간의 애니메이션
 */
export function OtherPlayerBall({
  playerId,
  name,
  position,
  totalDistance,
  holeDistance,
  isFlying = false,
  color = '#88ccff',
}: OtherPlayerBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = BALL_RADIUS * 0.9; // 다른 플레이어 공은 약간 작게

  // 고도 계산 (progress 기반)
  const progress = holeDistance > 0 ? totalDistance / holeDistance : 0;
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);

  // 고도: 티(0) → 중간(6) → 그린(10)
  const elevation =
    clampedProgress < 0.5
      ? clampedProgress * 12
      : 6 + (clampedProgress - 0.5) * 8;

  // Z 좌표: 5 (티) → 380 (그린)
  const z = 5 + clampedProgress * 375;

  // 비행 중 애니메이션
  useFrame((_, delta) => {
    if (meshRef.current && isFlying) {
      // 비행 중일 때 약간의 회전
      meshRef.current.rotation.x += delta * 3;
      meshRef.current.rotation.z += delta * 2;
    }
  });

  return (
    <group position={[position.x * 0.4, elevation + radius, z]}>
      {/* 공 메쉬 */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.2}
          transparent
          opacity={isFlying ? 0.8 : 1}
        />
      </mesh>

      {/* 그림자 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -radius + 0.02, 0]}>
        <circleGeometry args={[radius * 1.1, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} />
      </mesh>

      {/* 발광 효과 (비행 중) */}
      {isFlying && (
        <mesh>
          <sphereGeometry args={[radius * 1.3, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
      )}

      {/* 이름 라벨 */}
      <Html
        position={[0, radius + 1.5, 0]}
        center
        distanceFactor={80}
        occlude={false}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{
            backgroundColor: `${color}cc`,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {name}
        </div>
      </Html>
    </group>
  );
}

/**
 * 플레이어별 색상 팔레트
 */
export const PLAYER_COLORS = [
  '#88ccff', // 하늘색
  '#ffaa88', // 살구색
  '#88ff88', // 연두색
  '#ff88cc', // 분홍색
  '#ffff88', // 노란색
  '#cc88ff', // 보라색
  '#88ffcc', // 민트색
  '#ff8888', // 빨간색
];

/**
 * 플레이어 인덱스로 색상 가져오기
 */
export function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
