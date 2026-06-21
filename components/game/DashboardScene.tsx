'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, Clouds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Hole, Team } from '@/lib/game/types';
import type { ShotEvent } from '@/lib/game/gameServer';
import { BallMarker } from './BallMarker';
import { ArcBall } from './ArcBall';
import { SharedCourse, COURSE_LENGTH } from './SharedCourse';

const LABEL_COLORS = ['#2f7fb0', '#7a55c9', '#1f9d57', '#e07a2f', '#c2456a', '#0f9aa6'];

// 필드 정중앙 (티 z=5 ~ 그린 z=380 → 중앙 z≈190)
const FIELD_CENTER_Z = 190;
const FIELD_CENTER_Y = 8;

/**
 * 관전 카메라 컨트롤러 (씬 교체 없이 OrbitControls의 타겟만 이동).
 * 포커스 대상으로 타겟을 부드럽게 옮겨 시점만 바꾸고, 사용자의 휠 줌·드래그 회전은
 * OrbitControls가 그대로 처리한다. 포커스 시작 시 한 번 가까이 당겨 초기 프레이밍.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SpectateControls({
  controlsRef,
  focusing,
  focusPos,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.MutableRefObject<any>;
  focusing: boolean;
  focusPos: [number, number, number] | null;
}) {
  const lastFocus = useRef<THREE.Vector3 | null>(null);
  const dollied = useRef(false);

  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;

    if (focusPos) lastFocus.current = new THREE.Vector3(focusPos[0], focusPos[1], focusPos[2]);
    const fp = focusing ? focusPos ? new THREE.Vector3(focusPos[0], focusPos[1], focusPos[2]) : lastFocus.current : null;

    if (!focusing) {
      dollied.current = false;
    } else if (!dollied.current && fp) {
      // 포커스 시작 시 1회: 현재 시선 방향을 유지한 채 대상 가까이로 당겨 초기 프레이밍
      const cam = c.object as THREE.Camera;
      const dir = cam.position.clone().sub(c.target);
      if (dir.lengthSq() < 1e-3) dir.set(0, 0.5, -1);
      dir.normalize();
      c.target.copy(fp);
      cam.position.copy(fp).addScaledVector(dir, 90);
      dollied.current = true;
    }

    // 타겟만 부드럽게 추적(줌/회전은 사용자가 제어). 포커스 없으면 필드 중앙.
    const desired = fp ?? new THREE.Vector3(0, FIELD_CENTER_Y, FIELD_CENTER_Z);
    c.target.lerp(desired, 0.1);
  });

  return null;
}

/** 누적거리(dist)·측면(x) → 대시보드 좌표. 마커 배치(teamZ/teamX)와 동일 기준. */
function dashPoint(x: number, dist: number, holeDistance: number): [number, number, number] {
  const progress = holeDistance > 0 ? THREE.MathUtils.clamp(dist / holeDistance, 0, 1) : 0;
  const isAtTee = progress < 0.005;
  const z = isAtTee ? 5 : 5 + progress * 375;
  const px = isAtTee ? 0 : THREE.MathUtils.clamp(x * 0.4, -30, 30);
  return [px, 1.5, z];
}

/**
 * 실제 샷 1건에 대한 비행 공. 게임 화면과 동일한 ArcBall(거리비례 높이)을 사용한다.
 * 큐에서 제거되면 언마운트되므로 반복 재생되지 않는다.
 */
function FlyingShot({
  shot,
  holeDistance,
  onDone,
}: {
  shot: ShotEvent;
  holeDistance: number;
  onDone: () => void;
}) {
  return (
    <ArcBall
      start={dashPoint(shot.fromX, shot.fromDist, holeDistance)}
      end={dashPoint(shot.toX, shot.toDist, holeDistance)}
      radius={1.2}
      onDone={onDone}
    />
  );
}

interface DashboardSceneProps {
  teams: Team[];
  hole: Hole;
  /** 관전 시 플레이어 마커 클릭 핸들러 (있으면 마커가 클릭 가능해짐). */
  onSelectPlayer?: (playerId: string) => void;
  /** 재생할 실제 샷 이벤트 큐 (각 샷은 한 번만 비행). */
  shots?: ShotEvent[];
  /** 비행 애니메이션 완료 시 호출 (큐에서 제거). */
  onShotDone?: (id: number) => void;
  /** 관전 포커스 대상 플레이어 ID (있으면 카메라가 그 공으로 이동). */
  focusPlayerId?: string | null;
}

