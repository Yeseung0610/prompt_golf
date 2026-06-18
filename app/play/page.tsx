'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useHydrated } from '@/store/useHydrated';
import { PlayerHUD } from '@/components/game/PlayerHUD';
import { Leaderboard } from '@/components/game/Leaderboard';
import { HoleMiniMap } from '@/components/game/HoleMiniMap';
import { PromptSwingPanel } from '@/components/game/PromptSwingPanel';
import type { Shot } from '@/lib/game/types';

const GolfCourseScene = dynamic(
  () => import('@/components/game/GolfCourseScene').then((m) => m.GolfCourseScene),
  { ssr: false },
);

interface ShotFeedback {
  shot: Shot;
  sunk: boolean;
}

export default function PlayPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const teams = useGameStore((s) => s.teams);
  const myTeamId = useGameStore((s) => s.myTeamId);
  const myTeam = useGameStore((s) => s.myTeam());
  const hole = useGameStore((s) => s.currentHole());
  const leaderboard = useGameStore((s) => s.leaderboard());
  const applyShot = useGameStore((s) => s.applyShot);
  const shotTick = useGameStore((s) => s.shotTick);

  const [swinging, setSwinging] = useState(false);
  const [feedback, setFeedback] = useState<ShotFeedback | null>(null);

  if (!hydrated || !myTeam) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#0b1410] text-white/70">
        코스를 준비하는 중…
      </main>
    );
  }

  const progress = hole.distance > 0 ? myTeam.totalDistance / hole.distance : 0;
  const remaining = Math.max(0, Math.round(hole.distance - myTeam.totalDistance));

  const handleSwing = async (prompt: string) => {
    setSwinging(true);
    setFeedback(null);
    try {
      let similarity = 0.5;
      let generatedImageUrl: string | null = null;

      try {
        const res = await fetch('/api/generate-shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            targetImageUrl: hole.targetImageUrl,
            targetDescription: hole.targetDescription,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          similarity = data.similarity ?? similarity;
          generatedImageUrl = data.generatedImageUrl ?? null;
        }
      } catch {
        // network failure → fall back to a neutral similarity so play continues
      }

      const shot = applyShot(similarity, generatedImageUrl, prompt);
      const sunk = useGameStore.getState().myTeam()?.finished ?? false;
      setFeedback({ shot, sunk });
    } finally {
      setSwinging(false);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
      {/* 3D course (player perspective) */}
      <div className="absolute inset-0">
        <GolfCourseScene progress={progress} lateralX={myTeam.ballPosition.x} shotTick={shotTick} />
      </div>

      {/* Top-left: player + hole info */}
      <div className="absolute left-5 top-5 w-56">
        <PlayerHUD team={myTeam} hole={hole} remaining={remaining} />
      </div>

      {/* Top-right: leaderboard */}
      <div className="absolute right-5 top-5">
        <Leaderboard teams={leaderboard} myTeamId={myTeamId} />
      </div>

      {/* Right side: minimap */}
      <div className="absolute right-5 top-[300px] hidden lg:block">
        <HoleMiniMap hole={hole} teams={teams} myTeamId={myTeamId} />
      </div>

      {/* Back to dashboard */}
      <button
        onClick={() => router.push('/')}
        className="icon-rail-btn absolute left-5 top-[150px]"
        title="대시보드로"
      >
        ←
      </button>

      {/* Shot feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute left-1/2 top-24 -translate-x-1/2"
            onAnimationComplete={() => {
              window.setTimeout(() => setFeedback(null), 2600);
            }}
          >
            <div className="hud-panel px-6 py-3 text-center">
              {feedback.sunk ? (
                <div className="text-lg font-bold text-action">🏆 홀인! 성공</div>
              ) : feedback.shot.isMissSwing ? (
                <div className="text-lg font-bold text-red-400">💨 헛스윙!</div>
              ) : (
                <div className="text-lg font-bold text-white">
                  나이스 샷! <span className="text-action">{feedback.shot.distanceMoved}m</span> 전진
                </div>
              )}
              <div className="mt-1 text-xs text-white/60">
                유사도 {(feedback.shot.similarity * 100).toFixed(0)}% · 각도 오차{' '}
                {feedback.shot.angleOffset > 0 ? '+' : ''}
                {feedback.shot.angleOffset}°
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay */}
      <AnimatePresence>
        {myTeam.finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm"
          >
            <div className="hud-panel max-w-sm px-8 py-7 text-center">
              <div className="text-4xl">🏌️‍♂️⛳</div>
              <h2 className="mt-3 text-2xl font-bold text-white">홀 아웃!</h2>
              <p className="mt-1 text-sm text-white/70">
                {hole.par}파 홀을 <b className="text-action">{myTeam.currentStroke}타</b>에 마쳤어요.
              </p>
              <button
                onClick={() => router.push('/')}
                className="action-btn mt-5 w-full py-3"
              >
                대시보드로 돌아가기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: unified prompt + swing panel */}
      <div className="absolute bottom-5 left-1/2 w-full max-w-3xl -translate-x-1/2 px-5">
        <PromptSwingPanel hole={hole} swinging={swinging} onSwing={handleSwing} />
      </div>
    </main>
  );
}
