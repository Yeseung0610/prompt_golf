'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BallSimulator } from '@/lib/physics/BallSimulator';
import { HOLE_1_LAYOUT } from '@/lib/game/courseLayout';
import { BALL_RADIUS } from '@/lib/physics/config';

interface LightweightBallProps {
  /** 출발 위치 [x, y, z] */
  startPosition: [number, number, number];
  /** 목표 위치 [x, y, z] - 발사 방향/거리 계산에 사용 */
  targetPosition: [number, number, number];
  /** true면 물리 시뮬레이션 시작 (발사) */
  launch: boolean;
  /** 공이 완전히 멈췄을 때 호출 (최종 위치 전달) */
  onRest?: (position: THREE.Vector3) => void;
  /** 매 프레임 공 위치 업데이트 (카메라 추적용) */
  onPositionUpdate?: (position: THREE.Vector3) => void;
  /** 공 반지름 */
  radius?: number;
}

/**
 * 경량 물리 기반 골프공
 *
 * Rapier WASM 대신 순수 JS BallSimulator를 사용하여:
 * - 포물선 비행 (공기 저항 포함)
 * - 착지 + 튕김
 * - 굴러감 (지형 경사, 마찰 적용)
 * - 정지 감지
 *
 * 성능: ~500KB WASM 로드 없음, 14,400+ 삼각형 충돌 검사 없음
 */
export function LightweightBall({
  startPosition,
  targetPosition,
  launch,
  onRest,
  onPositionUpdate,
  radius = BALL_RADIUS,
}: LightweightBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasLaunched = useRef(false);
  const hasRested = useRef(false);

  // 시뮬레이터 인스턴스 (메모이제이션)
  const simulator = useMemo(() => new BallSimulator(HOLE_1_LAYOUT), []);

  // 발사 처리
  useEffect(() => {
    if (launch && !hasLaunched.current) {
      hasLaunched.current = true;
      hasRested.current = false;

      simulator.launch(
        { x: startPosition[0], y: startPosition[1], z: startPosition[2] },
        { x: targetPosition[0], y: targetPosition[1], z: targetPosition[2] }
      );
    }
  }, [launch, startPosition, targetPosition, simulator]);

  // launch가 false로 리셋되면 상태 초기화
  useEffect(() => {
    if (!launch) {
      hasLaunched.current = false;
      hasRested.current = false;
      simulator.reset();
    }
  }, [launch, simulator]);

  // 매 프레임 시뮬레이션 업데이트
  useFrame((_, delta) => {
    if (!launch || hasRested.current) return;

    const state = simulator.update(delta);

    // 메쉬 위치 업데이트
    if (meshRef.current) {
      meshRef.current.position.set(
        state.position.x,
        state.position.y + radius, // 공 중심이 지면 위에 오도록
        state.position.z
      );

      // 굴러가는 동안 회전 (시각적 효과)
      if (state.phase === 'rolling') {
        const speed = Math.sqrt(
          state.velocity.x * state.velocity.x +
          state.velocity.z * state.velocity.z
        );
        if (speed > 0.01) {
          // 이동 방향에 수직인 축으로 회전
          const rotationSpeed = speed / radius;
          meshRef.current.rotation.x += rotationSpeed * delta * (state.velocity.z > 0 ? 1 : -1);
          meshRef.current.rotation.z += rotationSpeed * delta * (state.velocity.x > 0 ? -1 : 1);
        }
      }
    }

    // 카메라 추적용 위치 콜백
    onPositionUpdate?.(
      new THREE.Vector3(state.position.x, state.position.y + radius, state.position.z)
    );

    // 정지 판정
    if (state.isResting && !hasRested.current) {
      hasRested.current = true;
      onRest?.(
        new THREE.Vector3(state.position.x, state.position.y, state.position.z)
      );
    }
  });

  return (
    <group position={[startPosition[0], startPosition[1] + radius, startPosition[2]]}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* 부드러운 그림자 (공 아래) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -radius + 0.02, 0]}
      >
        <circleGeometry args={[radius * 1.2, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>

      {/* 미세한 발광 효과 */}
      <mesh>
        <sphereGeometry args={[radius * 1.15, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

/**
 * 정적 공 마커 (물리 없음, 위치 고정)
 * 공이 멈춘 후 또는 발사 전에 사용
 */
export function StaticBall({
  position,
  radius = BALL_RADIUS,
}: {
  position: [number, number, number];
  radius?: number;
}) {
  return (
    <group position={[position[0], position[1] + radius, position[2]]}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -radius + 0.02, 0]}>
        <circleGeometry args={[radius * 1.2, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}
