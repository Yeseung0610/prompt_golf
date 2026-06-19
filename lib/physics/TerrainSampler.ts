/**
 * 지형 높이맵 샘플러
 *
 * 코스 레이아웃(hills)에서 특정 위치의:
 * - 높이 (바이리니어 보간)
 * - 경사도 (굴러감 방향/가속도 계산용)
 * - 지형 타입 (마찰 계수 결정)
 */

import type { CourseLayout, LandingZone } from '@/lib/game/types';
import { getLandingZone, getTerrainHeight as getLayoutHeight } from '@/lib/game/courseLayout';

export interface TerrainSample {
  /** 지형 높이 (m) */
  height: number;
  /** X축 경사도 (양수 = +X 방향으로 내려감) */
  gradientX: number;
  /** Z축 경사도 (양수 = +Z 방향으로 내려감) */
  gradientZ: number;
  /** 지형 타입 */
  zone: LandingZone;
}

/** 경사도 계산을 위한 샘플링 간격 (m) */
const GRADIENT_SAMPLE_DIST = 0.5;

/**
 * 지형 샘플러 클래스
 *
 * 코스 레이아웃을 기반으로 임의 위치의 지형 정보를 제공합니다.
 * hills 배열의 가우시안 함수들을 합성하여 부드러운 지형을 생성합니다.
 */
export class TerrainSampler {
  private layout: CourseLayout;

  constructor(layout: CourseLayout) {
    this.layout = layout;
  }

  /**
   * 특정 위치의 지형 높이 반환
   */
  getHeight(x: number, z: number): number {
    return getLayoutHeight(x, z, this.layout);
  }

  /**
   * 특정 위치의 경사도 반환 (수치 미분)
   */
  getGradient(x: number, z: number): { x: number; z: number } {
    const h = GRADIENT_SAMPLE_DIST;

    // 중앙 차분법으로 경사도 계산
    const hPosX = this.getHeight(x + h, z);
    const hNegX = this.getHeight(x - h, z);
    const hPosZ = this.getHeight(x, z + h);
    const hNegZ = this.getHeight(x, z - h);

    // 경사도 = 높이 변화율 (양수 = 올라감, 음수 = 내려감)
    // 굴러감 방향은 경사도의 반대 방향
    return {
      x: -(hPosX - hNegX) / (2 * h),
      z: -(hPosZ - hNegZ) / (2 * h),
    };
  }

  /**
   * 특정 위치의 지형 타입 반환
   */
  getZone(x: number, z: number): LandingZone {
    return getLandingZone(x, z, this.layout);
  }

  /**
   * 특정 위치의 전체 지형 샘플 반환
   */
  sample(x: number, z: number): TerrainSample {
    const gradient = this.getGradient(x, z);
    return {
      height: this.getHeight(x, z),
      gradientX: gradient.x,
      gradientZ: gradient.z,
      zone: this.getZone(x, z),
    };
  }

  /**
   * 레이아웃 업데이트 (홀 변경 시)
   */
  setLayout(layout: CourseLayout): void {
    this.layout = layout;
  }
}

/** 싱글톤 인스턴스 (기본 레이아웃용) */
let defaultSampler: TerrainSampler | null = null;

/**
 * 기본 지형 샘플러 가져오기
 */
export function getDefaultSampler(layout: CourseLayout): TerrainSampler {
  if (!defaultSampler) {
    defaultSampler = new TerrainSampler(layout);
  } else {
    defaultSampler.setLayout(layout);
  }
  return defaultSampler;
}
