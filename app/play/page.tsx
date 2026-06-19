'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useMultiplayerStore } from '@/store/multiplayerStore';
import { useSocketStore } from '@/lib/socket/useSocket';
import { useHydrated } from '@/store/useHydrated';
import { PlayerHUD } from '@/components/game/PlayerHUD';
import { Leaderboard } from '@/components/game/Leaderboard';
import { HoleMiniMap } from '@/components/game/HoleMiniMap';
import { PromptSwingPanel } from '@/components/game/PromptSwingPanel';
import { CompareOverlay } from '@/components/game/CompareOverlay';
import { PenaltyOverlay } from '@/components/game/PenaltyOverlay';
import { captureHtml } from '@/lib/capture/captureHtml';
import { HOLE_1_LAYOUT } from '@/lib/game/courseLayout';
import type { Shot, PenaltyEvent, HazardType, Team } from '@/lib/game/types';

const GolfCourseScene = dynamic(
  () => import('@/components/game/GolfCourseScene').then((m) => m.GolfCourseScene),
  { ssr: false },
);

interface ShotFeedback {
  shot: Shot;
  sunk: boolean;
}

interface CompareData {
  targetUrl: string;
  generatedUrl: string;
  similarity: number;
  prompt: string;
  targetN: number;
  generatedHtml: string | null;
}

type GamePhase = 'idle' | 'generating' | 'comparing' | 'flying' | 'feedback' | 'penalty';

const HAZARD_MESSAGES: Record<HazardType, string> = {
  water: '물에 빠졌습니다!',
  bunker: '벙커에 빠졌습니다!',
  ob: 'OB 구역입니다!',
  tree: '나무에 맞았습니다!',
};

