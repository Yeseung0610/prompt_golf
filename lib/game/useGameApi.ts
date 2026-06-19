'use client';

/**
 * 게임 API 클라이언트 훅
 *
 * REST API + Polling 기반 멀티플레이어 상태 관리
 * WebSocket 없이 안정적으로 작동합니다.
 */

import { create } from 'zustand';
import { useEffect, useRef, useCallback } from 'react';
import type { GameStateDTO, PlayerDTO } from './gameServer';

// ─────────────────────────────────────────────────────────────────────────────
// Session ID 관리
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'prompt_golf_session_id';

/**
 * 창/탭별 독립 세션 ID 생성
 * sessionStorage 사용 → 각 창/탭이 별도 유저로 인식됨
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  // sessionStorage: 창/탭별로 독립적
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

/**
 * 랜덤 닉네임 생성기
 * 형용사 + 동물 조합으로 재미있는 이름 생성
 */
const ADJECTIVES = [
  '용감한', '빠른', '귀여운', '멋진', '신비한', '행복한', '똑똑한', '강력한',
  '날쌘', '영리한', '우아한', '활발한', '씩씩한', '재빠른', '명랑한', '당당한',
];

const ANIMALS = [
  '호랑이', '독수리', '여우', '늑대', '펭귄', '토끼', '사자', '곰',
  '매', '표범', '돌고래', '고양이', '강아지', '판다', '코끼리', '기린',
];

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${animal}${num}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface GameApiState {
  // 상태
  sessionId: string;
  playerId: string | null;
  playerName: string;
  gameState: GameStateDTO | null;
  isJoined: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSessionId: (id: string) => void;
  setPlayerName: (name: string) => void;
  join: () => Promise<boolean>;
  fetchState: () => Promise<void>;
  startGame: () => Promise<boolean>;
  submitShot: (data: { prompt: string; targetN: number; similarity: number }) => Promise<{
    success: boolean;
    newPosition?: { x: number; z: number };
    newStroke?: number;
    finished?: boolean;
  }>;
  resetGame: () => Promise<boolean>;
  clearError: () => void;
}

