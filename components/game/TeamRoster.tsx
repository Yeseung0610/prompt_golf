'use client';

import type { Team } from '@/lib/game/types';

/** Bottom-left "우리 팀" panel listing members' distance + stroke. */
export function TeamRoster({ team }: { team: Team }) {
  // For the MVP the player's team is shown as a single roster entry per shot
  // progress; we synthesize a short member list from recent state for flavour.
  const members = [
    { name: team.name, dist: Math.round(team.totalDistance), stroke: team.currentStroke },
  ];

  return (
    <div className="hud-panel w-56 px-4 py-3">
      <div className="mb-2 border-b border-white/10 pb-2 text-sm font-semibold text-white">
        우리 팀 <span className="text-white/55">({team.name})</span>
      </div>
      <ul className="space-y-1.5">
        {members.map((m, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team.imageUrl ?? ''}
              alt=""
              className="h-5 w-5 rounded-full object-cover ring-1 ring-white/20"
            />
            <span className="flex-1 truncate text-white/90">{m.name}</span>
            <span className="tabular-nums text-white/60">{m.dist}m</span>
            <span className="tabular-nums text-white/45">{m.stroke}타</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
