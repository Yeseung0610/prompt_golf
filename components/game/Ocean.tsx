'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanProps {
  position: [number, number, number];
  size: [number, number];
}

/**
 * 열대 바다 - 청록색 그라데이션 + 파도 애니메이션
 */
export function Ocean({ position, size }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const foamRef = useRef<THREE.Mesh>(null);

  // 파도 애니메이션
  useFrame((state) => {
    if (meshRef.current) {
      // 부드러운 물결
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
    }
    if (foamRef.current) {
      // 파도 거품 움직임
      foamRef.current.position.x = position[0] + 5 + Math.sin(state.clock.elapsedTime * 0.6) * 3;
    }
  });

  // 바다 색상 그라데이션을 위한 geometry
  const oceanGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size[0], size[1], 32, 32);
    const colors: number[] = [];
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const normalizedX = (x + size[0] / 2) / size[0];

      // 얕은 곳(오른쪽, 해안 가까이): 청록색
      // 깊은 곳(왼쪽): 진한 파랑
      const shallowColor = new THREE.Color('#40d0d0');
      const deepColor = new THREE.Color('#0055a0');
      const color = shallowColor.lerp(deepColor, 1 - normalizedX);

      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [size]);

  return (
    <group>
      {/* 메인 바다 표면 */}
      <mesh
        ref={meshRef}
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={oceanGeometry}
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.4}
        />
      </mesh>

      {/* 파도 거품 (해안선) */}
      <mesh
        ref={foamRef}
        position={[position[0] + size[0] / 2 - 5, position[1] + 0.05, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[8, size[1] * 0.95]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* 바다 깊은 곳 (배경) - 지평선까지 */}
      <mesh
        position={[position[0] - 100, position[1] - 2, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size[0] + 300, size[1] + 400]} />
        <meshStandardMaterial color="#003366" roughness={1} />
      </mesh>
    </group>
  );
}
