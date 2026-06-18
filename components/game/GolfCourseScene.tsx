'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';
import { Tree, Bunker, WaterHazard, Flag, MountainRange } from './CourseProps';
import { BallMarker } from './BallMarker';

/** World length (units) of the visible hole, tee (z=0) to flag (z=-LEN). */
const LEN = 82;

interface GolfCourseSceneProps {
  /** 0 = on the tee, 1 = at the flag. */
  progress: number;
  /** Lateral ball offset in course meters (scaled down for world space). */
  lateralX: number;
  /** Bumps to re-key the ball animation when a new shot lands. */
  shotTick?: number;
}

function CourseGeometry() {
  const treePositions = useMemo(() => {
    const arr: Array<[number, number, number]> = [];
    for (let i = 0; i < 9; i++) {
      const z = -8 - i * 8;
      const jitter = (Math.sin(i * 7.1) * 0.5 + 0.5) * 2;
      arr.push([-11 - jitter, 0, z]);
      arr.push([11 + jitter, 0, z]);
    }
    return arr;
  }, []);

  return (
    <group>
      {/* Rough (full ground) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -LEN / 2]} receiveShadow>
        <planeGeometry args={[140, LEN + 60]} />
        <meshStandardMaterial color="#2f6d33" roughness={1} />
      </mesh>

      {/* Fairway strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -LEN / 2]} receiveShadow>
        <planeGeometry args={[16, LEN + 8]} />
        <meshStandardMaterial color="#54a64f" roughness={0.95} />
      </mesh>

      {/* Putting green near the flag */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -LEN + 4]} receiveShadow>
        <circleGeometry args={[10, 40]} />
        <meshStandardMaterial color="#6fcf63" roughness={0.85} />
      </mesh>

      {/* Tee box */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 1]} receiveShadow>
        <planeGeometry args={[5, 4]} />
        <meshStandardMaterial color="#4f9c4a" roughness={0.9} />
      </mesh>
      {/* Tee peg + ball sit on the tee for the player's view */}
      <mesh position={[0, 0.25, 1]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
        <meshStandardMaterial color="#caa46a" />
      </mesh>

      {/* Water hazard (left) */}
      <WaterHazard position={[-22, 0.0, -28]} args={[26, 34]} />

      {/* Bunkers guarding the green */}
      <Bunker position={[-7, 0.02, -LEN + 8]} scale={3} />
      <Bunker position={[8, 0.02, -LEN + 6]} scale={3.4} />
      <Bunker position={[5, 0.02, -22]} scale={2.4} />

      {/* Tree lines */}
      {treePositions.map((p, i) => (
        <Tree key={i} position={p} scale={1 + (i % 3) * 0.25} />
      ))}

      {/* Distant mountains */}
      <MountainRange z={-LEN - 30} spread={180} count={11} baseColor="#5f7d68" />
      <MountainRange z={-LEN - 18} spread={150} count={9} baseColor="#6b8a72" />

      {/* Flag at the hole */}
      <Flag position={[0, 0, -LEN + 4]} height={3.4} />
    </group>
  );
}

export function GolfCourseScene({ progress, lateralX, shotTick }: GolfCourseSceneProps) {
  const ballZ = -THREE.MathUtils.clamp(progress, 0, 1) * (LEN - 4);
  // scale lateral meters into a sane world range
  const ballX = THREE.MathUtils.clamp(lateralX * 0.12, -7, 7);
  const ballRest = progress < 0.001;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 3.2, 9], fov: 55, near: 0.1, far: 600 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Sky sunPosition={[40, 30, -80]} turbidity={6} rayleigh={1.2} mieCoefficient={0.005} />
        <Clouds material={THREE.MeshBasicMaterial} position={[0, 28, -60]}>
          <Cloud seed={1} bounds={[60, 6, 20]} volume={10} color="#ffffff" opacity={0.7} />
          <Cloud seed={4} bounds={[50, 5, 18]} volume={8} color="#eef4ff" opacity={0.6} />
        </Clouds>

        <hemisphereLight args={['#cfe8ff', '#3a5a32', 0.7]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[30, 40, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={160}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />

        <CourseGeometry />

        {/* The ball: rests on the tee, then flies down the fairway on a shot. */}
        <BallMarker
          key={`ball-${shotTick ?? 0}`}
          position={[ballRest ? 0 : ballX, 0.25, ballRest ? 1 : ballZ]}
          radius={0.34}
          snap={ballRest}
        />

        <fog attach="fog" args={['#bfdcf0', 90, 220]} />
      </Suspense>
    </Canvas>
  );
}
