'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// Rapier는 경량 물리 시뮬레이터 사용으로 제거됨
// physics 플래그는 하위 호환성을 위해 유지하지만, 항상 시각적 렌더링만 수행

/** Tree variants for visual variety */
type TreeVariant = 'pine' | 'oak' | 'cypress' | 'palm';

interface TreeProps {
  position: [number, number, number];
  scale?: number;
  variant?: TreeVariant;
  /** Enable physics collision */
  physics?: boolean;
}

/**
 * Tree with optional physics collider for ball deflection.
 * Four variants: pine, oak, cypress, palm (tropical)
 */
export function Tree({
  position,
  scale = 1,
  variant = 'palm',
  physics = false,
}: TreeProps) {
  const treeData = useMemo(() => {
    const seed = position[0] * 13 + position[2] * 7;
    const hue = 0.28 + (Math.sin(seed) * 0.03);
    const saturation = 0.6 + (Math.cos(seed) * 0.1);

    // 야자수 잎 회전값 미리 계산
    const palmLeafRotations = [0, 60, 120, 180, 240, 300].map((angle, i) => ({
      angle,
      rotZ: -0.6 - seededRandom(seed + i * 5.7) * 0.2,
    }));

    return { hue, saturation, palmLeafRotations };
  }, [position]);

  const trunkColor = variant === 'palm' ? '#8b6b4a' : variant === 'oak' ? '#5d3a1a' : '#6b4a2b';
  const foliageColor1 = new THREE.Color().setHSL(treeData.hue, treeData.saturation, 0.3);
  const foliageColor2 = new THREE.Color().setHSL(treeData.hue, treeData.saturation + 0.05, 0.35);

  const treeContent = (
    <group scale={scale}>
      {variant === 'palm' ? (
        // 야자수
        <>
          {/* 굽은 줄기 */}
          <mesh castShadow position={[0, 1.5, 0]} rotation={[0.1, 0, 0.15]}>
            <cylinderGeometry args={[0.08, 0.15, 3, 8]} />
            <meshStandardMaterial color={trunkColor} roughness={0.95} />
          </mesh>
          {/* 야자수 잎들 */}
          {treeData.palmLeafRotations.map((leaf, i) => (
            <group key={i} position={[0, 3, 0]} rotation={[0, (leaf.angle * Math.PI) / 180, 0]}>
              <mesh castShadow position={[0.8, 0, 0]} rotation={[0, 0, leaf.rotZ]}>
                <boxGeometry args={[1.8, 0.05, 0.4]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? '#2d8a3e' : '#1f7530'}
                  roughness={0.85}
                />
              </mesh>
            </group>
          ))}
          {/* 코코넛 */}
          <mesh castShadow position={[0.1, 2.8, 0.1]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#5d4a2a" roughness={0.9} />
          </mesh>
        </>
      ) : (
        // 기존 나무 (pine, oak, cypress)
        <>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[
              variant === 'oak' ? 0.18 : 0.12,
              variant === 'oak' ? 0.25 : 0.18,
              variant === 'cypress' ? 1.8 : 1.2,
              8
            ]} />
            <meshStandardMaterial color={trunkColor} roughness={0.9} />
          </mesh>

          {variant === 'pine' && (
            <>
              <mesh castShadow position={[0, 1.7, 0]}>
                <coneGeometry args={[0.85, 1.6, 10]} />
                <meshStandardMaterial color={`#${foliageColor1.getHexString()}`} roughness={0.85} />
              </mesh>
              <mesh castShadow position={[0, 2.4, 0]}>
                <coneGeometry args={[0.6, 1.2, 10]} />
                <meshStandardMaterial color={`#${foliageColor2.getHexString()}`} roughness={0.85} />
              </mesh>
            </>
          )}

          {variant === 'oak' && (
            <mesh castShadow position={[0, 2.2, 0]}>
              <sphereGeometry args={[1.2, 12, 12]} />
              <meshStandardMaterial color={`#${foliageColor1.getHexString()}`} roughness={0.9} />
            </mesh>
          )}

          {variant === 'cypress' && (
            <>
              <mesh castShadow position={[0, 2.0, 0]}>
                <coneGeometry args={[0.5, 2.5, 8]} />
                <meshStandardMaterial color={`#${foliageColor1.getHexString()}`} roughness={0.85} />
              </mesh>
              <mesh castShadow position={[0, 3.2, 0]}>
                <coneGeometry args={[0.35, 1.8, 8]} />
                <meshStandardMaterial color={`#${foliageColor2.getHexString()}`} roughness={0.85} />
              </mesh>
            </>
          )}
        </>
      )}
    </group>
  );

  // 경량 물리에서는 physics 플래그 무시 - 항상 시각적 렌더링만
  return <group position={position}>{treeContent}</group>;
}

