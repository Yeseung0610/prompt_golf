import type { CoursePosition, Hole, Shot } from './types';

/** Similarity below this is treated as a miss-swing (헛스윙). */
export const MISS_SWING_THRESHOLD = 0.3;

/** Maximum distance (m) a perfect shot can travel in one swing. */
const MAX_SHOT_DISTANCE = 160;

/**
 * 벙커 blob 정의 (TerrainShader와 동기화)
 * 레퍼런스 이미지 기반 배치
 */
const BUNKER_BLOBS = [
  // === 그린 주변 벙커들 (7개) ===
  { centers: [[-32, 398], [-38, 392]], radii: [7, 5], depth: 0.7 },
  { centers: [[-28, 385], [-35, 380]], radii: [6, 5], depth: 0.6 },
  { centers: [[-30, 365], [-35, 358]], radii: [6, 5], depth: 0.6 },
  { centers: [[18, 395], [25, 388]], radii: [7, 5], depth: 0.8 },   // 항아리 벙커
  { centers: [[22, 378], [28, 372]], radii: [6, 5], depth: 0.7 },
  { centers: [[20, 358], [15, 350]], radii: [6, 5], depth: 0.6 },
  { centers: [[-5, 340], [5, 335]], radii: [5, 4], depth: 0.5 },
  // === 페어웨이 벙커들 (4개) ===
  { centers: [[30, 220], [35, 212]], radii: [7, 5], depth: 0.5 },
  { centers: [[-28, 180], [-22, 172]], radii: [6, 5], depth: 0.5 },
  { centers: [[25, 120], [30, 112]], radii: [5, 4], depth: 0.4 },
  { centers: [[-20, 50], [-25, 42]], radii: [5, 4], depth: 0.4 },
];

// Smooth minimum
function smin(a: number, b: number, k: number): number {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/**
 * 현재 위치가 벙커 안인지 확인하고 벙커 정보 반환
 * Blob 기반 벙커 (여러 원의 조합)
 */
function getBunkerAtPosition(pos: CoursePosition): { inBunker: boolean; depth: number } {
  for (const blob of BUNKER_BLOBS) {
    let blobDist = 1000;

    // 여러 원의 smooth union
    for (let i = 0; i < blob.centers.length; i++) {
      const [cx, cz] = blob.centers[i];
      const r = blob.radii[i];
      const dist = Math.sqrt((pos.x - cx) ** 2 + (pos.z - cz) ** 2) - r;

      if (i === 0) {
        blobDist = dist;
      } else {
        blobDist = smin(blobDist, dist, 5);
      }
    }

    // 벙커 내부 (노이즈 없이 단순 판정)
    if (blobDist < 0) {
      return { inBunker: true, depth: blob.depth };
    }
  }
  return { inBunker: false, depth: 0 };
}

export interface ShotInput {
  teamId: string;
  prompt: string;
  targetN: number;
  generatedHtml: string | null;
  screenshotUrl: string | null;
  similarity: number;
  hole: Hole;
  /** Current ball position before the swing. */
  from: CoursePosition;
  /** Distance already travelled from the tee (m). */
  fromDistance: number;
  /** Deterministic-ish randomness source (defaults to Math.random). */
  rng?: () => number;
}

export interface ShotResult {
  shot: Shot;
  /** New ball position after the swing, in course meters. */
  position: CoursePosition;
  /** New total distance travelled from the tee (m). */
  totalDistance: number;
  /** Remaining straight-line distance to the flag (m). */
  remaining: number;
  /** True when the ball is within the hole radius. */
  sunk: boolean;
}

/**
 * Pure shot resolver: turns an AI similarity score into ball movement.
 *
 * - similarity < threshold → miss-swing, ball barely moves.
 * - otherwise distance scales with similarity (eased), capped near the flag.
 * - a -3°..+3° random angle offset introduces lateral error.
 */
export function calculateShot(input: ShotInput): ShotResult {
  const { hole, from, fromDistance, similarity } = input;
  const rng = input.rng ?? Math.random;

  const isMissSwing = similarity < MISS_SWING_THRESHOLD;

  // 벙커 체크 - 벙커에서 치면 거리와 정확도에 페널티
  const bunkerInfo = getBunkerAtPosition(from);
  const inBunker = bunkerInfo.inBunker;

  // Ease the similarity so high scores feel rewarding (quadratic-ish).
  let power = isMissSwing ? 0.04 : Math.pow(similarity, 1.3);

  // 벙커 페널티: 거리 40~60% 감소 (깊이에 따라)
  if (inBunker) {
    const depthPenalty = 0.4 + (bunkerInfo.depth / 2) * 0.2; // 깊이 1m당 10% 추가 감소
    power *= (1 - Math.min(depthPenalty, 0.7)); // 최대 70% 감소
  }

  const remainingBefore = Math.max(0, hole.distance - fromDistance);

  // Never wildly overshoot: cap a single shot at the smaller of MAX and
  // (remaining + a small overshoot allowance).
  const reach = Math.min(MAX_SHOT_DISTANCE, remainingBefore + 25);
  let distanceMoved = Math.round(power * reach);
  if (isMissSwing) distanceMoved = Math.min(distanceMoved, 12);

  // 각도 오차: 기본 -3°..+3°, 벙커에서는 -8°..+8° (방향 제어 어려움)
  const angleRange = inBunker ? 16 : 6;
  const angleOffset = (rng() * angleRange - angleRange / 2);
  const angleRad = (angleOffset * Math.PI) / 180;

  const newDistance = Math.min(hole.distance + 20, fromDistance + distanceMoved);
  const lateral = from.x + distanceMoved * Math.sin(angleRad);

  const position: CoursePosition = { x: lateral, z: newDistance };

  const dx = position.x - hole.flagPosition.x;
  const dz = position.z - hole.flagPosition.z;
  const remaining = Math.round(Math.sqrt(dx * dx + dz * dz));

  return {
    shot: {
      teamId: input.teamId,
      prompt: input.prompt,
      targetN: input.targetN,
      generatedHtml: input.generatedHtml,
      screenshotUrl: input.screenshotUrl,
      similarity,
      distanceMoved,
      angleOffset: Math.round(angleOffset * 10) / 10,
      isMissSwing,
    },
    position,
    totalDistance: newDistance,
    remaining,
    sunk: remaining <= 8,
  };
}
