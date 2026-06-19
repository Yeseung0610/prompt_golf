'use client';

/**
 * PhysicsWorld는 경량 물리 시뮬레이터로 대체됨
 *
 * Rapier WASM 기반 물리는 더 이상 사용되지 않습니다.
 * BallSimulator가 포물선 + 지형 높이맵으로 물리를 처리합니다.
 *
 * 이 컴포넌트는 하위 호환성을 위해 유지되며,
 * 단순히 children을 그대로 렌더링합니다.
 */

import { ReactNode } from 'react';

interface PhysicsWorldProps {
  children: ReactNode;
  debug?: boolean;
}

export function PhysicsWorld({ children }: PhysicsWorldProps) {
  // Rapier Physics 래퍼 제거 - 단순 그룹으로 대체
  return <>{children}</>;
}
