'use client';

/**
 * PhysicsBall은 LightweightBall로 대체됨
 *
 * Rapier 기반 물리 공은 더 이상 사용되지 않습니다.
 * LightweightBall이 순수 JS BallSimulator로 물리를 처리합니다.
 *
 * 이 파일은 하위 호환성을 위해 LightweightBall을 re-export합니다.
 */

export { LightweightBall as PhysicsBall, StaticBall } from './LightweightBall';
