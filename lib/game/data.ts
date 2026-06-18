import type { Hole, Team } from './types';
import { TARGET_IMAGES, TARGET_DESCRIPTIONS } from './targetImages';

/** Distance (m) under which the ball is considered sunk. */
export const HOLE_RADIUS = 8;

/** Pixel-art style avatar (inline SVG) used when a team has no uploaded image. */
export function defaultAvatar(seed: string): string {
  const palette = ['#f6c453', '#6ec1e4', '#f47f7f', '#a78bfa', '#5cc46b', '#fb923c'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % palette.length;
  const color = palette[h];
  const letter = (seed.trim()[0] ?? '?').toUpperCase();
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="${color}"/><text x="40" y="52" font-family="sans-serif" font-size="38" font-weight="700" fill="#ffffff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

export const HOLES: Hole[] = [
  {
    id: 1,
    par: 4,
    distance: 320,
    targetImageUrl: TARGET_IMAGES[0],
    targetDescription: TARGET_DESCRIPTIONS[0],
    teePosition: { x: 0, z: 0 },
    flagPosition: { x: 0, z: 320 },
    windSpeed: 2.3,
    windDirection: 45,
    difficulty: '보통',
  },
  {
    id: 2,
    par: 3,
    distance: 180,
    targetImageUrl: TARGET_IMAGES[1],
    targetDescription: TARGET_DESCRIPTIONS[1],
    teePosition: { x: 0, z: 0 },
    flagPosition: { x: 10, z: 180 },
    windSpeed: 1.4,
    windDirection: 90,
    difficulty: '쉬움',
  },
  {
    id: 3,
    par: 5,
    distance: 480,
    targetImageUrl: TARGET_IMAGES[2],
    targetDescription: TARGET_DESCRIPTIONS[2],
    teePosition: { x: 0, z: 0 },
    flagPosition: { x: -12, z: 480 },
    windSpeed: 3.1,
    windDirection: 200,
    difficulty: '어려움',
  },
];

/** Seed teams that appear on the dashboard leaderboard / field. */
export function createSeedTeams(): Team[] {
  const seeds: Array<{ id: string; name: string; score: number; dist: number; x: number }> = [
    { id: 'slice', name: '슬라이스 마스터즈', score: -8, dist: 210, x: -14 },
    { id: 'long', name: '롱샷킹즈', score: -6, dist: 145, x: 8 },
    { id: 'eagle', name: '이글이글', score: -5, dist: 95, x: -6 },
    { id: 'putt', name: '퍼팅의신', score: -3, dist: 30, x: 4 },
  ];
  return seeds.map((s) => ({
    id: s.id,
    name: s.name,
    imageUrl: defaultAvatar(s.name),
    score: s.score,
    currentStroke: Math.max(1, Math.round((320 - (320 - s.dist)) / 90)),
    ballPosition: { x: s.x, z: s.dist },
    totalDistance: s.dist,
    isCurrentTurn: false,
  }));
}