export default function PlayPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  // ─────────────────────────────────────────────────────────────────────────
  // Socket & 멀티플레이어 상태
  // ─────────────────────────────────────────────────────────────────────────
  const connect = useSocketStore((s) => s.connect);
  const connected = useSocketStore((s) => s.connected);
  const room = useSocketStore((s) => s.room);
  const myPlayerId = useSocketStore((s) => s.myPlayerId);
  const createRoom = useSocketStore((s) => s.createRoom);
  const startGame = useSocketStore((s) => s.startGame);
  const submitShot = useSocketStore((s) => s.submitShot);
  const leaveRoom = useSocketStore((s) => s.leaveRoom);

  // 멀티플레이어 스토어
  const mpRoom = useMultiplayerStore((s) => s.room);
  const mpPlayers = useMultiplayerStore((s) => s.players);
  const mpMyPlayer = useMultiplayerStore((s) => s.myPlayer);
  const mpHole = useMultiplayerStore((s) => s.hole);
  const mpTargets = useMultiplayerStore((s) => s.targets);
  const mpTargetsLoaded = useMultiplayerStore((s) => s.targetsLoaded);
  const mpLastShot = useMultiplayerStore((s) => s.lastShot);
  const mpShotTick = useMultiplayerStore((s) => s.shotTick);
  const mpLastPenalty = useMultiplayerStore((s) => s.lastPenalty);
  const mpLastSafePosition = useMultiplayerStore((s) => s.lastSafePosition);
  const mpApplyMyShot = useMultiplayerStore((s) => s.applyMyShot);
  const mpApplyPenalty = useMultiplayerStore((s) => s.applyPenalty);
  const mpClearPenalty = useMultiplayerStore((s) => s.clearPenalty);
  const mpSetPlayerFlying = useMultiplayerStore((s) => s.setPlayerFlying);
  const mpSetTargets = useMultiplayerStore((s) => s.setTargets);
  const mpSetRoom = useMultiplayerStore((s) => s.setRoom);
  const mpSetMyPlayerId = useMultiplayerStore((s) => s.setMyPlayerId);

  // 로컬 게임 상태 (타겟 로딩용)
  const loadTargets = useGameStore((s) => s.loadTargets);
  const localTargets = useGameStore((s) => s.targets);
  const profileReady = useGameStore((s) => s.profileReady);
  const myTeamName = useGameStore((s) => s.myTeam)?.name ?? '플레이어';

  // ─────────────────────────────────────────────────────────────────────────
  // UI 상태
  // ─────────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [statusText, setStatusText] = useState('');
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [feedback, setFeedback] = useState<ShotFeedback | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRoomCode, setShowRoomCode] = useState(false);

  const prevBallPosition = useRef({ x: 0, z: 0, totalDistance: 0 });
  const hasInitialized = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // 초기화: 소켓 연결 + 방 확인/생성 + 타겟 로드
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  // 타겟 로드 완료 시 멀티플레이어 스토어에 동기화
  useEffect(() => {
    if (localTargets.length > 0) {
      mpSetTargets(localTargets);
    }
  }, [localTargets, mpSetTargets]);

  // 방이 없으면 자동 생성
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!connected) return;
    if (room) {
      // 이미 방이 있음
      hasInitialized.current = true;
      setIsInitializing(false);
      return;
    }

    // 방 자동 생성
    const autoCreateRoom = async () => {
      const newRoom = await createRoom(myTeamName);
      if (newRoom) {
        mpSetRoom(newRoom);
        mpSetMyPlayerId(useSocketStore.getState().myPlayerId);
        // 자동으로 게임 시작
        await startGame();
      }
      hasInitialized.current = true;
      setIsInitializing(false);
    };

    autoCreateRoom();
  }, [connected, room, createRoom, myTeamName, mpSetRoom, mpSetMyPlayerId, startGame]);

  // room이 업데이트되면 멀티플레이어 스토어에도 동기화
  useEffect(() => {
    if (room) {
      mpSetRoom(room);
    }
  }, [room, mpSetRoom]);

  // ─────────────────────────────────────────────────────────────────────────
  // 현재 플레이어 데이터
  // ─────────────────────────────────────────────────────────────────────────
  const currentPlayer = mpMyPlayer();
  const currentHole = mpHole;
  const currentTargets = mpTargets;
  const currentTargetsLoaded = mpTargetsLoaded || localTargets.length > 0;
  const currentTarget = currentTargets[currentPlayer?.currentStroke ?? 0] ?? null;

  // Team 형태로 변환
  const myTeam: Team | undefined = currentPlayer
    ? {
        id: currentPlayer.id,
        name: currentPlayer.name,
        imageUrl: currentPlayer.avatarUrl,
        score: currentPlayer.score,
        currentStroke: currentPlayer.currentStroke,
        ballPosition: currentPlayer.ballPosition,
        totalDistance: currentPlayer.totalDistance,
        isCurrentTurn: true,
        finished: currentPlayer.finished,
      }
    : undefined;

  const leaderboard: Team[] = mpPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.avatarUrl,
    score: p.score,
    currentStroke: p.currentStroke,
    ballPosition: p.ballPosition,
    totalDistance: p.totalDistance,
    isCurrentTurn: false,
    finished: p.finished,
  })).sort((a, b) => a.score - b.score);

  // ─────────────────────────────────────────────────────────────────────────
  // 이벤트 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleHazardEnter = useCallback(
    (hazardId: string) => {
      const hazard = HOLE_1_LAYOUT.hazards.find((h) => h.id === hazardId);
      if (!hazard || hazard.type === 'bunker') return;

      const penalty: PenaltyEvent = {
        type: hazard.type,
        strokes: hazard.penalty,
        resetPosition: hazard.resetToLastPosition
          ? mpLastSafePosition
          : { x: 0, z: 0 },
        message: HAZARD_MESSAGES[hazard.type],
      };

      setPhase('penalty');
      mpApplyPenalty(penalty);
    },
    [mpApplyPenalty, mpLastSafePosition]
  );

  const handlePenaltyDismiss = useCallback(() => {
    mpClearPenalty();
    setPhase('idle');
  }, [mpClearPenalty]);

  const handleFlightComplete = useCallback(() => {
    setPhase('feedback');

    if (myPlayerId) {
      mpSetPlayerFlying(myPlayerId, false);
    }

    setTimeout(() => {
      setPhase('idle');
      setFeedback(null);
    }, 3000);
  }, [myPlayerId, mpSetPlayerFlying]);

  const handleLeaveRoom = useCallback(async () => {
    await leaveRoom();
    router.push('/');
  }, [leaveRoom, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // 로딩 상태
  // ─────────────────────────────────────────────────────────────────────────
  if (!hydrated || isInitializing || !myTeam) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center bg-[#0b1410] text-white/70">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-action" />
        <p>코스를 준비하는 중…</p>
        {!connected && <p className="mt-2 text-sm text-white/40">서버 연결 중...</p>}
      </main>
    );
  }

  const progress = currentHole.distance > 0 ? myTeam.totalDistance / currentHole.distance : 0;
  const remaining = Math.max(0, Math.round(currentHole.distance - myTeam.totalDistance));

  // ─────────────────────────────────────────────────────────────────────────
  // 스윙 처리
  // ─────────────────────────────────────────────────────────────────────────
  const handleSwing = async (prompt: string) => {
    if (!currentTarget) return;
    setPhase('generating');
    setFeedback(null);
    setCompareData(null);

    prevBallPosition.current = {
      x: myTeam.ballPosition.x,
      z: myTeam.ballPosition.z,
      totalDistance: myTeam.totalDistance,
    };

    let similarity = 0.5;
    let html: string | null = null;
    let screenshotUrl: string | null = null;

    try {
      setStatusText('웹페이지 생성 중…');
      try {
        const res = await fetch('/api/generate-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) html = (await res.json()).html ?? null;
      } catch { /* continue */ }

      if (html) {
        setStatusText('화면 캡처 중…');
        try {
          screenshotUrl = await captureHtml(html);
        } catch { /* continue */ }
      }

      if (screenshotUrl) {
        setStatusText('유사도 비교 중…');
        try {
          const res = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenshot: screenshotUrl, targetFile: currentTarget.file }),
          });
          if (res.ok) similarity = (await res.json()).similarity ?? similarity;
        } catch { /* continue */ }
      }

      if (screenshotUrl) {
        setCompareData({
          targetUrl: currentTarget.url,
          generatedUrl: screenshotUrl,
          similarity,
          prompt,
          targetN: currentTarget.n,
          generatedHtml: html,
        });
        setPhase('comparing');
        setStatusText('');
      } else {
        handleApplyShot(similarity, prompt, currentTarget.n, html, null);
      }
    } catch {
      setPhase('idle');
      setStatusText('');
    }
  };

  const handleCompareComplete = () => {
    if (!compareData) return;
    setPhase('flying');
    handleApplyShot(
      compareData.similarity,
      compareData.prompt,
      compareData.targetN,
      compareData.generatedHtml,
      compareData.generatedUrl,
    );
  };

  const handleApplyShot = async (
    similarity: number,
    prompt: string,
    targetN: number,
    generatedHtml: string | null,
    screenshotUrl: string | null,
  ) => {
    // 서버에 샷 제출
    const result = await submitShot({
      prompt,
      targetN,
      similarity,
      generatedHtml,
      screenshotUrl,
    });

    if (result.success && result.shot && result.newPosition && result.newTotalDistance !== undefined) {
      mpApplyMyShot(
        result.shot,
        result.newPosition,
        result.newTotalDistance,
        result.finished ?? false
      );
      setFeedback({ shot: result.shot, sunk: result.finished ?? false });
    }
  };

  const isSwinging = phase === 'generating';

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
      <div className="absolute inset-0">
        <GolfCourseScene
          progress={progress}
          lateralX={myTeam.ballPosition.x}
          shotTick={mpShotTick}
          flying={phase === 'flying'}
          prevProgress={currentHole.distance > 0 ? prevBallPosition.current.totalDistance / currentHole.distance : 0}
          prevLateralX={prevBallPosition.current.x}
          onFlightComplete={handleFlightComplete}
          onHazardEnter={handleHazardEnter}
        />
      </div>

      {/* 방 코드 표시 (상단 중앙) */}
      {(mpRoom || room) && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <button
            onClick={() => setShowRoomCode(!showRoomCode)}
            className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur-sm transition hover:bg-black/60"
          >
            <span className="text-sm text-white/70">
              {mpPlayers.length}명 접속 중
            </span>
            <span className="rounded bg-action/20 px-2 py-0.5 font-mono text-sm tracking-wider text-action">
              {mpRoom?.code || room?.code}
            </span>
            <span className="text-xs text-white/50">
              {showRoomCode ? '▲' : '▼'}
            </span>
          </button>

          {/* 확장된 방 정보 */}
          <AnimatePresence>
            {showRoomCode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-xl bg-black/80 p-4 backdrop-blur-lg"
              >
                <p className="mb-2 text-center text-sm text-white/60">
                  친구에게 코드를 공유하세요
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-4 py-2 font-mono text-2xl tracking-widest text-white">
                    {mpRoom?.code || room?.code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mpRoom?.code || room?.code || '');
                    }}
                    className="rounded-lg bg-white/10 p-2 text-white/60 transition hover:bg-white/20 hover:text-white"
                  >
                    📋
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Top-left: player + hole info */}
      <div className="absolute left-5 top-5 w-56">
        <PlayerHUD team={myTeam} hole={currentHole} remaining={remaining} />
      </div>

      {/* Top-right: leaderboard */}
      <div className="absolute right-5 top-5">
        <Leaderboard teams={leaderboard} myTeamId={myPlayerId ?? ''} />
      </div>

      {/* Right side: minimap */}
      <div className="absolute right-5 top-[300px] hidden lg:block">
        <HoleMiniMap
          hole={currentHole}
          teams={leaderboard}
          myTeamId={myPlayerId ?? ''}
        />
      </div>

      {/* Back button */}
      <button
        onClick={handleLeaveRoom}
        className="icon-rail-btn absolute left-5 top-[150px]"
        title="나가기"
      >
        ←
      </button>

      {/* No targets warning */}
      {currentTargetsLoaded && !currentTarget && !myTeam.finished && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="hud-panel px-5 py-3 text-center text-sm text-white/80">
            <b>public/targets</b> 폴더에 <code>image_1.png</code> 부터 넣어주세요.
          </div>
        </div>
      )}

      {/* 비교 오버레이 */}
      <AnimatePresence>
        {phase === 'comparing' && compareData && (
          <CompareOverlay
            targetUrl={compareData.targetUrl}
            generatedUrl={compareData.generatedUrl}
            similarity={compareData.similarity}
            onComplete={handleCompareComplete}
          />
        )}
      </AnimatePresence>

      {/* 벌타 오버레이 */}
      <AnimatePresence>
        {phase === 'penalty' && mpLastPenalty && (
          <PenaltyOverlay
            penalty={mpLastPenalty}
            onDismiss={handlePenaltyDismiss}
          />
        )}
      </AnimatePresence>

      {/* Shot feedback toast */}
      <AnimatePresence>
        {phase === 'feedback' && feedback && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute left-1/2 top-24 z-50 -translate-x-1/2"
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
        {myTeam.finished && phase !== 'comparing' && phase !== 'flying' && (
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
                {currentHole.par}파 홀을 <b className="text-action">{myTeam.currentStroke}타</b>에 마쳤어요.
              </p>
              <button
                onClick={handleLeaveRoom}
                className="action-btn mt-5 w-full py-3"
              >
                새 게임 시작
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: prompt + swing panel */}
      <div className="absolute bottom-5 left-1/2 w-full max-w-4xl -translate-x-1/2 px-5">
        <PromptSwingPanel
          target={currentTarget}
          swinging={isSwinging}
          statusText={statusText}
          onSwing={handleSwing}
        />
      </div>
    </main>
  );
}
