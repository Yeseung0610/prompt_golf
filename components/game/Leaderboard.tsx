'use client';

import { motion } from 'framer-motion';
import type { Team } from '@/lib/game/types';

function formatScore(score: number): string {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({
  teams,
  myTeamId,
  title = '실시간 순위',
  compact = false,
}: {
  teams: Team[];
  myTeamId: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className="hud-panel w-60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-sm font-semibold text-white">{title}</span>
        {!compact && <span className="hud-label">팀명 · 점수</span>}
      </div>
      <ul className="thin-scroll max-h-[280px] divide-y divide-white/5 overflow-y-auto">
        {teams.map((team, i) => {
          const mine = team.id === myTeamId;
          return (
            <motion.li
              key={team.id}
              layout
              className={`flex items-center gap-2.5 px-3 py-2 ${
                mine ? 'bg-action/15' : ''
              }`}
            >
              <span className="w-5 text-center text-sm">
                {MEDALS[i] ?? <span className="text-white/50">{i + 1}</span>}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={team.imageUrl ?? ''}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/20"
              />
              <span
                className={`flex-1 truncate text-[13px] ${
                  mine ? 'font-semibold text-action' : 'text-white/90'
                }`}
              >
                {team.name}
              </span>
              <span
                className={`tabular-nums text-sm font-semibold ${
                  team.score < 0 ? 'text-red-400' : team.score > 0 ? 'text-sky-300' : 'text-white/70'
                }`}
              >
                {formatScore(team.score)}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
