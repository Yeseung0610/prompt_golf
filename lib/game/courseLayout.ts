import type { CourseLayout } from './types';

/**
 * Tropical Seaside Golf Course - Par 4, 395m
 *
 * 열대 해변 골프 코스:
 * - S-커브 페어웨이 (티박스에서 그린까지)
 * - 왼쪽: 청록색 바다 + 백사장 해변
 * - 오른쪽 상단: 라군/워터 해저드
 * - 야자수 군락, 열대 식물
 * - 고도 변화: 티(0m) → 페어웨이(+6m) → 그린(+10m)
 */
export const HOLE_1_LAYOUT: CourseLayout = {
  hills: [
    // ===== 티박스 영역 (고도 0m) =====
    // 티박스는 평평하게 유지

    // ===== 페어웨이 초반 (고도 +2m~+4m) =====
    // 완만한 오르막 시작
    { position: [0, 0, 60], radius: 50, height: 2 },
    { position: [-20, 0, 90], radius: 45, height: 3 },
    { position: [15, 0, 100], radius: 40, height: 2.5 },

    // ===== 페어웨이 중반 (고도 +4m~+6m) =====
    // S-커브 첫 번째 굴곡 (왼쪽으로)
    { position: [-25, 0, 150], radius: 55, height: 5 },
    { position: [10, 0, 170], radius: 50, height: 4.5 },
    { position: [-15, 0, 200], radius: 60, height: 6 },

    // S-커브 두 번째 굴곡 (오른쪽으로)
    { position: [20, 0, 250], radius: 55, height: 6.5 },
    { position: [-10, 0, 280], radius: 50, height: 7 },

    // ===== 그린 접근 영역 (고도 +7m~+9m) =====
    { position: [-20, 0, 320], radius: 60, height: 8 },
    { position: [5, 0, 350], radius: 55, height: 9 },

    // ===== 그린 영역 (고도 +10m) =====
    { position: [-15, 0, 380], radius: 50, height: 10 },
    { position: [-25, 0, 395], radius: 40, height: 10.5 },
    { position: [0, 0, 400], radius: 35, height: 10 },

    // ===== 왼쪽 해변 경계 언덕 (바다와 코스 분리) =====
    { position: [-70, 0, 50], radius: 35, height: 4 },
    { position: [-80, 0, 120], radius: 40, height: 5 },
    { position: [-75, 0, 200], radius: 45, height: 6 },
    { position: [-70, 0, 280], radius: 40, height: 7 },
    { position: [-65, 0, 350], radius: 35, height: 8 },

    // ===== 오른쪽 숲 경계 언덕 =====
    { position: [70, 0, 80], radius: 45, height: 5 },
    { position: [80, 0, 150], radius: 50, height: 6 },
    { position: [75, 0, 220], radius: 55, height: 7 },
    { position: [65, 0, 300], radius: 45, height: 8 },
    { position: [60, 0, 370], radius: 40, height: 9 },
  ],
  hazards: [
    // ===== 바다 (왼쪽, 전체 길이) =====
    {
      id: 'ocean',
      type: 'water',
      position: [-130, -2, 200],
      size: [80, 5, 400],
      penalty: 1,
      resetToLastPosition: true,
    },

    // ===== 라군/워터 해저드 (오른쪽 상단) =====
    {
      id: 'lagoon',
      type: 'water',
      position: [55, -1, 320],
      size: [50, 4, 60],
      penalty: 1,
      resetToLastPosition: true,
    },

    // ===== 그린사이드 벙커들 =====
    // 그린 왼쪽 앞 벙커
    {
      id: 'bunker-green-fl',
      type: 'bunker',
      position: [-35, -0.5, 365],
      size: [14, 2, 12],
      penalty: 0,
      resetToLastPosition: false,
    },
    // 그린 왼쪽 벙커
    {
      id: 'bunker-green-l',
      type: 'bunker',
      position: [-40, -0.5, 385],
      size: [12, 2, 16],
      penalty: 0,
      resetToLastPosition: false,
    },
    // 그린 오른쪽 앞 벙커
    {
      id: 'bunker-green-fr',
      type: 'bunker',
      position: [10, -0.5, 370],
      size: [16, 2, 10],
      penalty: 0,
      resetToLastPosition: false,
    },
    // 그린 뒤 벙커
    {
      id: 'bunker-green-back',
      type: 'bunker',
      position: [-10, -0.5, 400],
      size: [18, 2, 10],
      penalty: 0,
      resetToLastPosition: false,
    },

    // ===== 페어웨이 벙커들 =====
    // S-커브 첫 번째 굴곡 벙커
    {
      id: 'bunker-fairway-1',
      type: 'bunker',
      position: [25, -0.3, 160],
      size: [14, 2, 18],
      penalty: 0,
      resetToLastPosition: false,
    },
    // S-커브 두 번째 굴곡 벙커
    {
      id: 'bunker-fairway-2',
      type: 'bunker',
      position: [-30, -0.3, 270],
      size: [12, 2, 16],
      penalty: 0,
      resetToLastPosition: false,
    },

    // ===== OB 구역 =====
    // 바다 OB
    {
      id: 'ob-ocean',
      type: 'ob',
      position: [-160, 0, 200],
      size: [40, 10, 450],
      penalty: 1,
      resetToLastPosition: true,
    },
    // 오른쪽 숲 OB
    {
      id: 'ob-right',
      type: 'ob',
      position: [130, 0, 200],
      size: [60, 10, 450],
      penalty: 1,
      resetToLastPosition: true,
    },
  ],
};

