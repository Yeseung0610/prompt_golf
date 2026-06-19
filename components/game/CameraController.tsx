'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraControllerProps {
  /** 공의 현재 X 위치 */
  ballX: number;
  /** 공의 현재 Y 위치 (높이) */
  ballY: number;
  /** 공의 현재 Z 위치 */
  ballZ: number;
  /** 공이 날아가는 중인지 */
  flying?: boolean;
  /** 기본 카메라 높이 오프셋 */
  heightOffset?: number;
  /** 카메라가 공 뒤로 떨어진 거리 */
  distance?: number;
  /** 카메라 이동 속도 (lerp factor) */
  smoothness?: number;
}

/**
 * 공을 따라가는 카메라 컨트롤러
 * - 공 뒤쪽 위에서 홀 방향을 바라봄
 * - 부드럽게 따라가는 lerp 애니메이션
 */
export function CameraController({
  ballX,
  ballY,
  ballZ,
  flying = false,
  heightOffset = 10,
  distance = 35,
  smoothness = 3.0,
}: CameraControllerProps) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    // 카메라 높이: 공의 Y 위치에 오프셋 추가
    // 공이 하늘에 있으면 카메라도 따라 올라감
    const cameraHeight = Math.max(ballY + heightOffset, 8);

    // 목표 카메라 위치: 공 뒤쪽 위 (티 방향 = z가 작은 쪽)
    targetPosition.current.set(
      ballX * 0.4, // 공의 측면 이동을 약하게 따라감
      cameraHeight,
      ballZ - distance, // 공 뒤쪽 (티 방향)
    );

    // 카메라가 바라볼 지점: 공 자체를 바라봄
    targetLookAt.current.set(
      ballX,
      ballY,
      ballZ,
    );

    // 비행 중일 때는 더 빠르게 따라감 (공을 놓치지 않도록)
    const lerpFactor = flying ? smoothness * 2.0 : smoothness;
    const t = Math.min(1, delta * lerpFactor);

    // 카메라 위치 부드럽게 이동
    camera.position.lerp(targetPosition.current, t);

    // 카메라가 공을 바라보도록
    camera.lookAt(targetLookAt.current);
  });

  return null;
}
