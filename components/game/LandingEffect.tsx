'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LandingZone } from '@/lib/game/types';

interface LandingEffectProps {
  position: [number, number, number];
  zone: LandingZone;
  active: boolean;
  onComplete?: () => void;
}

const EFFECT_DURATION = 1.0;

/**
 * Visual effect shown when ball lands on different surfaces.
 * - Water: splash particles rising
 * - Bunker: sand dust cloud
 * - Green/Fairway: subtle grass particles
 */
export function LandingEffect({
  position,
  zone,
  active,
  onComplete,
}: LandingEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const particlesRef = useRef<THREE.Points>(null);

  // Reset on new activation
  useEffect(() => {
    if (active) {
      progressRef.current = 0;
      completedRef.current = false;
    }
  }, [active, position]);

  // Create particles based on zone
  const { geometry, material, count } = useMemo(() => {
    const particleCount = zone === 'water' ? 30 : (zone === 'bunker' || zone === 'beach') ? 20 : 10;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = Math.random() * 2;

      positions[i * 3] = Math.cos(angle) * radius * 0.3;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.3;

      // Upward velocity with spread
      velocities[i * 3] = (Math.random() - 0.5) * 3;
      velocities[i * 3 + 1] = 3 + Math.random() * 4;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    let color: THREE.Color;
    switch (zone) {
      case 'water':
        color = new THREE.Color('#4da6ff');
        break;
      case 'bunker':
        color = new THREE.Color('#d4c090');
        break;
      case 'beach':
        // 밝은 크림색 모래 파티클
        color = new THREE.Color('#f5e6c8');
        break;
      default:
        color = new THREE.Color('#5a8040');
    }

    const mat = new THREE.PointsMaterial({
      color,
      size: zone === 'water' ? 0.4 : 0.3,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat, count: particleCount };
  }, [zone]);

  useFrame((_, delta) => {
    if (!active || !particlesRef.current || completedRef.current) return;

    progressRef.current += delta / EFFECT_DURATION;

    if (progressRef.current >= 1) {
      completedRef.current = true;
      onComplete?.();
      return;
    }

    const positions = geometry.attributes.position.array as Float32Array;
    const velocities = geometry.attributes.velocity.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Apply velocity
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

      // Apply gravity
      velocities[i * 3 + 1] -= 9.81 * delta;
    }

    geometry.attributes.position.needsUpdate = true;

    // Fade out
    material.opacity = 0.8 * (1 - progressRef.current);
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={position}>
      <points ref={particlesRef} geometry={geometry} material={material} />
    </group>
  );
}
