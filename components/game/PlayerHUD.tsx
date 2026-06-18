'use client';

import type { Hole, Team } from '@/lib/game/types';

/** Top-left player panel: avatar, team name, current stroke, hole + distance. */
export function PlayerHUD({
  team,
  hole,
  remaining,
}: {
  team: Team;
  hole: Hole;
  remaining: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="hud-panel flex items-center gap-3 px-3 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={team.imageUrl ?? ''}
          alt={team.name}
          className="h-11 w-11 rounded-full object-cover ring-2 ring-action/70"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{team.name}</div>
          <div className="text-xs text-white/60">{team.currentStroke}타</div>
        </div>
      </div>

      <div className="hud-panel flex items-center gap-3 px-3 py-2">
        <span className="text-base font-bold text-white">HOLE {hole.id}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/80">
          PAR {hole.par}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[13px] text-white/80">
          🚩 {remaining}m
        </span>
      </div>
    </div>
  );
}
