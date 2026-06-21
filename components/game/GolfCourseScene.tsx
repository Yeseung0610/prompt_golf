'use client';

import { Suspense, useState, useCallback, useRef, useEffect, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';
import { StaticBall } from './LightweightBall';
import { ArcBall } from './ArcBall';
import { BallMarker } from './BallMarker';
import { CameraController } from './CameraController';
import { LandingEffect } from './LandingEffect';
import { SharedCourse, COURSE_LENGTH } from './SharedCourse';
import { HOLE_1_LAYOUT, getLandingZone } from '@/lib/game/courseLayout';
import type { LandingZone } from '@/lib/game/types';
import type { ShotEvent } from '@/lib/game/gameServer';

// 게임 화면 공 표시 크기 — 홈(DashboardScene)의 BallMarker radius와 동일하게 맞춤.
const BALL_DISPLAY_RADIUS = 1.2;

/** 게임 화면에 함께 표시할 상대 플레이어. */
export interface OtherBall {
  id: string;
  name: string;
  imageUrl: string | null;
  progress: number;
  lateralX: number;
}

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
  /** 함께 표시할 상대 플레이어들. */
  others?: OtherBall[];
  /** 상대 샷 비행 이벤트 큐 (자기 샷은 제외하고 재생). */
  shots?: ShotEvent[];
  /** 내 플레이어 ID (자기 샷 식별용). */
  myPlayerId?: string;
  /** 비행 애니메이션 완료 시 호출 (큐에서 제거). */
  onShotDone?: (id: number) => void;
  /** 홀 전체 거리 (샷 dist → progress 변환용). */
  holeDistance?: number;
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
  others = [],
  shots = [],
  myPlayerId,
  onShotDone,
  holeDistance = 380,
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

  // 비행(ArcBall) 완료 처리 — 도착지 = targetBallPosition
  const handleOwnFlightDone = useCallback(() => {
    const [fx, fy, fz] = targetBallPosition;
    const zone = getLandingZone(fx, fz, HOLE_1_LAYOUT);
    setLandingEffect({ active: true, position: [fx, fy, fz], zone });
    setRestPosition([fx, fy, fz]);
    setCameraFollowPosition([fx, fy, fz]);
    onFlightComplete?.(new THREE.Vector3(fx, fy, fz));
    // targetBallPosition은 매 렌더 새 배열이지만 비행 중 값은 고정 → 안전
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFlightComplete, targetBallPosition[0], targetBallPosition[1], targetBallPosition[2]]);

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

      {/* 내 공 — 게임/관전 공통 ArcBall(거리비례 높이)로 비행 */}
      {flying ? (
        <ArcBall
          key={`arc-ball-${physicsKey.current}`}
          start={startBallPosition}
          end={targetBallPosition}
          radius={BALL_DISPLAY_RADIUS}
          onProgress={handlePositionUpdate}
          onDone={handleOwnFlightDone}
        />
      ) : (
        <StaticBall
          key={`static-ball-${shotTick ?? 0}`}
          position={restPosition ?? targetBallPosition}
          radius={BALL_DISPLAY_RADIUS}
        />
      )}

      {/* 상대 플레이어들 — 게임 화면에도 표시. 비행 중인 상대는 정지 공 숨김 */}
      {others.map((o) => {
        const isFlying = shots.some((s) => s.playerId === o.id);
        if (isFlying) return null;
        return (
          <BallMarker
            key={o.id}
            position={calculateBallPosition(o.progress, o.lateralX)}
            radius={BALL_DISPLAY_RADIUS}
            label={o.name}
            imageUrl={o.imageUrl}
            snap
          />
        );
      })}

      {/* 상대 샷 비행 (내 샷은 위에서 처리) */}
      {shots
        .filter((s) => s.playerId !== myPlayerId)
        .map((s) => (
          <ArcBall
            key={s.id}
            start={calculateBallPosition(s.fromDist / holeDistance, s.fromX)}
            end={calculateBallPosition(s.toDist / holeDistance, s.toX)}
            radius={BALL_DISPLAY_RADIUS}
            onDone={() => onShotDone?.(s.id)}
          />
        ))}

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

function GolfCourseSceneComponent({
  progress,
  lateralX,
  shotTick,
  flying = false,
  prevProgress = 0,
  prevLateralX = 0,
  onFlightComplete,
  onHazardEnter,
  others,
  shots,
  myPlayerId,
  onShotDone,
  holeDistance,
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
          others={others}
          shots={shots}
          myPlayerId={myPlayerId}
          onShotDone={onShotDone}
          holeDistance={holeDistance}
        />
      </Suspense>
    </Canvas>
  );
}

/**
 * 폴링 등으로 부모가 자주 재렌더되어도 props(스칼라 + 안정화된 콜백)가 동일하면
 * 무거운 3D 씬을 재렌더하지 않도록 memo로 감싼다 → 비행 애니메이션 끊김/깜빡임 방지.
 */
export const GolfCourseScene = memo(GolfCourseSceneComponent);
