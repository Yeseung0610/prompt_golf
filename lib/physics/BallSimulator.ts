/**
 * 경량 골프공 물리 시뮬레이터
 *
 * Rapier WASM 대신 순수 JS로 구현:
 * 1. 포물선 비행 (공기 저항 포함)
 * 2. 착지 + 튕김
 * 3. 굴러감 (지형 경사, 마찰 적용)
 * 4. 정지 감지
 *
 * 성능: 14,400+ 삼각형 충돌 검사 대신 단순 높이맵 쿼리
 */

import type { CourseLayout, LandingZone } from '@/lib/game/types';
import { TerrainSampler } from './TerrainSampler';
import {
  GRAVITY,
  AIR_DRAG,
  BOUNCE_RESTITUTION,
  MIN_BOUNCE_VELOCITY,
  DEFAULT_FLIGHT_TIME,
  MAX_FLIGHT_HEIGHT,
  LAUNCH_HEIGHT_FACTOR,
  ROLLING_FRICTION,
  SLOPE_ACCELERATION,
  REST_VELOCITY_THRESHOLD,
  REST_TIME_REQUIRED,
  MAX_DELTA_TIME,
} from './config';

/** 시뮬레이션 상태 */
export type SimulationPhase = 'idle' | 'flying' | 'bouncing' | 'rolling' | 'resting';

/** 시뮬레이션 결과 */
export interface SimulationState {
  /** 현재 위치 */
  position: { x: number; y: number; z: number };
  /** 현재 속도 */
  velocity: { x: number; y: number; z: number };
  /** 시뮬레이션 단계 */
  phase: SimulationPhase;
  /** 현재 지형 타입 */
  zone: LandingZone;
  /** 완전히 멈췄는지 */
  isResting: boolean;
}

/**
 * 골프공 물리 시뮬레이터
 */
export class BallSimulator {
  private terrainSampler: TerrainSampler;

  // 상태
  private posX = 0;
  private posY = 0;
  private posZ = 0;
  private velX = 0;
  private velY = 0;
  private velZ = 0;
  private phase: SimulationPhase = 'idle';
  private restTimer = 0;

  constructor(layout: CourseLayout) {
    this.terrainSampler = new TerrainSampler(layout);
  }

  /**
   * 공 발사
   * @param from 시작 위치 [x, y, z]
   * @param to 목표 위치 [x, y, z] (착지 예상 지점)
   * @param flightTime 비행 시간 (초), 기본값 사용 시 거리 기반 자동 계산
   */
  launch(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    flightTime?: number
  ): void {
    // 시작 위치 설정 (지형보다 약간 위)
    const terrainHeight = this.terrainSampler.getHeight(from.x, from.z);
    this.posX = from.x;
    this.posY = Math.max(from.y, terrainHeight + 0.5);
    this.posZ = from.z;

    // 수평 거리 계산
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    if (horizontalDist < 0.1) {
      // 거의 같은 위치 - 위로 살짝만
      this.velX = 0;
      this.velY = 5;
      this.velZ = 0;
      this.phase = 'flying';
      this.restTimer = 0;
      return;
    }

    // 비행 시간 결정 (거리에 비례, 최소/최대 제한)
    const t = flightTime ?? Math.min(Math.max(horizontalDist / 80, 2.5), DEFAULT_FLIGHT_TIME);

    // 수평 속도
    const horizontalSpeed = horizontalDist / t;
    this.velX = (dx / horizontalDist) * horizontalSpeed;
    this.velZ = (dz / horizontalDist) * horizontalSpeed;

    // 수직 속도 (포물선 정점 높이 계산)
    // 물리학: 최대 높이 h에 도달하려면 v_y0 = sqrt(2 * g * h)
    const maxHeight = Math.min(
      horizontalDist * LAUNCH_HEIGHT_FACTOR,
      MAX_FLIGHT_HEIGHT
    );
    // 올바른 포물선 공식: v_y = sqrt(2 * g * h)
    // 이렇게 하면 공이 maxHeight까지만 올라갑니다
    this.velY = Math.sqrt(2 * GRAVITY * maxHeight);

    this.phase = 'flying';
    this.restTimer = 0;
  }

  /**
   * 시뮬레이션 업데이트 (매 프레임 호출)
   * @param delta 경과 시간 (초)
   * @returns 현재 시뮬레이션 상태
   */
  update(delta: number): SimulationState {
    // 델타 타임 제한 (큰 프레임 드롭 방지)
    const dt = Math.min(delta, MAX_DELTA_TIME);

    if (this.phase === 'idle' || this.phase === 'resting') {
      return this.getState();
    }

    const terrainHeight = this.terrainSampler.getHeight(this.posX, this.posZ);
    const zone = this.terrainSampler.getZone(this.posX, this.posZ);

    if (this.phase === 'flying' || this.phase === 'bouncing') {
      this.updateFlying(dt, terrainHeight, zone);
    } else if (this.phase === 'rolling') {
      this.updateRolling(dt, terrainHeight, zone);
    }

    return this.getState();
  }

