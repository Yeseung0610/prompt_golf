'use client';

import type { Hole, Team } from '@/lib/game/types';

/** Top-down SVG minimap of the current hole with each team's ball plotted. */
export function HoleMiniMap({
  hole,
  teams,
  myTeamId,
}: {
  hole: Hole;
  teams: Team[];
  myTeamId: string;
}) {
  const W = 168;
  const H = 200;
  const padY = 22;

  // Map course distance (0..hole.distance) to vertical (bottom→top) and
  // lateral meters to horizontal.
  const toXY = (xMeters: number, dist: number) => {
    const t = Math.max(0, Math.min(1, dist / hole.distance));
    const y = H - padY - t * (H - padY * 2);
    const x = W / 2 + Math.max(-1, Math.min(1, xMeters / 40)) * (W / 2 - 26);
    return { x, y };
  };

  const tee = toXY(0, 0);
  const flag = toXY(hole.flagPosition.x, hole.distance);

  return (
    <div className="hud-panel w-[200px] overflow-hidden">
      <div className="border-b border-white/10 px-3 py-2 text-sm font-semibold text-white">
        홀 정보
      </div>
      <div className="p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
          <defs>
            <linearGradient id="mini-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f8a3f" />
              <stop offset="1" stopColor="#2c6b30" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={W} height={H} rx="12" fill="url(#mini-grass)" />

          {/* fairway corridor */}
          <path
            d={`M${tee.x} ${tee.y} C ${tee.x - 18} ${H * 0.6}, ${flag.x + 20} ${H * 0.4}, ${flag.x} ${flag.y}`}
            stroke="#5cc46b"
            strokeWidth="26"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />

          {/* water + bunker hints */}
          <ellipse cx={W * 0.2} cy={H * 0.5} rx="16" ry="22" fill="#2f7fb0" opacity="0.85" />
          <circle cx={flag.x + 16} cy={flag.y + 10} r="7" fill="#e9d39a" />
          <circle cx={flag.x - 16} cy={flag.y + 6} r="6" fill="#e9d39a" />

          {/* green */}
          <circle cx={flag.x} cy={flag.y} r="15" fill="#6fcf63" />

          {/* flag */}
          <line
            x1={flag.x}
            y1={flag.y}
            x2={flag.x}
            y2={flag.y - 16}
            stroke="#e8e8e8"
            strokeWidth="2"
          />
          <path
            d={`M${flag.x} ${flag.y - 16} l9 3 -9 3 z`}
            fill="#e23b3b"
          />

          {/* tee marker */}
          <rect x={tee.x - 6} y={tee.y - 3} width="12" height="6" rx="2" fill="#ffffff" opacity="0.8" />

          {/* team balls */}
          {teams.map((team) => {
            const { x, y } = toXY(team.ballPosition.x, team.totalDistance);
            const mine = team.id === myTeamId;
            return (
              <g key={team.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={mine ? 5 : 4}
                  fill={mine ? '#22b14c' : '#ffffff'}
                  stroke={mine ? '#ffffff' : '#1c1c1c'}
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
