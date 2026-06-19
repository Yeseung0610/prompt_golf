'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useHydrated } from '@/store/useHydrated';
import { useGameStore } from '@/store/gameStore';
import {
  useGameApiStore,
  useSessionInit,
  useGamePolling,
  useMyPlayer,
  useIsHost,
  generateRandomNickname,
} from '@/lib/game/useGameApi';
import { IconRail } from '@/components/game/IconRail';
import { CompareOverlay } from '@/components/game/CompareOverlay';
import { PlayerHUD } from '@/components/game/PlayerHUD';
import { PromptSwingPanel } from '@/components/game/PromptSwingPanel';
import { captureHtml } from '@/lib/capture/captureHtml';
import type { PlayerDTO } from '@/lib/game/gameServer';
import type { Team, Target } from '@/lib/game/types';

const DashboardScene = dynamic(
  () => import('@/components/game/DashboardScene').then((m) => m.DashboardScene),
  { ssr: false },
);

const GolfCourseScene = dynamic(
  () => import('@/components/game/GolfCourseScene').then((m) => m.GolfCourseScene),
  { ssr: false },
);

type GamePhase = 'login' | 'waiting' | 'playing' | 'finished';
type ShotPhase = 'idle' | 'generating' | 'comparing' | 'flying' | 'feedback';

interface CompareData {
  targetUrl: string;
  generatedUrl: string;
  similarity: number;
  prompt: string;
  targetN: number;
}