  /**
   * 비행/튕김 단계 업데이트
   */
  private updateFlying(dt: number, terrainHeight: number, zone: LandingZone): void {
    // 공기 저항 적용
    const speed = Math.sqrt(
      this.velX * this.velX + this.velY * this.velY + this.velZ * this.velZ
    );
    if (speed > 0.01) {
      const dragFactor = 1 - AIR_DRAG * dt * speed;
      this.velX *= dragFactor;
      this.velZ *= dragFactor;
      // Y 방향은 중력이 주로 영향
    }

    // 중력 적용
    this.velY -= GRAVITY * dt;

    // 위치 업데이트
    this.posX += this.velX * dt;
    this.posY += this.velY * dt;
    this.posZ += this.velZ * dt;

    // 지형 충돌 검사
    const newTerrainHeight = this.terrainSampler.getHeight(this.posX, this.posZ);
    if (this.posY <= newTerrainHeight) {
      // 착지!
      this.posY = newTerrainHeight;

      // 물이나 OB면 즉시 정지
      if (zone === 'water' || zone === 'ob') {
        this.velX = 0;
        this.velY = 0;
        this.velZ = 0;
        this.phase = 'resting';
        return;
      }

      // 튕김 처리
      if (this.velY < -MIN_BOUNCE_VELOCITY) {
        // 충분한 속도로 착지 - 튕김
        this.velY = -this.velY * BOUNCE_RESTITUTION;
        // 수평 속도도 약간 감소
        this.velX *= 0.85;
        this.velZ *= 0.85;
        this.phase = 'bouncing';
      } else {
        // 약한 충돌 - 굴러감 전환
        this.velY = 0;
        this.phase = 'rolling';
      }
    }
  }

  /**
   * 굴러감 단계 업데이트
   */
  private updateRolling(dt: number, terrainHeight: number, zone: LandingZone): void {
    // 경사도 가져오기
    const gradient = this.terrainSampler.getGradient(this.posX, this.posZ);

    // 마찰 계수 (지형별)
    const friction = ROLLING_FRICTION[zone] ?? ROLLING_FRICTION.rough;

    // 경사 가속도 (내리막은 가속, 오르막은 감속)
    this.velX += gradient.x * SLOPE_ACCELERATION * dt;
    this.velZ += gradient.z * SLOPE_ACCELERATION * dt;

    // 마찰 감속
    const speed = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
    if (speed > 0.01) {
      const frictionDecel = friction * GRAVITY * dt;
      const newSpeed = Math.max(0, speed - frictionDecel);
      const factor = newSpeed / speed;
      this.velX *= factor;
      this.velZ *= factor;
    }

    // 위치 업데이트
    this.posX += this.velX * dt;
    this.posZ += this.velZ * dt;

    // 높이는 지형을 따라감
    this.posY = this.terrainSampler.getHeight(this.posX, this.posZ);

    // 정지 판정
    const currentSpeed = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
    if (currentSpeed < REST_VELOCITY_THRESHOLD) {
      this.restTimer += dt;
      if (this.restTimer >= REST_TIME_REQUIRED) {
        this.velX = 0;
        this.velZ = 0;
        this.phase = 'resting';
      }
    } else {
      this.restTimer = 0;
    }
  }

  /**
   * 현재 상태 반환
   */
  getState(): SimulationState {
    return {
      position: { x: this.posX, y: this.posY, z: this.posZ },
      velocity: { x: this.velX, y: this.velY, z: this.velZ },
      phase: this.phase,
      zone: this.terrainSampler.getZone(this.posX, this.posZ),
      isResting: this.phase === 'resting',
    };
  }

  /**
   * 위치 직접 설정 (리셋용)
   */
  setPosition(x: number, y: number, z: number): void {
    this.posX = x;
    this.posY = y;
    this.posZ = z;
    this.velX = 0;
    this.velY = 0;
    this.velZ = 0;
    this.phase = 'idle';
    this.restTimer = 0;
  }

  /**
   * 레이아웃 업데이트 (홀 변경 시)
   */
  setLayout(layout: CourseLayout): void {
    this.terrainSampler.setLayout(layout);
  }

  /**
   * 시뮬레이터 리셋
   */
  reset(): void {
    this.posX = 0;
    this.posY = 0;
    this.posZ = 0;
    this.velX = 0;
    this.velY = 0;
    this.velZ = 0;
    this.phase = 'idle';
    this.restTimer = 0;
  }
}