export const useGameApiStore = create<GameApiState>((set, get) => ({
  sessionId: '',
  playerId: null,
  playerName: '',
  gameState: null,
  isJoined: false,
  isLoading: false,
  error: null,

  setSessionId: (id) => set({ sessionId: id }),

  setPlayerName: (name) => set({ playerName: name }),

  join: async () => {
    const { sessionId, playerName } = get();

    if (!sessionId || !playerName.trim()) {
      set({ error: '세션 ID와 이름이 필요합니다.' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: playerName, avatarUrl: null }),
      });

      const data = await res.json();

      if (data.success) {
        set({ playerId: data.playerId, isJoined: true, isLoading: false });
        // 즉시 상태 가져오기
        await get().fetchState();
        return true;
      } else {
        set({ error: data.error || '참가 실패', isLoading: false });
        return false;
      }
    } catch (err) {
      set({ error: '서버 연결 실패', isLoading: false });
      return false;
    }
  },

  fetchState: async () => {
    const { sessionId, isJoined, playerName, playerId } = get();
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/game/state?sessionId=${sessionId}`);
      const data = await res.json();

      if (data.success && data.state) {
        const state = data.state as GameStateDTO;

        // 참가 상태인데 내 플레이어가 서버에 없으면 자동 재참가
        if (isJoined && playerId && playerName) {
          const myPlayerExists = state.players.some((p) => p.id === playerId);
          if (!myPlayerExists) {
            console.log('[GameApi] My player disappeared, auto-rejoining...');
            // isJoined를 false로 설정하고 재참가
            set({ isJoined: false, playerId: null });
            await get().join();
            return;
          }
        }

        set({ gameState: state, error: null });
      }
    } catch (err) {
      // 폴링 실패는 조용히 처리 (네트워크 일시 오류)
      console.warn('[GameApi] Polling failed:', err);
    }
  },

  startGame: async () => {
    const { sessionId } = get();
    if (!sessionId) return false;

    set({ isLoading: true });

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      set({ isLoading: false });

      if (data.success) {
        await get().fetchState();
        return true;
      } else {
        set({ error: data.error });
        return false;
      }
    } catch (err) {
      set({ error: '서버 연결 실패', isLoading: false });
      return false;
    }
  },

  submitShot: async (shotData) => {
    const { sessionId, playerName } = get();
    if (!sessionId) return { success: false };

    try {
      const res = await fetch('/api/game/shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...shotData }),
      });

      const data = await res.json();

      if (data.success) {
        await get().fetchState();
        return {
          success: true,
          newPosition: data.newPosition,
          newStroke: data.newStroke,
          finished: data.finished,
        };
      } else {
        // "플레이어를 찾을 수 없습니다" 오류 시 자동 재참가 시도
        if (data.error?.includes('플레이어를 찾을 수 없습니다') && playerName) {
          console.log('[GameApi] Player not found, attempting auto-rejoin...');
          const rejoined = await get().join();
          if (rejoined) {
            // 재참가 성공 시 샷 다시 시도
            return get().submitShot(shotData);
          }
        }
        set({ error: data.error });
        return { success: false };
      }
    } catch (err) {
      set({ error: '서버 연결 실패' });
      return { success: false };
    }
  },

  resetGame: async () => {
    const { sessionId, playerName } = get();
    if (!sessionId) return false;

    try {
      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (data.success) {
        await get().fetchState();
        return true;
      } else {
        // "플레이어를 찾을 수 없습니다" 오류 시 자동 재참가 시도
        if (data.error?.includes('플레이어를 찾을 수 없습니다') && playerName) {
          console.log('[GameApi] Player not found on reset, auto-rejoining...');
          const rejoined = await get().join();
          if (rejoined) {
            return get().resetGame();
          }
        }
        set({ error: data.error });
        return false;
      }
    } catch (err) {
      set({ error: '서버 연결 실패' });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 게임 상태 폴링 훅
 * @param intervalMs 폴링 간격 (기본 2초)
 * @param enabled 폴링 활성화 여부
 */
export function useGamePolling(intervalMs = 2000, enabled = true) {
  const fetchState = useGameApiStore((s) => s.fetchState);
  const isJoined = useGameApiStore((s) => s.isJoined);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !isJoined) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 즉시 한 번 가져오기
    fetchState();

    // 주기적 폴링
    intervalRef.current = setInterval(fetchState, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isJoined, intervalMs, fetchState]);
}

/**
 * 세션 ID 초기화 훅
 */
export function useSessionInit() {
  const setSessionId = useGameApiStore((s) => s.setSessionId);
  const sessionId = useGameApiStore((s) => s.sessionId);

  useEffect(() => {
    if (!sessionId) {
      const id = getOrCreateSessionId();
      setSessionId(id);
    }
  }, [sessionId, setSessionId]);

  return sessionId;
}

/**
 * 내 플레이어 정보 가져오기
 */
export function useMyPlayer(): PlayerDTO | null {
  const gameState = useGameApiStore((s) => s.gameState);
  const playerId = useGameApiStore((s) => s.playerId);

  if (!gameState || !playerId) return null;

  return gameState.players.find((p) => p.id === playerId) ?? null;
}

/**
 * 다른 플레이어들 정보 가져오기
 */
export function useOtherPlayers(): PlayerDTO[] {
  const gameState = useGameApiStore((s) => s.gameState);
  const playerId = useGameApiStore((s) => s.playerId);

  if (!gameState) return [];

  return gameState.players.filter((p) => p.id !== playerId);
}

/**
 * 호스트 여부 확인
 */
export function useIsHost(): boolean {
  const myPlayer = useMyPlayer();
  return myPlayer?.isHost ?? false;
}
