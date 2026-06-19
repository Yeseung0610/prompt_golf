'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';
import { LightweightBall, StaticBall } from './LightweightBall';
import { CameraController } from './CameraController';
import { LandingEffect } from './LandingEffect';
import { SharedCourse, COURSE_LENGTH } from './SharedCourse';
import { HOLE_1_LAYOUT, getLandingZone } from '@/lib/game/courseLayout';
import type { LandingZone } from '@/lib/game/types';

interface GolfCourseSceneProps {
  /** 0 = on the tee, 1 = at the flag. */
  progress: number;
  /** Lateral ball offset in course meters. */
  lateralX: number;
  /** Bumps to re-key the ball animation when a new shot lands. */
  shotTick?: number;
  /** 공이 날아가는 중인지 여부 */
  flying?: boolean;
  /** 이전 위치 (flying 시작점) */
  prevProgress?: number;
  prevLateralX?: number;
  /** 비행 완료 콜백 (최종 위치 전달) */
  onFlightComplete?: (finalPosition?: THREE.Vector3) => void;
  /** 해저드 진입 콜백 */
  onHazardEnter?: (hazardId: string) => void;
}

/**
 * 공 위치 계산 (progress/lateralX → 3D 좌표)
 * 열대 해변 코스: 티(z=5) → 그린(z=380), S-커브 경로
 */
function calculateBallPosition(
  progress: number,
  lateralX: number
): [number, number, number] {
  // progress: 0 = 티, 1 = 그린
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);

  // Z 좌표: 5 (티) → 380 (그린)
  const z = 5 + clampedProgress * 375;

  // S-커브 페어웨이 중심선 따라가기
  // 간단한 S-커브: sin 함수로 좌우 이동
  const sCurveOffset = Math.sin(clampedProgress * Math.PI) * -15;

  // X 좌표: S-커브 + 측면 오프셋
  const baseX = sCurveOffset + THREE.MathUtils.clamp(lateralX * 0.4, -30, 30);

  const isAtTee = progress < 0.005;

  // 고도: 티(0) → 중간(6) → 그린(10)
  const elevation = clampedProgress < 0.5
    ? clampedProgress * 12  // 0 → 6
    : 6 + (clampedProgress - 0.5) * 8;  // 6 → 10

  return [
    isAtTee ? 0 : baseX,
    isAtTee ? 0.8 : elevation + 0.8,
    isAtTee ? 5 : z,
  ];
}

