'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FlyingBallProps {
  /** 출발 위치 */
  from: [number, number, number];
  /** 도착 위치 */
  to: [number, number, number];
  /** 비행 중인지 여부 */
  flying: boolean;
  /** 비행 완료 콜백 */
  onComplete?: () => void;
  radius?: number;
}

const TRAIL_LENGTH = 20;
const FLIGHT_DURATION = 2.0; // 초

/** 잔상이 있는 날아가는 골프공 */
export function FlyingBall({
  from,
  to,
  flying,
  onComplete,
  radius = 1.0,
}: FlyingBallProps) {
  const ballRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const trailPositions = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const trailOpacities = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const lastPosition = useRef<THREE.Vector3>(new THREE.Vector3());

  // 포물선 경로 계산
  const getPositionOnArc = (t: number): THREE.Vector3 => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);

    // 선형 보간
    const pos = start.clone().lerp(end, t);

    // 포물선 높이 추가 (최대 높이는 거리의 1/4)
    const distance = start.distanceTo(end);
    const maxHeight = Math.min(distance * 0.25, 80);
    const height = Math.sin(t * Math.PI) * maxHeight;
    pos.y += height + radius;

    return pos;
  };

  // 잔상 지오메트리
  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH), 1));
    return geo;
  }, []);

  // 잔상 머티리얼
  const trailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = ${(radius * 15).toFixed(1)} * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.6);
        }
      `,
    });
  }, [radius]);

  useFrame((_, delta) => {
    if (!flying || !ballRef.current) {
      progressRef.current = 0;
      completedRef.current = false;
      return;
    }

    // 진행도 업데이트
    progressRef.current += delta / FLIGHT_DURATION;

    if (progressRef.current >= 1) {
      progressRef.current = 1;
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }

    // easeOutQuad for smooth landing
    const eased = 1 - Math.pow(1 - progressRef.current, 2);
    const currentPos = getPositionOnArc(eased);
    lastPosition.current.copy(currentPos);
    ballRef.current.position.copy(currentPos);

    // 잔상 업데이트
    if (trailRef.current) {
      const positions = trailPositions.current;
      const opacities = trailOpacities.current;

      // 기존 위치들을 한 칸씩 뒤로 이동
      for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
        opacities[i] = opacities[i - 1] * 0.85;
      }

      // 현재 위치 저장
      positions[0] = currentPos.x;
      positions[1] = currentPos.y;
      positions[2] = currentPos.z;
      opacities[0] = 1;

      (trailGeometry.attributes.position as THREE.BufferAttribute).set(positions);
      (trailGeometry.attributes.opacity as THREE.BufferAttribute).set(opacities);
      trailGeometry.attributes.position.needsUpdate = true;
      trailGeometry.attributes.opacity.needsUpdate = true;
    }
  });

  if (!flying) return null;

  return (
    <group>
      {/* 공 */}
      <group ref={ballRef} position={from}>
        <mesh castShadow>
          <sphereGeometry args={[radius, 24, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* 공 주변 글로우 */}
        <mesh>
          <sphereGeometry args={[radius * 1.3, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
        </mesh>
      </group>

      {/* 잔상 */}
      <points ref={trailRef} geometry={trailGeometry} material={trailMaterial} />
    </group>
  );
}
