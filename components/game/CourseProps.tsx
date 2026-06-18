'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

export function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.2, 8]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0]}>
        <coneGeometry args={[0.85, 1.6, 10]} />
        <meshStandardMaterial color="#2f7d35" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 2.4, 0]}>
        <coneGeometry args={[0.6, 1.2, 10]} />
        <meshStandardMaterial color="#357f38" roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Bunker({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <circleGeometry args={[scale, 28]} />
      <meshStandardMaterial color="#e9d39a" roughness={1} />
    </mesh>
  );
}

export function WaterHazard({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number];
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={args} />
      <meshStandardMaterial
        color="#2f7fb0"
        roughness={0.15}
        metalness={0.5}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

/** A pin: thin pole + red triangular flag + a dark hole cup beneath it. */
export function Flag({
  position,
  height = 3.2,
}: {
  position: [number, number, number];
  height?: number;
}) {
  return (
    <group position={position}>
      {/* hole cup */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.34, 20]} />
        <meshStandardMaterial color="#15321a" />
      </mesh>
      {/* pole */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, height, 8]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      {/* flag */}
      <mesh position={[0.5, height - 0.5, 0]} castShadow>
        <planeGeometry args={[1, 0.6]} />
        <meshStandardMaterial color="#e23b3b" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** A low-poly mountain ridge used as a distant backdrop. */
export function MountainRange({
  z,
  spread = 120,
  count = 9,
  baseColor = '#5d7a6a',
}: {
  z: number;
  spread?: number;
  count?: number;
  baseColor?: string;
}) {
  const peaks = useMemo(() => {
    const out: Array<{ x: number; h: number; r: number; c: string }> = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = (t - 0.5) * spread;
      // deterministic pseudo-random heights
      const h = 14 + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 12;
      const r = 16 + (i % 3) * 4;
      const shade = 0.85 + (i % 2) * 0.12;
      const col = new THREE.Color(baseColor).multiplyScalar(shade);
      out.push({ x, h: Math.abs(h), r, c: `#${col.getHexString()}` });
    }
    return out;
  }, [count, spread, baseColor]);

  return (
    <group position={[0, 0, z]}>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2 - 2, (i % 2) * -8]}>
          <coneGeometry args={[p.r, p.h, 5]} />
          <meshStandardMaterial color={p.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