/**
 * 시드 기반 의사 난수 생성 (렌더링 간 일관성 유지)
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Palm Tree - 열대 야자수
 * 주의: Math.random() 대신 seededRandom() 사용하여 렌더링 간 일관성 유지
 */
export function PalmTree({
  position,
  scale = 1,
  physics = false,
}: {
  position: [number, number, number];
  scale?: number;
  physics?: boolean;
}) {
  // 위치 기반 시드로 모든 랜덤 값 계산 (렌더링 간 일관성)
  const palmData = useMemo(() => {
    const baseSeed = position[0] * 17 + position[2] * 11;

    const trunkCurve = {
      bendX: Math.sin(baseSeed) * 0.2,
      bendZ: Math.cos(baseSeed * 1.3) * 0.15,
      height: 2.5 + Math.sin(baseSeed * 0.7) * 0.5,
    };

    // 각 잎에 대한 랜덤 값 미리 계산
    const leafData = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
      const leafSeed = baseSeed + i * 7.3;
      return {
        angle,
        posX: 0.6 + seededRandom(leafSeed) * 0.2,
        rotZ: -0.5 - seededRandom(leafSeed + 1) * 0.3,
        width: 1.2 + seededRandom(leafSeed + 2) * 0.4,
      };
    });

    // 코코넛 표시 여부
    const hasCoconut = seededRandom(baseSeed + 100) > 0.5;

    return { trunkCurve, leafData, hasCoconut };
  }, [position]);

  const leafColors = ['#2d9a4a', '#1f8535', '#3aab55', '#2a8040'];
  const { trunkCurve, leafData, hasCoconut } = palmData;

  return (
    <group position={position}>
      <group scale={scale}>
        {/* 줄기 */}
        <mesh castShadow position={[trunkCurve.bendX * 0.5, trunkCurve.height / 2, trunkCurve.bendZ * 0.5]}
              rotation={[trunkCurve.bendZ * 0.3, 0, trunkCurve.bendX * 0.3]}>
          <cylinderGeometry args={[0.06, 0.12, trunkCurve.height, 8]} />
          <meshStandardMaterial color="#9a7a5a" roughness={0.95} />
        </mesh>

        {/* 야자수 잎들 */}
        <group position={[trunkCurve.bendX, trunkCurve.height, trunkCurve.bendZ]}>
          {leafData.map((leaf, i) => (
            <group key={i} rotation={[0, (leaf.angle * Math.PI) / 180, 0]}>
              <mesh
                castShadow
                position={[leaf.posX, -0.1 * i * 0.1, 0]}
                rotation={[0.2, 0, leaf.rotZ]}
              >
                <boxGeometry args={[leaf.width, 0.03, 0.25]} />
                <meshStandardMaterial
                  color={leafColors[i % leafColors.length]}
                  roughness={0.85}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ))}
          {/* 코코넛 */}
          {hasCoconut && (
            <mesh castShadow position={[0.08, -0.2, 0.05]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#6a5030" roughness={0.95} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

/**
 * Rock - 해변/해안가 바위
 */
export function Rock({
  position,
  scale = 1,
  variant = 'medium',
}: {
  position: [number, number, number];
  scale?: number;
  variant?: 'small' | 'medium' | 'large';
}) {
  const rockShape = useMemo(() => {
    const seed = position[0] * 23 + position[2] * 19;
    return {
      scaleX: 0.8 + Math.sin(seed) * 0.3,
      scaleY: 0.6 + Math.cos(seed * 1.2) * 0.2,
      scaleZ: 0.9 + Math.sin(seed * 0.8) * 0.2,
      rotation: Math.sin(seed * 0.5) * 0.3,
    };
  }, [position]);

  const baseSize = variant === 'large' ? 3 : variant === 'medium' ? 1.8 : 1;

  return (
    <group position={position} rotation={[0, rockShape.rotation, 0]} scale={scale}>
      {/* 메인 바위 */}
      <mesh castShadow receiveShadow>
        <dodecahedronGeometry args={[baseSize * rockShape.scaleX]} />
        <meshStandardMaterial
          color="#6a6560"
          roughness={0.95}
          flatShading
        />
      </mesh>
      {/* 추가 돌 */}
      {variant !== 'small' && (
        <mesh castShadow position={[baseSize * 0.6, -baseSize * 0.3, baseSize * 0.3]}>
          <dodecahedronGeometry args={[baseSize * 0.5 * rockShape.scaleY]} />
          <meshStandardMaterial color="#7a7570" roughness={0.95} flatShading />
        </mesh>
      )}
    </group>
  );
}

interface BunkerProps {
  position: [number, number, number];
  scale?: number;
  depth?: number;
  physics?: boolean;
}

/**
 * Sand bunker with concave shape - 열대 해변 스타일 백사장 벙커
 */
export function Bunker({
  position,
  scale = 1,
  depth = 0.3,
  physics = true,
}: BunkerProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(scale, 32);
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const normalizedDist = dist / scale;
      const depthOffset = depth * (1 - normalizedDist * normalizedDist);
      positions.setZ(i, -depthOffset);
    }

    geo.computeVertexNormals();
    return geo;
  }, [scale, depth]);

  const bunkerContent = (
    <>
      {/* 벙커 테두리 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[scale * 0.9, scale * 1.1, 32]} />
        <meshStandardMaterial color="#e8d8b8" roughness={1} />
      </mesh>

      {/* 백사장 표면 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -depth * 0.5, 0]} receiveShadow>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color="#f5ead0"  // 밝은 백사장 색상
          roughness={1}
          flatShading
        />
      </mesh>

      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -depth - 0.1, 0]}>
        <circleGeometry args={[scale * 0.95, 28]} />
        <meshStandardMaterial color="#e0d0b0" roughness={1} />
      </mesh>
    </>
  );

  // 경량 물리에서는 physics 플래그 무시 - 항상 시각적 렌더링만
  return <group position={position}>{bunkerContent}</group>;
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
        color="#30a0c0"  // 열대 청록색
        roughness={0.1}
        metalness={0.6}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

/** 깃발 */
export function Flag({
  position,
  height = 8,
}: {
  position: [number, number, number];
  height?: number;
}) {
  return (
    <group position={position}>
      {/* 홀 컵 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.0, 24]} />
        <meshStandardMaterial color="#1a3a20" />
      </mesh>
      {/* 폴 */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, height, 8]} />
        <meshStandardMaterial color="#f8f8f8" />
      </mesh>
      {/* 깃발 */}
      <mesh position={[1.2, height - 1, 0]} castShadow>
        <planeGeometry args={[2.4, 1.5]} />
        <meshStandardMaterial color="#ff4444" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** 열대 산/언덕 (배경용) */
export function TropicalHill({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh position={position} castShadow>
      <coneGeometry args={[30 * scale, 40 * scale, 6]} />
      <meshStandardMaterial color="#3a6a45" roughness={1} flatShading />
    </mesh>
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
      const h = 60 + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 50;
      const r = 60 + (i % 3) * 15;
      const shade = 0.85 + (i % 2) * 0.12;
      const col = new THREE.Color(baseColor).multiplyScalar(shade);
      out.push({ x, h: Math.abs(h), r, c: `#${col.getHexString()}` });
    }
    return out;
  }, [count, spread, baseColor]);

  return (
    <group position={[0, 0, z]}>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2 - 8, (i % 2) * -25]}>
          <coneGeometry args={[p.r, p.h, 5]} />
          <meshStandardMaterial color={p.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
