/** Shared domain models for the Prompt Golf game. */

/** A position on the course in world units (meters). z grows toward the hole. */
export interface CoursePosition {
  x: number;
  z: number;
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
  /** Marks the hole as completed (ball sunk). */
  finished?: boolean;
}

export interface Hole {
  id: number;
  par: number;
  /** Total tee-to-hole distance in meters. */
  distance: number;
  targetImageUrl: string;
  /** Short description of the scene the player must recreate. */
  targetDescription: string;
  flagPosition: CoursePosition;
  teePosition: CoursePosition;
  windSpeed: number;
  windDirection: number;
  difficulty: string;
}

export interface Shot {
  teamId: string;
  prompt: string;
  generatedImageUrl: string | null;
  similarity: number;
  distanceMoved: number;
  angleOffset: number;
  isMissSwing: boolean;
}