export default function MainPage() {
  const hydrated = useHydrated();

  // 세션 초기화
  const sessionId = useSessionInit();

  // REST API 상태
  const join = useGameApiStore((s) => s.join);
  const setPlayerName = useGameApiStore((s) => s.setPlayerName);
  const isJoined = useGameApiStore((s) => s.isJoined);
  const isLoading = useGameApiStore((s) => s.isLoading);
  const apiError = useGameApiStore((s) => s.error);
  const clearError = useGameApiStore((s) => s.clearError);
  const gameState = useGameApiStore((s) => s.gameState);
  const startGameApi = useGameApiStore((s) => s.startGame);
  const submitShotApi = useGameApiStore((s) => s.submitShot);
  const resetGameApi = useGameApiStore((s) => s.resetGame);

  const myPlayer = useMyPlayer();
  const isHost = useIsHost();

  // 폴링 활성화 (참가 후)
  useGamePolling(2000, isJoined);

  // 로컬 게임 스토어 (타겟 로딩용)
  const loadTargets = useGameStore((s) => s.loadTargets);
  const targets = useGameStore((s) => s.targets);
  const targetsLoaded = useGameStore((s) => s.targetsLoaded);
  const hole = useGameStore((s) => s.hole);

  // UI 상태
  const [draftName, setDraftName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [shotPhase, setShotPhase] = useState<ShotPhase>('idle');
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [statusText, setStatusText] = useState('');
  const [lastShotResult, setLastShotResult] = useState<{
    similarity: number;
    distance: number;
    finished: boolean;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nicknameInitialized, setNicknameInitialized] = useState(false);

  const prevBallPosition = useRef({ x: 0, z: 0, totalDistance: 0 });

  // 현재 게임 단계 결정
  // 게임은 항상 'playing' 상태이므로, 참가하면 바로 플레이로 진입
  const getPhase = (): GamePhase => {
    if (!isJoined) return 'login';
    if (gameState?.status === 'finished') return 'finished';
    // gameState가 없거나 'playing' 또는 'waiting'이면 바로 playing으로
    return 'playing';
  };

  const phase = getPhase();
  const error = localError || apiError;

  // 타겟 로딩
  useEffect(() => {
    if (!targetsLoaded) {
      loadTargets();
    }
  }, [targetsLoaded, loadTargets]);

  // 닉네임 초기값 설정 (랜덤 닉네임, 참가는 하지 않음)
  useEffect(() => {
    if (!nicknameInitialized) {
      setNicknameInitialized(true);
      const savedName = sessionStorage.getItem('prompt_golf_player_name');
      const playerName = savedName || generateRandomNickname();
      setDraftName(playerName);
    }
  }, [nicknameInitialized]);

  // 로그인 전에도 서버 상태 폴링 (리더보드 표시용)
  const fetchState = useGameApiStore((s) => s.fetchState);
  useEffect(() => {
    if (sessionId && !isJoined) {
      // 즉시 한 번 가져오기
      fetchState();
      // 5초마다 폴링 (로그인 전이므로 느리게)
      const interval = setInterval(fetchState, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId, isJoined, fetchState]);

  // 현재 타겟
  const currentTargetIndex = myPlayer?.currentStroke ?? 0;
  const currentTarget = targets[currentTargetIndex] ?? null;

  // 게임 참가 후 자동 시작
  const handleJoin = async () => {
    if (!draftName.trim()) {
      setLocalError('이름을 입력해주세요.');
      return;
    }
    setLocalError(null);
    clearError();
    // 닉네임을 세션에 저장 (창/탭별 독립)
    sessionStorage.setItem('prompt_golf_player_name', draftName);
    setPlayerName(draftName);
    const joinSuccess = await join();

    // 참가 성공 후 게임이 대기 중이면 자동 시작 시도
    if (joinSuccess) {
      // 약간의 지연 후 게임 시작 시도 (호스트 권한 확인을 위해)
      setTimeout(async () => {
        await startGameApi();
      }, 500);
    }
  };

  // 게임 시작 (호스트만)
  const handleStartGame = async () => {
    if (!isHost) return;
    await startGameApi();
  };

  // 샷 제출 (PromptSwingPanel에서 호출)
  const handleSwing = async (inputPrompt: string) => {
    if (!inputPrompt.trim() || !currentTarget || shotPhase !== 'idle') return;

    setPrompt(inputPrompt); // 프롬프트 저장 (applyShot에서 사용)
    setShotPhase('generating');
    setLastShotResult(null);
    setCompareData(null);
    setLocalError(null);

    // 이전 공 위치 저장 (애니메이션용)
    if (myPlayer) {
      prevBallPosition.current = {
        x: myPlayer.ballPosition.x,
        z: myPlayer.ballPosition.z,
        totalDistance: myPlayer.totalDistance,
      };
    }

    // 게임이 대기 중이면 먼저 시작
    if (gameState?.status === 'waiting') {
      await startGameApi();
    }

    let html: string | null = null;
    let screenshotUrl: string | null = null;
    let similarity = 0.5;

    try {
      // Step 1: HTML 생성
      setStatusText('웹페이지 생성 중…');
      const genRes = await fetch('/api/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputPrompt }),
      });
      const genData = await genRes.json();

      if (!genData.success || !genData.html) {
        setLocalError('HTML 생성 실패');
        setShotPhase('idle');
        setStatusText('');
        return;
      }
      html = genData.html;

      // Step 2: HTML 캡처 (스크린샷)
      if (html) {
        setStatusText('화면 캡처 중…');
        try {
          screenshotUrl = await captureHtml(html);
        } catch {
          // 캡처 실패해도 계속 진행
        }
      }

      // Step 3: 유사도 비교
      setStatusText('유사도 비교 중…');
      const compareRes = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: currentTarget.url,
          generatedHtml: html,
        }),
      });
      const compareResult = await compareRes.json();
      similarity = compareResult.similarity ?? 0.5;

      // Step 4: 비교 오버레이 표시 (스크린샷이 있는 경우)
      if (screenshotUrl) {
        setCompareData({
          targetUrl: currentTarget.url,
          generatedUrl: screenshotUrl,
          similarity,
          prompt: inputPrompt,
          targetN: currentTargetIndex,
        });
        setShotPhase('comparing');
        setStatusText('');
      } else {
        // 스크린샷 없으면 바로 샷 적용
        await applyShot(similarity, inputPrompt);
      }
    } catch {
      setLocalError('샷 처리 중 오류 발생');
      setShotPhase('idle');
      setStatusText('');
    }
  };

  // 비교 완료 후 샷 적용
  const handleCompareComplete = async () => {
    if (!compareData) return;
    setShotPhase('flying');
    await applyShot(compareData.similarity, compareData.prompt);
  };

  // 샷 결과 적용
  const applyShot = async (similarity: number, shotPrompt: string) => {
    try {
      const shotResult = await submitShotApi({
        prompt: shotPrompt,
        targetN: currentTargetIndex,
        similarity,
      });

      if (shotResult.success) {
        setLastShotResult({
          similarity,
          distance: Math.round(similarity * 100),
          finished: shotResult.finished ?? false,
        });
        setPrompt('');

        // flying 상태면 비행 애니메이션 완료를 기다림 (handleFlightComplete에서 feedback 전환)
        // flying이 아니면 (스크린샷 없이 직접 호출된 경우) 바로 feedback 표시
        if (shotPhase !== 'flying') {
          setShotPhase('feedback');
          setTimeout(() => {
            setShotPhase('idle');
            setLastShotResult(null);
          }, 3000);
        }
        // flying 상태면 handleFlightComplete에서 처리
      } else {
        setShotPhase('idle');
      }
    } catch {
      setLocalError('샷 적용 중 오류 발생');
      setShotPhase('idle');
    }
  };

  // 게임 리셋 (호스트만)
  const handleResetGame = async () => {
    if (!isHost) return;
    await resetGameApi();
    setLastShotResult(null);
  };

  // 온라인 플레이어 수
  const onlineCount = gameState?.players.filter((p) => p.online).length ?? 0;

  // 리더보드용 데이터
  const leaderboard = [...(gameState?.players ?? [])].sort(
    (a, b) => a.score - b.score || a.currentStroke - b.currentStroke
  );

  // 3D 씬용 progress 계산
  const FLAG_Z = 380;
  const progress = myPlayer ? myPlayer.ballPosition.z / FLAG_Z : 0;
  const lateralX = myPlayer?.ballPosition.x ?? 0;

  // 팀 데이터 (3D 씬용)
  const teams = (gameState?.players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.avatarUrl,
    score: p.score,
    currentStroke: p.currentStroke,
    ballPosition: p.ballPosition,
    totalDistance: p.totalDistance,
    isCurrentTurn: p.id === myPlayer?.id,
  }));

  // 내 팀 데이터 (PlayerHUD용)
  const myTeam: Team | undefined = myPlayer
    ? {
        id: myPlayer.id,
        name: myPlayer.name,
        imageUrl: myPlayer.avatarUrl,
        score: myPlayer.score,
        currentStroke: myPlayer.currentStroke,
        ballPosition: myPlayer.ballPosition,
        totalDistance: myPlayer.totalDistance,
        isCurrentTurn: true,
        finished: myPlayer.finished,
      }
    : undefined;

  // 남은 거리 계산
  const remaining = Math.max(0, Math.round(hole.distance - (myPlayer?.totalDistance ?? 0)));


  // 비행 완료 핸들러
  const handleFlightComplete = () => {
    // flying 상태일 때만 feedback으로 전환
    if (shotPhase === 'flying') {
      setShotPhase('feedback');
      setTimeout(() => {
        setShotPhase('idle');
        setLastShotResult(null);
      }, 3000);
    }
  };

  // 이전 위치 기반 progress 계산
  const prevProgress = hole.distance > 0 ? prevBallPosition.current.totalDistance / hole.distance : 0;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
      {/* 3D 배경 - 대기/로그인 시 대시보드, 플레이 시 골프코스 */}
      <div className="absolute inset-0">
        {hydrated && (phase === 'login' || phase === 'waiting') && (
          <DashboardScene teams={teams} hole={hole} />
        )}
        {hydrated && (phase === 'playing' || phase === 'finished') && (
          <GolfCourseScene
            progress={progress}
            lateralX={lateralX}
            shotTick={myPlayer?.currentStroke ?? 0}
            flying={shotPhase === 'flying'}
            prevProgress={prevProgress}
            prevLateralX={prevBallPosition.current.x}
            onFlightComplete={handleFlightComplete}
          />
        )}
      </div>

      {/* 비네트 오버레이 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/45" />

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 상단 HUD */}
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {/* 타이틀 */}
      <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 text-center">
        <h1 className="text-sm font-semibold tracking-widest text-white/70">PROMPT GOLF</h1>
      </div>

      {/* 서버 상태 (우측 상단) */}
      <div className="absolute right-4 top-4 flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${gameState ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
        <span className="text-white/60">
          {gameState ? `${onlineCount}명 플레이 중` : '서버 연결 중...'}
        </span>
      </div>


      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 리더보드 (우측) - 항상 표시 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="absolute right-5 top-16 w-56">
        <div className="rounded-xl bg-black/40 p-3 backdrop-blur-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            리더보드
          </h3>
          {leaderboard.length > 0 ? (
            <div className="space-y-1">
              {leaderboard.slice(0, 6).map((player, i) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                    player.id === myPlayer?.id
                      ? 'bg-green-600/30 text-white'
                      : 'text-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${player.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="truncate" style={{ maxWidth: '80px' }}>
                      {i + 1}. {player.name}
                    </span>
                    {player.isHost && <span className="text-yellow-400">👑</span>}
                  </div>
                  <span className="text-xs text-white/50">
                    {player.currentStroke}타
                    {player.finished && ' ✓'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-white/40">
              아직 플레이어가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* 아이콘 레일 (우측 하단) */}
      <div className="absolute bottom-6 right-5">
        <IconRail />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 로그인 단계 - 중앙 하단 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'login' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-8 left-1/2 w-full max-w-sm -translate-x-1/2 px-4"
          >
            <div className="rounded-2xl bg-black/50 p-5 backdrop-blur-md">
              <h2 className="mb-4 text-center text-lg font-bold text-white">게임 참가</h2>

              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="mb-3 w-full rounded-xl bg-white/10 px-4 py-3 text-center text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-green-500"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />

              {error && <p className="mb-3 text-center text-sm text-red-400">{error}</p>}

              <button
                onClick={handleJoin}
                disabled={isLoading || !draftName.trim()}
                className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? '참가 중...' : '▶ 게임 참가'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 대기 단계 - 중앙 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'waiting' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-8 left-1/2 w-full max-w-md -translate-x-1/2 px-4"
          >
            <div className="rounded-2xl bg-black/50 p-5 backdrop-blur-md">
              <h2 className="mb-2 text-center text-lg font-bold text-white">
                {myPlayer?.name}님, 환영합니다!
              </h2>
              <p className="mb-4 text-center text-sm text-white/60">
                {isHost
                  ? '준비가 되면 게임을 시작하세요.'
                  : '호스트가 게임을 시작하기를 기다리는 중...'}
              </p>

              {/* 플레이어 아바타 행 */}
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {gameState?.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                      player.id === myPlayer?.id
                        ? 'bg-green-600/40 text-white'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${player.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span>{player.name}</span>
                    {player.isHost && <span>👑</span>}
                  </div>
                ))}
              </div>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={isLoading}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? '시작 중...' : '🚀 게임 시작'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 플레이 단계 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {phase === 'playing' && myTeam && (
        <>
          {/* 내 상태 (좌측 상단) - PlayerHUD 스타일 */}
          <div className="absolute left-5 top-5 w-56">
            <PlayerHUD team={myTeam} hole={hole} remaining={remaining} />
          </div>

          {/* 피드백 토스트 (상단 중앙) */}
          <AnimatePresence>
            {shotPhase === 'feedback' && lastShotResult && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16 }}
                className="absolute left-1/2 top-24 z-50 -translate-x-1/2"
              >
                <div className="hud-panel px-6 py-3 text-center">
                  {lastShotResult.finished ? (
                    <div className="text-lg font-bold text-action">🏆 홀 아웃!</div>
                  ) : (
                    <div className="text-lg font-bold text-white">
                      나이스 샷! <span className="text-action">{lastShotResult.distance}m</span> 전진
                    </div>
                  )}
                  <div className="mt-1 text-xs text-white/60">
                    유사도 {Math.round(lastShotResult.similarity * 100)}%
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 홀 완료 오버레이 */}
          <AnimatePresence>
            {myPlayer?.finished && shotPhase !== 'comparing' && shotPhase !== 'flying' && (
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
                    {hole.par}파 홀을 <b className="text-action">{myPlayer.currentStroke}타</b>에 마쳤어요.
                  </p>
                  {isHost && (
                    <button
                      onClick={handleResetGame}
                      className="action-btn mt-5 w-full py-3"
                    >
                      새 게임 시작
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 에러 표시 */}
          {error && (
            <div className="absolute left-1/2 top-24 z-40 -translate-x-1/2">
              <div className="rounded-lg bg-red-600/80 px-4 py-2 text-sm text-white backdrop-blur-sm">
                {error}
              </div>
            </div>
          )}

          {/* 프롬프트 입력 패널 (하단) */}
          {!myPlayer?.finished && (
            <div className="absolute bottom-5 left-1/2 w-full max-w-4xl -translate-x-1/2 px-5">
              <PromptSwingPanel
                target={currentTarget}
                swinging={shotPhase === 'generating'}
                statusText={statusText}
                onSwing={handleSwing}
              />
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 비교 오버레이 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {shotPhase === 'comparing' && compareData && (
          <CompareOverlay
            targetUrl={compareData.targetUrl}
            generatedUrl={compareData.generatedUrl}
            similarity={compareData.similarity}
            onComplete={handleCompareComplete}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 완료 단계 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'finished' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <div className="w-full max-w-md rounded-2xl bg-black/70 p-6 backdrop-blur-md">
              <h2 className="mb-6 text-center text-3xl font-bold text-white">🏆 게임 완료!</h2>

              <div className="mb-6 space-y-2">
                {leaderboard.map((player, i) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      i === 0
                        ? 'bg-yellow-500/30'
                        : player.id === myPlayer?.id
                        ? 'bg-green-600/30'
                        : 'bg-white/10'
                    }`}
                  >
                    <span className="text-lg text-white">
                      {i === 0 && '🥇 '}
                      {i === 1 && '🥈 '}
                      {i === 2 && '🥉 '}
                      {player.name}
                    </span>
                    <span className="text-white/80">{player.currentStroke}타</span>
                  </div>
                ))}
              </div>

              {isHost && (
                <button
                  onClick={handleResetGame}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white shadow-lg transition hover:bg-green-700"
                >
                  🔄 새 게임 시작
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
