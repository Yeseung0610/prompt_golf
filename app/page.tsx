'use client';

import { useEffect, useState, useRef, useCallback, type ChangeEvent } from 'react';
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
import { EvaluationOverlay } from '@/components/game/EvaluationOverlay';
import { PlayerHUD } from '@/components/game/PlayerHUD';
import { PromptSwingPanel } from '@/components/game/PromptSwingPanel';
import { ImageZoomDialog } from '@/components/game/ImageZoomDialog';
import type { OtherBall } from '@/components/game/GolfCourseScene';
import type { PlayerDTO } from '@/lib/game/gameServer';
import type { Team, Target } from '@/lib/game/types';
import { challengeForStroke } from '@/lib/content/challenges';
import { TRACK_META, type ChallengeHole, type EvaluationResult } from '@/lib/content/types';

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

/** 루브릭 트랙 평가 결과 (EvaluationOverlay 표시 + 샷 적용용). */
interface EvalData {
  challenge: ChallengeHole;
  result: EvaluationResult;
  submission: string;
}

/** 업로드 이미지를 정사각 size×size로 cover-crop하여 JPEG data URL로 변환. */
function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function MainPage() {
  const hydrated = useHydrated();

  // 세션 초기화
  const sessionId = useSessionInit();

  // REST API 상태
  const join = useGameApiStore((s) => s.join);
  const setPlayerName = useGameApiStore((s) => s.setPlayerName);
  const setAvatarUrl = useGameApiStore((s) => s.setAvatarUrl);
  const updateDraft = useGameApiStore((s) => s.updateDraft);
  const shotQueue = useGameApiStore((s) => s.shotQueue);
  const dequeueShot = useGameApiStore((s) => s.dequeueShot);
  const isJoined = useGameApiStore((s) => s.isJoined);
  const isLoading = useGameApiStore((s) => s.isLoading);
  const apiError = useGameApiStore((s) => s.error);
  const clearError = useGameApiStore((s) => s.clearError);
  const gameState = useGameApiStore((s) => s.gameState);
  const startGameApi = useGameApiStore((s) => s.startGame);
  const submitShotApi = useGameApiStore((s) => s.submitShot);
  const resetGameApi = useGameApiStore((s) => s.resetGame);

  const myPlayerLive = useMyPlayer();
  const isHost = useIsHost();

  // 폴링 갱신/재참가로 내 플레이어가 잠깐 사라져도 마지막 정보를 유지해
  // 플레이 화면이 언마운트되며 깜빡이는 것을 방지한다.
  const lastMyPlayer = useRef<PlayerDTO | null>(null);
  if (myPlayerLive) lastMyPlayer.current = myPlayerLive;
  const myPlayer = myPlayerLive ?? lastMyPlayer.current;

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
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [statusText, setStatusText] = useState('');
  const [lastShotResult, setLastShotResult] = useState<{
    similarity: number;
    distance: number;
    finished: boolean;
    /** true면 루브릭 평가 점수(유사도가 아님). */
    rubric?: boolean;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nicknameInitialized, setNicknameInitialized] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null);
  const [spectateLive, setSpectateLive] = useState<PlayerDTO | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const prevBallPosition = useRef({ x: 0, z: 0, totalDistance: 0 });
  const autoRejoinedRef = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 작성 중 프롬프트를 디바운스(300ms)하여 서버에 동기화 (관전자 실시간 표시)
  const handlePromptChange = (value: string) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => updateDraft(value), 300);
  };

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

  // 닉네임/아바타 초기값 설정 (저장된 값 복원, 참가는 하지 않음)
  useEffect(() => {
    if (!nicknameInitialized) {
      setNicknameInitialized(true);
      const savedName = sessionStorage.getItem('prompt_golf_player_name');
      const playerName = savedName || generateRandomNickname();
      setDraftName(playerName);
      setDraftAvatar(sessionStorage.getItem('prompt_golf_avatar'));
    }
  }, [nicknameInitialized]);

  // 새로고침 시 사용자 정보 유지: 이전에 참가했었다면 자동 재참가
  // (서버는 sessionId로 플레이어를 유지하므로 같은 플레이어로 복귀)
  useEffect(() => {
    if (autoRejoinedRef.current || !sessionId || isJoined) return;
    const wasJoined = sessionStorage.getItem('prompt_golf_joined') === '1';
    const savedName = sessionStorage.getItem('prompt_golf_player_name');
    if (wasJoined && savedName) {
      autoRejoinedRef.current = true;
      setPlayerName(savedName);
      setAvatarUrl(sessionStorage.getItem('prompt_golf_avatar'));
      join();
    }
  }, [sessionId, isJoined, setPlayerName, setAvatarUrl, join]);

  // 로그인 전에도 서버 상태 폴링 (리더보드 표시용)
  const fetchState = useGameApiStore((s) => s.fetchState);
  useEffect(() => {
    if (sessionId && !isJoined) {
      // 즉시 한 번 가져오기
      fetchState();
      // 관전 중에는 1초(프롬프트 실시간 동기화), 평소엔 5초마다 폴링
      const interval = setInterval(fetchState, spectating ? 1000 : 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId, isJoined, fetchState, spectating]);

  // 관전 포커스: 선택한 플레이어의 라이브 상태(작성 중 프롬프트 등)를 전용 API로 폴링
  useEffect(() => {
    if (!spectating || !spectateTargetId) {
      setSpectateLive(null);
      return;
    }
    // 대상이 바뀌면 이전 대상 정보를 즉시 비워 잘못된 정보가 잠깐 보이지 않게
    setSpectateLive(null);
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/game/player?playerId=${spectateTargetId}`);
        const data = await res.json();
        if (!cancelled && data.success) setSpectateLive(data.player as PlayerDTO);
      } catch {
        /* 폴링 실패는 무시 */
      }
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [spectating, spectateTargetId]);

  // 현재 타수의 챌린지 (데모 시퀀스: 이미지 재현 → 백엔드 API 설계 → SRE 장애 대응)
  const currentTargetIndex = myPlayer?.currentStroke ?? 0;
  const currentChallenge = challengeForStroke(currentTargetIndex, targets.length);
  const isRubricChallenge = currentChallenge != null && currentChallenge.track !== 'image';
  // 이미지 트랙 챌린지가 참조하는 목표 이미지 (루브릭 트랙이면 없음)
  const currentTarget: Target | null =
    currentChallenge?.track === 'image' && currentChallenge.targetIndex != null
      ? targets[currentChallenge.targetIndex] ?? null
      : null;

  // 게임 참가
  const handleJoin = async () => {
    if (!draftName.trim()) {
      setLocalError('이름을 입력해주세요.');
      return;
    }
    setLocalError(null);
    clearError();
    // 사용자 정보를 세션에 저장 (창/탭별 독립, 새로고침 시 유지)
    sessionStorage.setItem('prompt_golf_player_name', draftName);
    if (draftAvatar) {
      sessionStorage.setItem('prompt_golf_avatar', draftAvatar);
    } else {
      sessionStorage.removeItem('prompt_golf_avatar');
    }
    setPlayerName(draftName);
    setAvatarUrl(draftAvatar);
    const joinSuccess = await join();

    // 메인 방은 항상 'playing' 상태이므로 별도 시작 호출이 필요 없다.
    // (이전의 지연 startGame 호출이 첫 참가 시 "플레이어를 찾을 수 없습니다"
    //  레이스를 유발했었음.) 참가가 끝나면 다음 참가를 위해 플래그만 저장.
    if (joinSuccess) {
      sessionStorage.setItem('prompt_golf_joined', '1');
    }
  };

  // 아바타 이미지 선택 → 128px로 축소한 data URL 생성
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 128);
      setDraftAvatar(dataUrl);
      sessionStorage.setItem('prompt_golf_avatar', dataUrl);
    } catch {
      setLocalError('이미지를 불러오지 못했어요.');
    }
  };

  // 게임 시작 (호스트만)
  const handleStartGame = async () => {
    if (!isHost) return;
    await startGameApi();
  };

  // 샷 제출 (PromptSwingPanel에서 호출)
  const handleSwing = async (inputPrompt: string) => {
    if (!inputPrompt.trim() || shotPhase !== 'idle') return;
    // 이미지 트랙은 목표 이미지가 필요, 루브릭 트랙은 브리프만으로 진행
    if (!isRubricChallenge && !currentTarget) return;

    setPrompt(inputPrompt); // 프롬프트 저장 (applyShot에서 사용)
    if (draftTimer.current) clearTimeout(draftTimer.current);
    updateDraft(''); // 샷 시작 시 작성 중 프롬프트 즉시 비움
    setPanelExpanded(false);
    setShotPhase('generating');
    setLastShotResult(null);
    setCompareData(null);
    setEvalData(null);
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

    // ── 루브릭 트랙: 텍스트 산출물 → LLM Judge 평가 ──────────────────────────
    if (isRubricChallenge && currentChallenge) {
      try {
        setStatusText('제출물 평가 중…');
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: currentChallenge.id, submission: inputPrompt }),
        });
        const data = await res.json();

        if (!data.success || !data.result) {
          setLocalError(data.error ?? '평가 실패');
          setShotPhase('idle');
          setStatusText('');
          return;
        }

        setEvalData({
          challenge: currentChallenge,
          result: data.result as EvaluationResult,
          submission: inputPrompt,
        });
        setShotPhase('comparing');
        setStatusText('');
      } catch {
        setLocalError('샷 처리 중 오류 발생');
        setShotPhase('idle');
        setStatusText('');
      }
      return;
    }

    // ── 이미지 트랙: 기존 생성 → 비교 플로우 ────────────────────────────────
    if (!currentTarget) return;

    let screenshotUrl: string | null = null;
    let similarity = 0.5;

    try {
      // Step 1: 이미지 생성 (OpenAI)
      setStatusText('이미지 생성 중…');
      const genRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputPrompt }),
      });
      const genData = await genRes.json();

      if (!genData.success || !genData.dataUrl) {
        setLocalError('이미지 생성 실패');
        setShotPhase('idle');
        setStatusText('');
        return;
      }
      screenshotUrl = genData.dataUrl;

      // Step 2: 유사도 비교 (OpenAI 비전)
      setStatusText('유사도 비교 중…');
      const compareRes = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedUrl: screenshotUrl,
          targetFile: currentTarget.file,
        }),
      });
      const compareResult = await compareRes.json();
      similarity = compareResult.similarity ?? 0.5;

      // Step 3: 비교 오버레이 표시
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

  // 루브릭 평가 오버레이 완료 후 샷 적용 (score가 기존 similarity 자리에 들어간다)
  const handleEvaluationComplete = async () => {
    if (!evalData) return;
    setShotPhase('flying');
    await applyShot(evalData.result.score, evalData.submission, { rubric: true });
  };

  // 샷 결과 적용
  const applyShot = async (
    similarity: number,
    shotPrompt: string,
    opts?: { rubric?: boolean },
  ) => {
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
          rubric: opts?.rubric ?? false,
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

  // 3D 씬용 progress — 비행 시작/끝, 상대, 샷 모두 totalDistance/hole.distance 기준으로 통일
  const progress = myPlayer && hole.distance > 0 ? myPlayer.totalDistance / hole.distance : 0;
  const lateralX = myPlayer?.ballPosition.x ?? 0;

  // 게임 화면에 함께 표시할 상대 플레이어들 (나 제외)
  const others: OtherBall[] = (gameState?.players ?? [])
    .filter((p) => p.id !== myPlayer?.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.avatarUrl,
      progress: hole.distance > 0 ? p.totalDistance / hole.distance : 0,
      lateralX: p.ballPosition.x,
    }));

  // 내 샷 이벤트는 로컬 비행으로 처리하므로 큐에서 즉시 제거(상대 샷만 씬에서 재생)
  useEffect(() => {
    if (!myPlayer?.id) return;
    shotQueue.forEach((s) => {
      if (s.playerId === myPlayer.id) dequeueShot(s.id);
    });
  }, [shotQueue, myPlayer?.id, dequeueShot]);

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
    currentPrompt: p.currentPrompt,
  }));

  // 관전 중 포커스한 플레이어
  const spectatePlayer = spectateTargetId
    ? gameState?.players.find((p) => p.id === spectateTargetId) ?? null
    : null;
  // 의도 기반: 플레이어가 일시적으로 폴링 상태에서 사라져도(재참가 등) 관전 유지
  const spectateActive = spectating && spectateTargetId != null;
  // 표시용 라이브 정보: 전용 폴링(spectateLive) 우선, 없으면 메인 상태 폴백
  const focusInfo = spectateLive ?? spectatePlayer;

  // 관전 대상이 현재 플레이 중인 챌린지 (루브릭 홀이면 이미지 대신 브리프 요약 표시)
  const spectateChallenge = focusInfo
    ? challengeForStroke(focusInfo.currentStroke, targets.length)
    : null;
  const spectateTarget =
    spectateChallenge?.track === 'image' && spectateChallenge.targetIndex != null
      ? targets[spectateChallenge.targetIndex] ?? null
      : null;

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


  // 비행 완료 핸들러 (memo된 GolfCourseScene이 비행 중 재렌더되지 않도록 안정화)
  const handleFlightComplete = useCallback(() => {
    // flying 상태일 때만 feedback으로 전환
    setShotPhase((phase) => {
      if (phase !== 'flying') return phase;
      setTimeout(() => {
        setShotPhase('idle');
        setLastShotResult(null);
      }, 3000);
      return 'feedback';
    });
  }, []);

  // 이전 위치 기반 progress 계산
  const prevProgress = hole.distance > 0 ? prevBallPosition.current.totalDistance / hole.distance : 0;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
      {/* 3D 배경 - 대기/로그인 시 대시보드, 플레이 시 골프코스 */}
      <div className="absolute inset-0">
        {hydrated && (phase === 'login' || phase === 'waiting') && (
          <DashboardScene
            teams={teams}
            hole={hole}
            onSelectPlayer={spectating ? setSpectateTargetId : undefined}
            shots={shotQueue}
            onShotDone={dequeueShot}
            focusPlayerId={spectateActive ? spectateTargetId : null}
          />
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
            others={others}
            shots={shotQueue}
            myPlayerId={myPlayer?.id}
            onShotDone={dequeueShot}
            holeDistance={hole.distance}
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

      {/* 서버 상태 (우측 상단) — 관전 포커스 중에는 뒤로가기 버튼과 겹치므로 숨김 */}
      {!spectateActive && (
        <div className="absolute right-4 top-4 flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${gameState ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-white/60">
            {gameState ? `${onlineCount}명 플레이 중` : '서버 연결 중...'}
          </span>
        </div>
      )}


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
        {phase === 'login' && !spectating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 z-20 flex items-center justify-center px-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-black/50 p-6 backdrop-blur-md">
              <h2 className="mb-5 text-center text-lg font-bold text-white">게임 참가</h2>

              {/* 아바타 업로드 */}
              <div className="mb-4 flex flex-col items-center gap-2">
                <label className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full ring-2 ring-white/20 transition hover:ring-green-500">
                  {draftAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draftAvatar} alt="내 아바타" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-white/10 text-white/50">
                      <span className="text-2xl">📷</span>
                      <span className="mt-1 text-[10px]">사진 추가</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    변경
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                {draftAvatar && (
                  <button
                    onClick={() => {
                      setDraftAvatar(null);
                      sessionStorage.removeItem('prompt_golf_avatar');
                    }}
                    className="text-xs text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
                  >
                    사진 제거
                  </button>
                )}
              </div>

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

              <button
                onClick={() => setSpectating(true)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 py-3 font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                👁 관전하기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 관전 모드 - 전체 보기 바 (플레이어 미선택) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'login' && spectating && !spectateActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-black/50 px-5 py-3 backdrop-blur-md">
              <span className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                👁 관전 중
              </span>
              <button
                onClick={() => {
                  setSpectating(false);
                  setSpectateTargetId(null);
                }}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700"
              >
                ▶ 게임 참가
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 관전 모드 - 플레이어 포커스 (선택된 플레이어 화면) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {phase === 'login' && spectateActive && focusInfo && (
        <>
          {/* 우상단: 뒤로가기 버튼 (전체 보기로) */}
          <button
            onClick={() => setSpectateTargetId(null)}
            className="absolute right-5 top-5 z-40 flex items-center gap-1.5 rounded-xl bg-black/55 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-black/75"
          >
            ← 뒤로가기
          </button>

          {/* 좌상단: 관전 대상 플레이어 정보 */}
          <div className="absolute left-5 top-5 z-20 w-64">
            <div className="rounded-2xl bg-black/50 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                {focusInfo.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={focusInfo.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl">
                    🧑
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-bold text-white">
                    👁 {focusInfo.name}
                    <span className={`h-2 w-2 shrink-0 rounded-full ${focusInfo.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                  </div>
                  <div className="text-xs text-white/60">
                    {focusInfo.currentStroke}타 · 스코어 {focusInfo.score > 0 ? `+${focusInfo.score}` : focusInfo.score}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 하단: 관전 대상이 만들 화면 + 작성 중 프롬프트(전용 API 실시간 폴링) */}
          <div className="absolute bottom-5 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 px-5">
            <div className="flex items-stretch gap-4 rounded-2xl bg-black/50 p-4 backdrop-blur-md">
              {/* 만들어야 할 화면 / 진행 중 챌린지 */}
              <div className="flex w-40 shrink-0 flex-col">
                <span className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  {spectateChallenge && spectateChallenge.track !== 'image'
                    ? '진행 중 챌린지'
                    : '만들어야 할 화면'}
                </span>
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/15">
                  {spectateChallenge && spectateChallenge.track !== 'image' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TRACK_META[spectateChallenge.track].badgeClass}`}
                      >
                        {TRACK_META[spectateChallenge.track].icon}{' '}
                        {TRACK_META[spectateChallenge.track].label}
                      </span>
                      <span className="text-[11px] font-medium leading-snug text-white/85">
                        {spectateChallenge.title}
                      </span>
                    </div>
                  ) : spectateTarget ? (
                    <button
                      type="button"
                      onClick={() => setZoomSrc(spectateTarget.url)}
                      className="group relative h-full w-full cursor-zoom-in"
                      title="크게 보기"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={spectateTarget.url}
                        alt="목표"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80 opacity-0 transition group-hover:opacity-100">
                        🔍 크게
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                      준비된 타겟 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 작성 중 프롬프트 (실시간) */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  ✍️ 작성 중인 프롬프트
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                </span>
                <div className="thin-scroll flex-1 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white/90">
                  {focusInfo.currentPrompt?.trim() ? (
                    focusInfo.currentPrompt
                  ) : (
                    <span className="text-white/35">아직 입력 중인 내용이 없습니다…</span>
                  )}
                </div>
              </div>

              {/* 참가 버튼 */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSpectating(false);
                    setSpectateTargetId(null);
                  }}
                  className="h-12 rounded-xl bg-green-600 px-5 text-sm font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700"
                >
                  ▶ 게임 참가
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                    {lastShotResult.rubric ? '평가 점수' : '유사도'}{' '}
                    {Math.round(lastShotResult.similarity * 100)}%
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
            <div
              className={`absolute bottom-5 left-1/2 w-full -translate-x-1/2 px-5 transition-[max-width] duration-300 ${
                panelExpanded ? 'max-w-[1500px]' : 'max-w-4xl'
              }`}
            >
              <PromptSwingPanel
                target={currentTarget}
                challenge={currentChallenge}
                swinging={shotPhase === 'generating'}
                statusText={statusText}
                expanded={panelExpanded}
                onExpandedChange={setPanelExpanded}
                onPromptChange={handlePromptChange}
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
      {/* 루브릭 평가 결과 오버레이 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {shotPhase === 'comparing' && evalData && (
          <EvaluationOverlay
            challenge={evalData.challenge}
            result={evalData.result}
            onComplete={handleEvaluationComplete}
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

      {/* 목표 이미지 확대 팝업 (관전 화면) */}
      <ImageZoomDialog src={zoomSrc} alt="목표 이미지" onClose={() => setZoomSrc(null)} />
    </main>
  );
}
