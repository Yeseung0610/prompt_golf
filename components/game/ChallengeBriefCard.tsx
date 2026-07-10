'use client';

import { TRACK_META, type ChallengeHole } from '@/lib/content/types';

interface ChallengeBriefCardProps {
  challenge: ChallengeHole;
  /** 확대 보기 여부 (패널이 커지면 루브릭까지 전부 보여준다). */
  expanded: boolean;
}

/**
 * 루브릭 트랙(backend/sre 등) 홀에서 목표 이미지 대신 표시하는 브리프 카드.
 * self-contained 원칙에 따라 브리프·기대 산출물·제약·평가 기준을 모두 보여준다.
 */
export function ChallengeBriefCard({ challenge, expanded }: ChallengeBriefCardProps) {
  const meta = TRACK_META[challenge.track];

  return (
    <div className="thin-scroll flex h-full w-full flex-col gap-2.5 overflow-y-auto rounded-lg bg-black/40 p-3 ring-1 ring-white/15">
      {/* 트랙 배지 + 제목 */}
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}>
          {meta.icon} {meta.label}
        </span>
        <span className="truncate text-sm font-bold text-white">{challenge.title}</span>
      </div>

      {/* 브리프 */}
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/85">
        {challenge.targetBrief}
      </p>

      {/* 요구사항/제약 */}
      <div>
        <span className="hud-label">요구사항</span>
        <ul className="mt-1 space-y-0.5">
          {challenge.constraints.map((c) => (
            <li key={c} className="flex gap-1.5 text-xs text-white/75">
              <span className="text-action">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 기대 산출물 */}
      <div>
        <span className="hud-label">기대 산출물</span>
        <p className="mt-1 text-xs text-white/75">{challenge.expectedOutputType}</p>
      </div>

      {/* 평가 기준 — 명시적 루브릭 (확대 시 설명까지) */}
      <div>
        <span className="hud-label">평가 기준</span>
        <ul className="mt-1 space-y-1">
          {challenge.rubric.map((dim) => (
            <li key={dim.key} className="text-xs text-white/75">
              <div className="flex items-center justify-between gap-2">
                <span>{dim.label}</span>
                <span className="shrink-0 text-white/45">{dim.weight}%</span>
              </div>
              {expanded && (
                <p className="mt-0.5 text-[11px] leading-snug text-white/45">{dim.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
