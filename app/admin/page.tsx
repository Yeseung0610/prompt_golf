'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { GameStateDTO } from '@/lib/game/gameServer';

/**
 * Admin 페이지 - 게임에 참가하지 않고 관찰/관리만 수행
 */
export default function AdminPage() {
  const router = useRouter();

  const [gameState, setGameState] = useState<GameStateDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
