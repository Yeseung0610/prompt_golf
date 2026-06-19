/**
 * 골프 물리 시뮬레이션 상수
 *
 * 실제 골프 물리를 단순화한 값들:
 * - 중력, 공기 저항, 마찰 계수
 * - 지형별 굴러감 특성
 */

/** 중력 가속도 (m/s²) */
export const GRAVITY = 9.81;

/** 공기 저항 계수 (비행 중 속도 감쇠) */
export const AIR_DRAG = 0.02;

/** 반발 계수 (착지 시 튕김 정도, 0-1) */
export const BOUNCE_RESTITUTION = 0.4;

/** 최소 튕김 속도 - 이보다 느리면 튕기지 않음 (m/s) */
export const MIN_BOUNCE_VELOCITY = 1.5;

/** 비행 시간 (초) - 포물선 비행 기본 시간 */
export const DEFAULT_FLIGHT_TIME = 4.0;

/** 최대 비행 높이 (m) - 실제 골프샷 수준 */
export const MAX_FLIGHT_HEIGHT = 25;

/** 발사 높이 계수 (거리 대비) - 드라이버 기준 약 12도 */
export const LAUNCH_HEIGHT_FACTOR = 0.12;

/** 굴러감 마찰 계수 (지형별) */
export const ROLLING_FRICTION: Record<string, number> = {
  fairway: 0.12,   // 잔디 - 부드러움
  green: 0.08,     // 그린 - 매우 부드러움
  rough: 0.25,     // 러프 - 저항 큼
  bunker: 0.45,    // 벙커 - 모래라 많이 멈춤
  beach: 0.5,      // 해변 - 모래
  water: 1.0,      // 물 - 즉시 정지
  ob: 1.0,         // OB - 즉시 정지
};

/** 경사면 굴러감 가속도 계수 */
export const SLOPE_ACCELERATION = 2.0;

/** 정지 판정 속도 임계값 (m/s) */
export const REST_VELOCITY_THRESHOLD = 0.15;

/** 정지 판정 유지 시간 (초) */
export const REST_TIME_REQUIRED = 0.3;

/** 시뮬레이션 델타 타임 상한 (초) */
export const MAX_DELTA_TIME = 0.05;

/** 공 반지름 (m) - 게임에서 시각적으로 보이는 크기 */
export const BALL_RADIUS = 0.25;