function SceneContent({
  progress,
  lateralX,
  shotTick,
  flying,
  prevProgress,
  prevLateralX,
  onFlightComplete,
  onHazardEnter,
}: GolfCourseSceneProps) {
  // 착지 이펙트 상태
  const [landingEffect, setLandingEffect] = useState<{
    active: boolean;
    position: [number, number, number];
    zone: LandingZone;
  }>({
    active: false,
    position: [0, 0, 0],
    zone: 'fairway',
  });

  // 현재 공 목표 위치 (gameStore 기반)
  const targetBallPosition = calculateBallPosition(progress, lateralX);

  // 이전 공 위치 (비행 시작점)
  const startBallPosition = calculateBallPosition(prevProgress ?? 0, prevLateralX ?? 0);

  // 카메라가 따라갈 실제 공 위치 (물리 시뮬레이션 중에는 실시간 추적)
  const [cameraFollowPosition, setCameraFollowPosition] = useState<[number, number, number]>(targetBallPosition);

  // 공이 완전히 멈춘 후 표시할 위치
  const [restPosition, setRestPosition] = useState<[number, number, number] | null>(null);

  // 물리 공 key (재마운트용)
  const physicsKey = useRef(0);

  // flying 상태가 true로 바뀔 때 물리 공 리셋
  useEffect(() => {
    if (flying) {
      physicsKey.current += 1;
      setRestPosition(null);
    }
  }, [flying, shotTick]);

  // 물리 시뮬레이션 중 위치 업데이트 (카메라 추적용)
  const handlePositionUpdate = useCallback((pos: THREE.Vector3) => {
    setCameraFollowPosition([pos.x, pos.y, pos.z]);
  }, []);

  // 물리 시뮬레이션 완료 처리
  const handlePhysicsRest = useCallback((finalPos: THREE.Vector3) => {
    // 착지 이펙트 표시
    const zone = getLandingZone(finalPos.x, finalPos.z, HOLE_1_LAYOUT);
    setLandingEffect({
      active: true,
      position: [finalPos.x, finalPos.y, finalPos.z],
      zone,
    });

    // 멈춘 위치 저장
    setRestPosition([finalPos.x, finalPos.y, finalPos.z]);
    setCameraFollowPosition([finalPos.x, finalPos.y, finalPos.z]);

    // 상위 컴포넌트에 완료 알림
    onFlightComplete?.(finalPos);
  }, [onFlightComplete]);

  const handleLandingEffectComplete = useCallback(() => {
    setLandingEffect((prev) => ({ ...prev, active: false }));
  }, []);

  // 카메라가 따라갈 위치 결정
  const cameraTarget = flying
    ? cameraFollowPosition
    : (restPosition ?? targetBallPosition);

  return (
    <>
      {/* 열대 해변 하늘 - 맑고 청명한 느낌 */}
      <Sky
        sunPosition={[150, 100, 200]}
        turbidity={8}
        rayleigh={0.8}
        mieCoefficient={0.003}
        mieDirectionalG={0.95}
      />
      <Clouds material={THREE.MeshBasicMaterial} position={[0, 120, 200]}>
        <Cloud seed={1} bounds={[400, 25, 100]} volume={40} color="#ffffff" opacity={0.7} />
        <Cloud seed={3} bounds={[350, 20, 80]} volume={30} color="#f8fcff" opacity={0.6} />
        <Cloud seed={5} bounds={[300, 15, 60]} volume={25} color="#f0f8ff" opacity={0.5} />
      </Clouds>

      {/* 열대 조명 - 밝고 따뜻한 느낌 */}
      <hemisphereLight args={['#87ceeb', '#2d8a4a', 0.8]} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[120, 180, 150]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={1000}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={450}
        shadow-camera-bottom={-50}
      />

      {/* 공유 코스 지오메트리 (물리 없음) */}
      <SharedCourse enablePhysics={false} onHazardEnter={onHazardEnter} />

      {/* 카메라가 공을 따라감 (X, Y, Z 모두 추적) */}
      <CameraController
        ballX={cameraTarget[0]}
        ballY={cameraTarget[1]}
        ballZ={cameraTarget[2]}
        flying={flying}
      />

      {/* 공 렌더링 - 경량 물리 시뮬레이터 사용 */}
      {flying ? (
        // 샷을 쳤을 때: 경량 물리 공 (발사 → 착지 → 굴러감 → 멈춤)
        <LightweightBall
          key={`lightweight-ball-${physicsKey.current}`}
          startPosition={startBallPosition}
          targetPosition={targetBallPosition}
          launch={true}
          onRest={handlePhysicsRest}
          onPositionUpdate={handlePositionUpdate}
        />
      ) : (
        // 대기 중: 고정된 공 (마지막 멈춘 위치 또는 gameStore 위치)
        <StaticBall
          key={`static-ball-${shotTick ?? 0}`}
          position={restPosition ?? targetBallPosition}
        />
      )}

      {/* 착지 이펙트 */}
      <LandingEffect
        position={landingEffect.position}
        zone={landingEffect.zone}
        active={landingEffect.active}
        onComplete={handleLandingEffectComplete}
      />

      {/* 열대 해변 안개 - 청명한 하늘색, 멀리까지 */}
      <fog attach="fog" args={['#c5e8f5', 500, 1200]} />
    </>
  );
}

export function GolfCourseScene({
  progress,
  lateralX,
  shotTick,
  flying = false,
  prevProgress = 0,
  prevLateralX = 0,
  onFlightComplete,
  onHazardEnter,
}: GolfCourseSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 15, -35], fov: 55, near: 0.1, far: 2000 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <SceneContent
          progress={progress}
          lateralX={lateralX}
          shotTick={shotTick}
          flying={flying}
          prevProgress={prevProgress}
          prevLateralX={prevLateralX}
          onFlightComplete={onFlightComplete}
          onHazardEnter={onHazardEnter}
        />
      </Suspense>
    </Canvas>
  );
}
