'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useHydrated } from '@/store/useHydrated';
import { PlayerHUD } from '@/components/game/PlayerHUD';
import { Leaderboard } from '@/components/game/Leaderboard';
import { HoleMiniMap } from '@/components/game/HoleMiniMap';
import { PromptSwingPanel } from '@/components/game/PromptSwingPanel';
import { captureHtml } from '@/lib/capture/captureHtml';
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
  const hole = useGameStore((s) => s.hole);
  const leaderboard = useGameStore((s) => s.leaderboard());
  const applyShot = useGameStore((s) => s.applyShot);
  const shotTick = useGameStore((s) => s.shotTick);
  const ensureSeeded = useGameStore((s) => s.ensureSeeded);
  const loadTargets = useGameStore((s) => s.loadTargets);
  const targetsLoaded = useGameStore((s) => s.targetsLoaded);
  const currentTarget = useGameStore((s) => s.currentTarget());
  const lastShot = useGameStore((s) => s.lastShot);

  const [swinging, setSwinging] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [feedback, setFeedback] = useState<ShotFeedback | null>(null);

  useEffect(() => {
    ensureSeeded();
    loadTargets();
  }, [ensureSeeded, loadTargets]);

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
    if (!currentTarget) return;
    setSwinging(true);
    setFeedback(null);

    let similarity = 0.5;
    let html: string | null = null;
    let screenshotUrl: string | null = null;

    try {
      // 1) 프롬프트 → HTML 생성 (Gemini)
      setStatusText('웹페이지 생성 중…');
      try {
        const res = await fetch('/api/generate-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) html = (await res.json()).html ?? null;
      } catch {
        /* fall through with html=null */
      }

      // 2) HTML 렌더링 → 캡처 (iframe + html2canvas)
      if (html) {
        setStatusText('화면 캡처 중…');
        try {
          screenshotUrl = await captureHtml(html);
        } catch {
          screenshotUrl = null;
        }
      }

      // 3) 캡처 ↔ 목표 이미지 유사도 비교 (Gemini 비전)
      if (screenshotUrl) {
        setStatusText('유사도 비교 중…');
        try {
          const res = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenshot: screenshotUrl, targetFile: currentTarget.file }),
          });
          if (res.ok) similarity = (await res.json()).similarity ?? similarity;
        } catch {
          /* keep fallback similarity */
        }
      }

      // 4) 유사도 → 공 이동
      const shot = applyShot({
        similarity,
        prompt,
        targetN: currentTarget.n,
        generatedHtml: html,
        screenshotUrl,
      });
      const sunk = useGameStore.getState().myTeam()?.finished ?? false;
      setFeedback({ shot, sunk });
    } finally {
      setSwinging(false);
      setStatusText('');
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
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

      {/* No targets warning */}
      {targetsLoaded && !currentTarget && !myTeam.finished && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="hud-panel px-5 py-3 text-center text-sm text-white/80">
            <b>public/targets</b> 폴더에 <code>image_1.png</code> 부터 넣어주세요.
          </div>
        </div>
      )}

      {/* Shot feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute left-1/2 top-24 -translate-x-1/2"
            onAnimationComplete={() => {
              window.setTimeout(() => setFeedback(null), 2800);
            }}
          >
            <div className="hud-panel px-6 py-3 text-center">
              {feedback.sunk ? (
                <div className="text-lg font-bold text-action">🏆 홀 아웃!</div>
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
              <button onClick={() => router.push('/')} className="action-btn mt-5 w-full py-3">
                대시보드로 돌아가기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: unified prompt + swing panel */}
      <div className="absolute bottom-5 left-1/2 w-full max-w-4xl -translate-x-1/2 px-5">
        <PromptSwingPanel
          target={currentTarget}
          swinging={swinging}
          statusText={statusText}
          lastScreenshot={lastShot?.screenshotUrl ?? null}
          onSwing={handleSwing}
        />
      </div>
    </main>
  );
}
