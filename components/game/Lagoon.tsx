'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface LagoonProps {
  position: [number, number, number];
  size: [number, number];
  hazardId?: string;
}

/**
 * 라군/워터 해저드 - 맑은 청록색 연못
 * 반사 효과 + 잔잔한 물결
 */
export function Lagoon({ position, size, hazardId }: LagoonProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const avgRadius = (size[0] + size[1]) / 4;

  // 잔잔한 물결 애니메이션
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
    }
  });

  return (
    <group>
      {/* 라군 바닥 (어두운 색) */}
      <mesh
        position={[position[0], position[1] - 1.5, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size[0] / 50, size[1] / 50, 1]}
      >
        <circleGeometry args={[25, 32]} />
        <meshStandardMaterial color="#1a4050" roughness={1} />
      </mesh>

      {/* 메인 물 표면 */}
      <mesh
        ref={meshRef}
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size[0] / 50, size[1] / 50, 1]}
        receiveShadow
        name={hazardId}
      >
        <circleGeometry args={[25, 48]} />
        <MeshReflectorMaterial
          blur={[200, 80]}
          resolution={256}
          mixBlur={0.8}
          mixStrength={30}
          roughness={0.3}
          depthScale={1}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
          color="#25a0b5"
          metalness={0.4}
          mirror={0.4}
        />
      </mesh>

      {/* 투명 오버레이 (깊이감) */}
      <mesh
        position={[position[0], position[1] + 0.02, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size[0] / 55, size[1] / 55, 1]}
      >
        <circleGeometry args={[25, 32]} />
        <meshStandardMaterial
          color="#40c5d5"
          transparent
          opacity={0.25}
          roughness={0.1}
          metalness={0.6}
        />
      </mesh>

      {/* 테두리 (바위 느낌) */}
      <mesh
        position={[position[0], position[1] - 0.1, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size[0] / 50, size[1] / 50, 1]}
      >
        <ringGeometry args={[25, 27, 32]} />
        <meshStandardMaterial color="#5a6055" roughness={0.95} />
      </mesh>
    </group>
  );
}
