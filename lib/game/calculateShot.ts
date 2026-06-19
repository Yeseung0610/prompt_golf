import type { CoursePosition, Hole, Shot } from './types';

/** Similarity below this is treated as a miss-swing (헛스윙). */
export const MISS_SWING_THRESHOLD = 0.3;

/** Maximum distance (m) a perfect shot can travel in one swing. */
const MAX_SHOT_DISTANCE = 160;

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

  // Ease the similarity so high scores feel rewarding (quadratic-ish).
  const power = isMissSwing ? 0.04 : Math.pow(similarity, 1.3);

  const remainingBefore = Math.max(0, hole.distance - fromDistance);

  // Never wildly overshoot: cap a single shot at the smaller of MAX and
  // (remaining + a small overshoot allowance).
  const reach = Math.min(MAX_SHOT_DISTANCE, remainingBefore + 25);
  let distanceMoved = Math.round(power * reach);
  if (isMissSwing) distanceMoved = Math.min(distanceMoved, 12);

  // -3°..+3° lateral error.
  const angleOffset = (rng() * 6 - 3);
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
