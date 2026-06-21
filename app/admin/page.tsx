'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { GameStateDTO } from '@/lib/game/gameServer';

interface TargetItem {
  n: number;
  file: string;
  url: string;
}

/**
 * Admin 페이지 - 게임에 참가하지 않고 관찰/관리만 수행
 */
export default function AdminPage() {
  const router = useRouter();

  const [gameState, setGameState] = useState<GameStateDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [targetBusy, setTargetBusy] = useState(false);

  // Admin 전용 세션 ID (게임에 참가하지 않음)
  const adminSessionId = 'admin-observer';

  // 게임 상태 폴링 (플레이어로 등록하지 않음)
  const fetchGameState = useCallback(async () => {
    try {
      // 모든 세션의 상태를 가져오기 위해 빈 sessionId 또는 특수 값 사용
      const res = await fetch('/api/game/state?sessionId=admin-observer&adminMode=true');
      const data = await res.json();

      if (data.success && data.state) {
        setGameState(data.state);
        setError(null);
      }
    } catch (err) {
      console.warn('[Admin] Polling failed:', err);
    }
  }, []);

  // 2초마다 폴링
  useEffect(() => {
    fetchGameState();
    const interval = setInterval(fetchGameState, 2000);
    return () => clearInterval(interval);
  }, [fetchGameState]);

  const handleStartGame = async () => {
    setMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: adminSessionId, adminMode: true }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('✅ 게임이 시작되었습니다!');
        fetchGameState();
      } else {
        setError(data.error || '게임 시작 실패');
      }
    } catch (err) {
      setError('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetGame = async () => {
    setMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: adminSessionId, adminMode: true }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('✅ 게임이 초기화되었습니다!');
        fetchGameState();
      } else {
        setError(data.error || '게임 초기화 실패');
      }
    } catch (err) {
      setError('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // ── 타겟 이미지 관리 ──────────────────────────────────────────────────────
  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/targets');
      const data = await res.json();
      if (data.success) setTargets(data.targets);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleAddTarget = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 추가할 수 있습니다.');
      return;
    }
    setError(null);
    setTargetBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('read failed'));
        r.readAsDataURL(file);
      });
      const res = await fetch('/api/admin/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setTargets(data.targets);
        setMessage('✅ 타겟 이미지를 추가했습니다.');
      } else {
        setError(data.error || '추가 실패');
      }
    } catch {
      setError('이미지 추가 실패');
    } finally {
      setTargetBusy(false);
    }
  };

  const handleDeleteTarget = async (fileName: string) => {
    setTargetBusy(true);
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileName }),
      });
      const data = await res.json();
      if (data.success) setTargets(data.targets);
      else setError(data.error || '삭제 실패');
    } catch {
      setError('이미지 삭제 실패');
    } finally {
      setTargetBusy(false);
    }
  };

  const handleMoveTarget = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= targets.length) return;
    const order = targets.map((t) => t.file);
    [order[index], order[j]] = [order[j], order[index]];
    // 낙관적 업데이트
    setTargets(order.map((file, i) => ({ ...targets.find((t) => t.file === file)!, n: i + 1 })));
    setTargetBusy(true);
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      const data = await res.json();
      if (data.success) setTargets(data.targets);
      else {
        setError(data.error || '순서 변경 실패');
        fetchTargets();
      }
    } catch {
      setError('순서 변경 실패');
      fetchTargets();
    } finally {
      setTargetBusy(false);
    }
  };

  // Admin을 제외한 실제 플레이어만 표시
  const realPlayers = gameState?.players.filter((p) => !p.name.startsWith('Admin')) ?? [];
  const onlinePlayers = realPlayers.filter((p) => p.online);

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold">🎮 Prompt Golf 관리자</h1>

        {/* 상태 */}
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">서버 상태</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">게임 상태:</span>
              <span className={`ml-2 font-semibold ${
                gameState?.status === 'playing' ? 'text-green-400' :
                gameState?.status === 'finished' ? 'text-blue-400' :
                'text-yellow-400'
              }`}>
                {gameState?.status === 'playing' ? '🟢 게임 중' :
                 gameState?.status === 'finished' ? '🔵 완료' :
                 '🟡 대기 중'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">온라인 플레이어:</span>
              <span className="ml-2 font-semibold text-green-400">
                {onlinePlayers.length}명
              </span>
            </div>
            <div>
              <span className="text-gray-400">전체 플레이어:</span>
              <span className="ml-2 font-semibold">{realPlayers.length}명</span>
            </div>
            <div>
              <span className="text-gray-400">모드:</span>
              <span className="ml-2 font-semibold text-purple-400">
                👁️ 관찰 모드
              </span>
            </div>
          </div>
        </div>

        {/* 플레이어 목록 (Admin 제외) */}
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">플레이어 목록</h2>
          {realPlayers.length === 0 ? (
            <p className="text-gray-400">아직 참가한 플레이어가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {realPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded bg-gray-700 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        player.online ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    />
                    <span className={player.isHost ? 'font-semibold text-yellow-400' : ''}>
                      {player.name}
                      {player.isHost && ' 👑'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    스트로크: {player.currentStroke} |
                    거리: {Math.round(player.totalDistance)}m
                    {player.finished && ' ✅'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 타겟 이미지 관리 */}
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">🎯 타겟 이미지 ({targets.length})</h2>
            <label
              className={`cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold transition hover:bg-blue-700 ${
                targetBusy ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              + 이미지 추가
              <input
                type="file"
                accept="image/*"
                onChange={handleAddTarget}
                disabled={targetBusy}
                className="hidden"
              />
            </label>
          </div>
          <p className="mb-3 text-xs text-gray-400">
            위에서부터 타수 1, 2, 3… 순서입니다. 화살표로 순서를 바꾸고, 삭제로 제거하세요.
          </p>

          {targets.length === 0 ? (
            <p className="text-sm text-gray-400">타겟 이미지가 없습니다. 이미지를 추가해주세요.</p>
          ) : (
            <div className="space-y-2">
              {targets.map((t, i) => (
                <div key={t.file} className="flex items-center gap-3 rounded bg-gray-700 p-2">
                  <span className="w-7 shrink-0 text-center text-sm font-bold text-gray-300">
                    {t.n}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.url}
                    alt={`타겟 ${t.n}`}
                    className="h-14 w-20 shrink-0 rounded object-cover ring-1 ring-white/10"
                  />
                  <span className="flex-1 truncate text-xs text-gray-400">{t.file}</span>
                  <div className="flex flex-col leading-none">
                    <button
                      onClick={() => handleMoveTarget(i, -1)}
                      disabled={i === 0 || targetBusy}
                      className="px-2 text-gray-300 transition hover:text-white disabled:opacity-30"
                      title="위로"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveTarget(i, 1)}
                      disabled={i === targets.length - 1 || targetBusy}
                      className="px-2 text-gray-300 transition hover:text-white disabled:opacity-30"
                      title="아래로"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteTarget(t.file)}
                    disabled={targetBusy}
                    className="shrink-0 rounded bg-red-600 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-red-700 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="mb-6 space-y-3">
          <button
            onClick={handleStartGame}
            disabled={isLoading || gameState?.status === 'playing'}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? '처리 중...' : '🚀 게임 시작'}
          </button>

          <button
            onClick={handleResetGame}
            disabled={isLoading}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? '처리 중...' : '🔄 게임 초기화'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full rounded-lg bg-gray-600 px-4 py-3 font-semibold transition hover:bg-gray-700"
          >
            ← 메인으로 돌아가기
          </button>
        </div>

        {/* 메시지 */}
        {message && (
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-900/50 p-4 text-center text-red-300">
            ❌ {error}
          </div>
        )}

        {/* 디버깅 정보 */}
        <div className="mt-8 text-xs text-gray-500">
          <p>Mode: Observer (게임 참가 안 함)</p>
          <p>Room ID: {gameState?.roomId}</p>
        </div>
      </div>
    </main>
  );
}
