'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface WaterPondProps {
  position: [number, number, number];
  size: [number, number];
  /** Hazard ID for collision detection */
  hazardId?: string;
}

/**
 * Reflective water pond with subtle wave animation.
 *
 * Features:
 * - Real-time reflections using MeshReflectorMaterial
 * - Animated distortion for water ripples
 * - Semi-transparent blue appearance
 */
export function WaterPond({ position, size, hazardId }: WaterPondProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Animate water ripples
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle vertical oscillation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group>
      {/* Main water surface */}
      <mesh
        ref={meshRef}
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name={hazardId}
      >
        <planeGeometry args={size} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={512}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#1a5a80"
          metalness={0.5}
          mirror={0.5}
        />
      </mesh>

      {/* Transparent overlay for depth effect */}
      <mesh
        position={[position[0], position[1] + 0.01, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={size} />
        <meshStandardMaterial
          color="#2080b0"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Edge highlight */}
      <mesh
        position={[position[0], position[1] - 0.5, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size[0] + 4, size[1] + 4]} />
        <meshStandardMaterial
          color="#1a4060"
          roughness={1}
        />
      </mesh>
    </group>
  );
}
