import type { Hole, Team } from './types';

/** Distance (m) under which the ball is considered sunk. */
export const HOLE_RADIUS = 8;

/** Pixel-art style avatar (inline SVG) used when a team has no uploaded image. */
export function defaultAvatar(seed: string): string {
  const palette = ['#f6c453', '#6ec1e4', '#f47f7f', '#a78bfa', '#5cc46b', '#fb923c'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % palette.length;
  const color = palette[Math.abs(h)];
  const letter = (seed.trim()[0] ?? '?').toUpperCase();
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="${color}"/><text x="40" y="52" font-family="sans-serif" font-size="38" font-weight="700" fill="#ffffff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

/**
 * The game uses a single fixed hole; the "target" changes per stroke (타수),
 * driven by image_{n} files in /public/targets (loaded via /api/targets).
 */
export const HOLE: Hole = {
  id: 1,
  par: 4,
  distance: 395,  // 열대 해변 코스: 395m
  teePosition: { x: 0, z: 0 },
  flagPosition: { x: -15, z: 380 },  // S-커브 끝 그린 위치
  windSpeed: 3.5,  // 해변 바람
  windDirection: 270,  // 서풍 (바다에서 불어옴)
  difficulty: '보통',
};

/** Mock 데이터 제거됨 - 서버에서 실제 플레이어 데이터 사용 */
export function createSeedTeams(): Team[] {
  return [];
}
