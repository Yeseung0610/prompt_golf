'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 게임/관전 공통 비행 공. start → end 를 포물선으로 한 번 날아간 뒤 onDone 호출.
 * 핵심: **비행 높이(peak)는 수평 이동 거리에 비례**한다 (동일 기준).
 *
 * 좌표는 각 씬의 월드 좌표(지면 기준). 공 중심은 지면 + radius + 포물선 높이.
 */

const HEIGHT_RATIO = 0.45; // 최고 높이 = 수평 이동거리 × 비율

export function arcPeak(horizontalDist: number): number {
  return THREE.MathUtils.clamp(horizontalDist * HEIGHT_RATIO, 8, 120);
}

export function arcDuration(horizontalDist: number): number {
  return THREE.MathUtils.clamp(0.8 + horizontalDist / 150, 0.8, 3);
}

interface ArcBallProps {
  /** 지면 기준 시작 좌표 [x,y,z]. */
  start: [number, number, number];
  /** 지면 기준 도착 좌표 [x,y,z]. */
  end: [number, number, number];
  radius?: number;
  onDone?: () => void;
  /** 매 프레임 현재 위치 보고 (카메라 추적용). */
  onProgress?: (pos: THREE.Vector3) => void;
}

export function ArcBall({ start, end, radius = 1.2, onDone, onProgress }: ArcBallProps) {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const done = useRef(false);

  const s = new THREE.Vector3(start[0], start[1], start[2]);
  const e = new THREE.Vector3(end[0], end[1], end[2]);
  const horiz = Math.hypot(e.x - s.x, e.z - s.z);
  const peak = arcPeak(horiz);
  const dur = arcDuration(horiz);

  useFrame((_, delta) => {
    if (!group.current || done.current) return;
    t.current += Math.min(delta, 0.05);
    const k = Math.min(t.current / dur, 1);
    const x = THREE.MathUtils.lerp(s.x, e.x, k);
    const z = THREE.MathUtils.lerp(s.z, e.z, k);
    const baseY = THREE.MathUtils.lerp(s.y, e.y, k);
    const arc = Math.sin(Math.PI * k) * peak;
    group.current.position.set(x, baseY + radius + arc, z);
    onProgress?.(group.current.position);

    if (shadow.current) {
      shadow.current.position.set(x, 0.06, z);
      const sc = THREE.MathUtils.clamp(1 - arc / peak, 0.35, 1);
      shadow.current.scale.setScalar(sc);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.06 + sc * 0.16;
    }

    if (k >= 1) {
      done.current = true;
      onDone?.();
    }
  });

  return (
    <>
      <group ref={group}>
        <mesh castShadow>
          <sphereGeometry args={[radius, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.05} />
        </mesh>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 1.5, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </>
  );
}
