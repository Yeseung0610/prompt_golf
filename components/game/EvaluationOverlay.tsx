'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TRACK_META, type ChallengeHole, type EvaluationResult } from '@/lib/content/types';

interface EvaluationOverlayProps {
  challenge: ChallengeHole;
  result: EvaluationResult;
  onComplete: () => void;
}

const DISPLAY_MS = 8000;

/** 루브릭 평가 결과 오버레이 — 점수·항목별 breakdown·강점/감점을 보여준 뒤 콜백. */
export function EvaluationOverlay({ challenge, result, onComplete }: EvaluationOverlayProps) {
  const percent = Math.round(result.score * 100);
  const meta = TRACK_META[challenge.track];

  // 마운트 시 정확히 한 번만 onComplete 예약 (CompareOverlay와 동일한 이유)
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const getColor = (p: number) => {
    if (p >= 80) return '#22c55e';
    if (p >= 60) return '#eab308';
    if (p >= 40) return '#f97316';
    return '#ef4444';
  };
  const color = getColor(percent);

  const getMessage = () => {
    if (percent >= 90) return '완벽해요! 🎯';
    if (percent >= 80) return '훌륭해요! 👏';
    if (percent >= 60) return '좋아요! 👍';
    if (percent >= 40) return '아쉬워요 😅';
    return '다시 도전! 💪';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="flex w-full max-w-2xl flex-col items-center gap-5 px-6"
      >
        {/* 헤더: 트랙 + 챌린지 제목 */}
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-sm font-semibold text-white/80">{challenge.title}</span>
        </div>

        {/* 종합 점수 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-white/60">평가 점수</span>
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="text-6xl font-bold"
              style={{ color }}
            >
              {percent}%
            </motion.span>
          </div>
          <span className="text-lg font-semibold text-white">{getMessage()}</span>
        </motion.div>

        {/* 총평 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-xl text-center text-sm leading-relaxed text-white/75"
        >
          {result.summary}
        </motion.p>

        {/* 항목별 breakdown 바 */}
        <div className="w-full max-w-md space-y-2">
          {challenge.rubric.map((dim, i) => {
            const v = result.breakdown[dim.key] ?? 0;
            const p = Math.round(v * 100);
            return (
              <motion.div
                key={dim.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <span className="w-32 shrink-0 truncate text-right text-xs text-white/65">
                  {dim.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ delay: 0.7 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: getColor(p) }}
                  />
                </div>
                <span className="w-9 shrink-0 text-xs tabular-nums text-white/60">{p}%</span>
              </motion.div>
            );
          })}
        </div>

        {/* 강점 / 감점 요인 */}
        {(result.strengths.length > 0 || result.penalties.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {result.strengths.length > 0 && (
              <div className="rounded-xl bg-green-500/10 p-3 ring-1 ring-green-500/25">
                <span className="text-xs font-semibold text-green-300">👍 잘한 점</span>
                <ul className="mt-1.5 space-y-1">
                  {result.strengths.map((s) => (
                    <li key={s} className="text-xs leading-snug text-white/75">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.penalties.length > 0 && (
              <div className="rounded-xl bg-red-500/10 p-3 ring-1 ring-red-500/25">
                <span className="text-xs font-semibold text-red-300">⚠️ 감점 요인</span>
                <ul className="mt-1.5 space-y-1">
                  {result.penalties.map((p) => (
                    <li key={p} className="text-xs leading-snug text-white/75">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* 프로그레스 바 (카운트다운) */}
        <motion.div className="mt-1 h-1.5 w-80 overflow-hidden rounded-full bg-white/20">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: DISPLAY_MS / 1000, ease: 'linear' }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </motion.div>
        <span className="text-xs text-white/40">공이 날아갑니다...</span>
      </motion.div>
    </motion.div>
  );
}