/**
 * S-커브 페어웨이 경로 정의
 * 티박스에서 그린까지 자연스러운 S자 곡선
 */
export const FAIRWAY_PATH = [
  { z: 0, x: 0, width: 35 },       // 티박스
  { z: 50, x: 0, width: 40 },      // 시작
  { z: 100, x: -8, width: 50 },    // S-커브 시작
  { z: 150, x: -20, width: 55 },   // 왼쪽으로 휘어짐
  { z: 200, x: -15, width: 50 },   // 최대 왼쪽
  { z: 250, x: 5, width: 48 },     // 오른쪽으로 복귀
  { z: 300, x: 10, width: 45 },    // 오른쪽 정점
  { z: 350, x: -5, width: 40 },    // 그린 접근
  { z: 380, x: -15, width: 35 },   // 그린 앞
];

/**
 * 페어웨이 경로에서 특정 z 위치의 중심 x좌표 계산
 */
export function getFairwayCenterX(z: number): number {
  for (let i = 0; i < FAIRWAY_PATH.length - 1; i++) {
    const curr = FAIRWAY_PATH[i];
    const next = FAIRWAY_PATH[i + 1];

    if (z >= curr.z && z <= next.z) {
      const t = (z - curr.z) / (next.z - curr.z);
      return curr.x + (next.x - curr.x) * t;
    }
  }

  // z가 범위 밖일 경우
  if (z < FAIRWAY_PATH[0].z) return FAIRWAY_PATH[0].x;
  return FAIRWAY_PATH[FAIRWAY_PATH.length - 1].x;
}

/**
 * 페어웨이 경로에서 특정 z 위치의 폭 계산
 */
export function getFairwayWidth(z: number): number {
  for (let i = 0; i < FAIRWAY_PATH.length - 1; i++) {
    const curr = FAIRWAY_PATH[i];
    const next = FAIRWAY_PATH[i + 1];

    if (z >= curr.z && z <= next.z) {
      const t = (z - curr.z) / (next.z - curr.z);
      return curr.width + (next.width - curr.width) * t;
    }
  }

  if (z < FAIRWAY_PATH[0].z) return FAIRWAY_PATH[0].width;
  return FAIRWAY_PATH[FAIRWAY_PATH.length - 1].width;
}

/**
 * Get terrain height at a specific XZ position based on hills
 */
export function getTerrainHeight(x: number, z: number, layout: CourseLayout): number {
  let height = 0;

  for (const hill of layout.hills) {
    const dx = x - hill.position[0];
    const dz = z - hill.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < hill.radius) {
      const t = dist / hill.radius;
      const contribution = (hill.height * (1 + Math.cos(Math.PI * t))) / 2;
      height = Math.max(height, contribution);
    }
  }

  return height;
}

/**
 * Check which zone a position falls into
 */
export function getLandingZone(
  x: number,
  z: number,
  layout: CourseLayout,
): 'fairway' | 'rough' | 'bunker' | 'green' | 'water' | 'ob' | 'beach' {
  const LEN = 450;

  // Check hazards first
  for (const hazard of layout.hazards) {
    const [hx, , hz] = hazard.position;
    const [sx, , sz] = hazard.size;

    if (
      x >= hx - sx / 2 &&
      x <= hx + sx / 2 &&
      z >= hz - sz / 2 &&
      z <= hz + sz / 2
    ) {
      if (hazard.type === 'water') return 'water';
      if (hazard.type === 'bunker') return 'bunker';
      if (hazard.type === 'ob') return 'ob';
    }
  }

  // 해변 영역 체크 (왼쪽 바다와 코스 사이)
  if (x < -50 && x > -90) {
    return 'beach';
  }

  // Green (그린 위치: -15, 380)
  const greenCenterX = -15;
  const greenCenterZ = 380;
  const greenRadius = 30;
  const distToGreen = Math.sqrt(
    (x - greenCenterX) * (x - greenCenterX) +
    (z - greenCenterZ) * (z - greenCenterZ)
  );
  if (distToGreen <= greenRadius) return 'green';

  // Fairway (S-curved path)
  const fairwayCenterX = getFairwayCenterX(z);
  const fairwayWidth = getFairwayWidth(z);
  if (Math.abs(x - fairwayCenterX) <= fairwayWidth / 2 && z >= 0 && z <= 400) {
    return 'fairway';
  }

  return 'rough';
}