/**
 * 대시보드 3D 씬
 * - 조감도 카메라 (자동 회전)
 * - 게임 화면과 동일한 코스 지오메트리
 */
export function DashboardScene({
  teams,
  hole,
  onSelectPlayer,
  shots = [],
  onShotDone,
  focusPlayerId = null,
}: DashboardSceneProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // 현재 비행 중인 샷의 플레이어 ID 집합 (도착지 공 숨김용)
  const flyingPlayerIds = new Set(shots.map((s) => s.playerId));

  // 관전 포커스 대상의 대시보드 좌표 (있으면 카메라가 그쪽으로 이동)
  const focusTeam = focusPlayerId ? teams.find((t) => t.id === focusPlayerId) : null;
  const focusPos = focusTeam
    ? dashPoint(focusTeam.ballPosition.x, focusTeam.totalDistance, hole.distance)
    : null;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 150, FIELD_CENTER_Z - 200], fov: 50, near: 0.1, far: 2000 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Sky sunPosition={[200, 80, -200]} turbidity={5} rayleigh={1} />
        <Clouds material={THREE.MeshBasicMaterial} position={[0, 100, FIELD_CENTER_Z]}>
          <Cloud seed={2} bounds={[300, 20, 100]} volume={40} color="#ffffff" opacity={0.6} />
          <Cloud seed={5} bounds={[250, 15, 80]} volume={30} color="#f0f5ff" opacity={0.5} />
        </Clouds>

        <hemisphereLight args={['#cfe8ff', '#3a5a32', 0.75]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[150, 200, FIELD_CENTER_Z]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-350}
          shadow-camera-right={350}
          shadow-camera-top={350}
          shadow-camera-bottom={-350}
          shadow-camera-far={800}
        />

        {/* 공유 코스 (물리 없음) */}
        <SharedCourse enablePhysics={false} />

        {/* 실제 샷 비행 — 각 샷 이벤트는 from→to 포물선으로 한 번만 날아간다 */}
        {shots.map((shot) => (
          <FlyingShot
            key={shot.id}
            shot={shot}
            holeDistance={hole.distance}
            onDone={() => onShotDone?.(shot.id)}
          />
        ))}

        {/* 모든 팀 공 표시 */}
        {teams.map((team, i) => {
          const progress = hole.distance > 0 ? team.totalDistance / hole.distance : 0;
          const teamZ = 5 + THREE.MathUtils.clamp(progress, 0, 1) * 375;
          const teamX = THREE.MathUtils.clamp(team.ballPosition.x * 0.4, -30, 30);
          const isAtTee = progress < 0.005;
          // 이 팀의 샷이 비행 중이면 도착지 공은 숨김(애니 종료 후 생성). 라벨은 유지.
          const isFlying = flyingPlayerIds.has(team.id);

          return (
            <BallMarker
              key={team.id}
              position={[isAtTee ? 0 : teamX, 1.5, isAtTee ? 5 : teamZ]}
              radius={1.2}
              label={team.name}
              labelColor={LABEL_COLORS[i % LABEL_COLORS.length]}
              imageUrl={team.imageUrl}
              hideBall={isFlying}
              prompt={team.currentPrompt}
              onClick={onSelectPlayer ? () => onSelectPlayer(team.id) : undefined}
              snap
            />
          );
        })}

        {/* 카메라: OrbitControls로 휠 줌·드래그 회전 지원. 포커스 시 타겟만 플레이어로 이동 */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableZoom
          enableRotate
          autoRotate={focusPlayerId == null}
          autoRotateSpeed={0.2}
          minDistance={30}
          maxDistance={600}
          minPolarAngle={0.2}
          maxPolarAngle={1.45}
        />{/* target은 SpectateControls가 전담(매 렌더 prop 리셋 방지) */}
        <SpectateControls
          controlsRef={controlsRef}
          focusing={focusPlayerId != null}
          focusPos={focusPos}
        />

        <fog attach="fog" args={['#bfdcf0', 500, 1400]} />
      </Suspense>
    </Canvas>
  );
}
