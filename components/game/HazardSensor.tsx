'use client';

/**
 * HazardSensor는 경량 물리 시뮬레이터로 대체됨
 *
 * Rapier 기반 센서 충돌체는 더 이상 사용되지 않습니다.
 * BallSimulator가 TerrainSampler.getZone()으로 해저드를 감지합니다.
 *
 * 이 컴포넌트는 하위 호환성을 위해 빈 그룹을 렌더링합니다.
 */

import type { HazardZone } from '@/lib/game/types';

interface HazardSensorProps {
  hazard: HazardZone;
  onBallEnter: (hazardId: string) => void;
}

export function HazardSensor(_props: HazardSensorProps) {
  // Rapier 센서 제거 - BallSimulator가 지형 타입으로 감지
  return null;
}

interface HazardSensorsProps {
  hazards: HazardZone[];
  onBallEnterHazard: (hazardId: string) => void;
}

export function HazardSensors(_props: HazardSensorsProps) {
  // Rapier 센서 제거 - BallSimulator가 지형 타입으로 감지
  return null;
}
