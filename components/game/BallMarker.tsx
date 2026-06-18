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
      <mesh castShadow position={[0, radius, 0]}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* soft contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[radius * 1.4, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>

      {label && (
        <Html position={[0, radius * 2 + 0.6, 0]} center distanceFactor={18} zIndexRange={[20, 0]}>
          <div
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
            style={{ background: labelColor }}
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover ring-1 ring-white/60"
              />
            )}
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
