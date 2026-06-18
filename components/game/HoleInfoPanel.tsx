'use client';

import type { Hole } from '@/lib/game/types';

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="flex items-center gap-2 text-[13px] text-white/70">
        <span className="text-base">{icon}</span>
        {label}
      </span>
      <span className="text-[13px] font-semibold text-white">{value}</span>
    </div>
  );
}

export function HoleInfoPanel({ hole, remaining }: { hole: Hole; remaining?: number }) {
  return (
    <div className="hud-panel w-56 px-4 py-3">
      <div className="mb-2 flex items-baseline gap-2 border-b border-white/10 pb-2">
        <span className="text-lg font-bold text-white">HOLE {hole.id}</span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">
          PAR {hole.par}
        </span>
      </div>
      <Row icon="🚩" label="거리" value={`${remaining ?? hole.distance}m`} />
      <Row icon="🌬️" label="바람" value={`${hole.windSpeed.toFixed(1)}m/s`} />
      <Row icon="📊" label="난이도" value={hole.difficulty} />
    </div>
  );
}
