/** Shared domain models for the Prompt Golf game. */

/** A position on the course in world units (meters). z grows toward the hole. */
export interface CoursePosition {
  x: number;
  z: number;
}

/** A target screen the player must recreate on a given stroke. */
export interface Target {
  /** Stroke number this target belongs to (1-based). */
  n: number;
  /** Filename under /public/targets, e.g. "image_1.png". */
  file: string;
  /** Public URL, e.g. "/targets/image_1.png". */
  url: string;
}

export interface Team {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Strokes relative to par across played holes (lower is better). */
  score: number;
  /** Strokes taken on the current hole. */
  currentStroke: number;
  /** Ball position on the current hole, in course meters. */
  ballPosition: CoursePosition;
  /** Total distance (m) the ball has progressed from the tee toward the hole. */
  totalDistance: number;
  isCurrentTurn: boolean;
  /** Marks the hole as completed. */
  finished?: boolean;
}

export interface Hole {
  id: number;
  par: number;
  /** Total tee-to-hole distance in meters. */
  distance: number;
  flagPosition: CoursePosition;
  teePosition: CoursePosition;
  windSpeed: number;
  windDirection: number;
  difficulty: string;
}

export interface Shot {
  teamId: string;
  prompt: string;
  /** Stroke number / target index this shot was played against. */
  targetN: number;
  /** HTML the model generated for the prompt. */
  generatedHtml: string | null;
  /** Captured screenshot of the rendered HTML (data URL). */
  screenshotUrl: string | null;
  similarity: number;
  distanceMoved: number;
  angleOffset: number;
  isMissSwing: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Physics & Hazard System Types
// ─────────────────────────────────────────────────────────────────────────────

/** Type of hazard on the course */
export type HazardType = 'water' | 'bunker' | 'ob' | 'tree';

/** Where the ball landed */
export type LandingZone = 'fairway' | 'rough' | 'bunker' | 'green' | 'water' | 'ob' | 'beach';

/** A hazard zone definition */
export interface HazardZone {
  id: string;
  type: HazardType;
  position: [number, number, number];
  size: [number, number, number];
  /** Penalty strokes (0 for bunker, 1 for water/OB) */
  penalty: number;
  /** Whether to reset ball to last safe position */
  resetToLastPosition: boolean;
}

/** Hill definition for terrain */
export interface HillDefinition {
  position: [number, number, number];
  radius: number;
  height: number;
}

/** Event fired when ball enters a hazard */
export interface PenaltyEvent {
  type: HazardType;
  strokes: number;
  resetPosition: CoursePosition;
  message: string;
}

/** Complete course layout data */
export interface CourseLayout {
  hazards: HazardZone[];
  hills: HillDefinition[];
}
