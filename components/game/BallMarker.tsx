'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface BallMarkerProps {
  /** Target world position. The mesh lerps smoothly toward it each frame. */
  position: [number, number, number];
  radius?: number;
  color?: string;
  label?: string;
  /** Hex/rgb color for the floating name label pin. */
  labelColor?: string;
  imageUrl?: string | null;
  /** When true, snaps instantly instead of animating (e.g. initial mount). */
  snap?: boolean;
  /** 라벨 클릭 핸들러 (관전 시 플레이어 선택용). */
  onClick?: () => void;
  /** 현재 작성 중인 프롬프트 (있으면 말풍선으로 표시). */
  prompt?: string;
  /** true면 공 구체/그림자를 숨기고 라벨만 표시 (비행 중 도착지 더블볼 방지). */
  hideBall?: boolean;
}

/** A golf ball sphere that smoothly animates to its target position, with an
 *  optional floating team-name label (used for dashboard markers). */
export function BallMarker({
  position,
  radius = 0.32,
  color = '#ffffff',
  label,
  labelColor = '#2f7fb0',
  imageUrl,
  snap = false,
  onClick,
  prompt,
  hideBall = false,
}: BallMarkerProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    const target = new THREE.Vector3(...position);
    if (snap) {
      group.current.position.copy(target);
    } else {
      group.current.position.lerp(target, Math.min(1, delta * 4));
    }
  });

  return (
    <group ref={group} position={position}>
      {/* 공 구체 + 그림자 (비행 중에는 숨겨 도착지 더블볼 방지) */}
      {!hideBall && (
        <>
          <mesh castShadow position={[0, radius, 0]}>
            <sphereGeometry args={[radius, 24, 24]} />
            <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
          </mesh>
          {/* soft contact shadow */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[radius * 1.4, 24]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.18} />
          </mesh>
        </>
      )}

      {label && (
        <Html position={[0, radius * 2 + 0.6, 0]} center distanceFactor={30} zIndexRange={[20, 0]}>
          <div className="flex flex-col items-center gap-1.5">
            {/* 작성 중 프롬프트 말풍선 */}
            {prompt && prompt.trim() && (
              <div className="max-w-[240px] truncate rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-gray-800 shadow-lg">
                ✍️ {prompt}
              </div>
            )}
            {/* 플레이어 라벨 (이름 + 아바타). onClick이 있으면(관전) 정보·클릭 영역을 크게 키운다. */}
            <button
              type="button"
              onClick={onClick}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-full font-bold text-white shadow-xl ${
                onClick
                  ? 'cursor-pointer px-7 py-4 text-2xl ring-2 ring-white/30 transition hover:scale-110 hover:ring-4 hover:ring-white/80'
                  : 'cursor-default px-3 py-1.5 text-sm'
              }`}
              style={{ background: labelColor }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className={`rounded-full object-cover ring-2 ring-white/60 ${onClick ? 'h-11 w-11' : 'h-5 w-5'}`}
                />
              ) : (
                <span className={onClick ? 'text-3xl' : 'text-sm'}>🧑</span>
              )}
              {label}
              {onClick && <span className="ml-1 text-lg opacity-80">👁</span>}
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}
