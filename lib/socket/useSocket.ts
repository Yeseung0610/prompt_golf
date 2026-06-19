'use client';

/**
 * Socket.io 클라이언트 연결 관리
 *
 * Zustand store로 전역 소켓 상태를 관리합니다.
 */

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomDTO,
  PlayerDTO,
  GameStateSyncData,
  ShotResultData,
} from '@/server/socket/types';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketState {
  /** Socket.io 인스턴스 */
  socket: ClientSocket | null;
  /** 연결 상태 */
  connected: boolean;
  /** 연결 중 */
  connecting: boolean;
  /** 현재 방 정보 */
  room: RoomDTO | null;
  /** 내 플레이어 ID */
  myPlayerId: string | null;
  /** 에러 메시지 */
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;

  // Room Actions
  /** 메인 방에 자동 참가 (코드 입력 없이, 세션 ID로 플레이어 식별) */
  autoJoin: (playerName: string, avatarUrl?: string, sessionId?: string) => Promise<RoomDTO | null>;
  /** 방 생성 (호환성 유지) */
  createRoom: (playerName: string, avatarUrl?: string, roomName?: string) => Promise<RoomDTO | null>;
  /** 방 참가 (호환성 유지) */
  joinRoom: (code: string, playerName: string, avatarUrl?: string) => Promise<RoomDTO | null>;
  leaveRoom: () => Promise<boolean>;

  // Game Actions
  startGame: () => Promise<boolean>;
  submitShot: (data: {
    prompt: string;
    targetN: number;
    similarity: number;
    generatedHtml: string | null;
    screenshotUrl: string | null;
  }) => Promise<{
    success: boolean;
    shot?: any;
    newPosition?: { x: number; z: number };
    newTotalDistance?: number;
    finished?: boolean;
  }>;

  // Internal
  _setRoom: (room: RoomDTO | null) => void;
  _setError: (error: string | null) => void;
  _updatePlayers: (players: PlayerDTO[]) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  connecting: false,
  room: null,
  myPlayerId: null,
  error: null,

  connect: () => {
    const { socket, connected, connecting } = get();

    if (socket || connected || connecting) return;

    set({ connecting: true, error: null });

    const newSocket: ClientSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      set({ connected: true, connecting: false });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      set({ connected: false });
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      set({ connecting: false, error: `연결 실패: ${err.message}` });
    });

    // Room events
    newSocket.on('room:player-joined', ({ player }) => {
      const { room } = get();
      if (room) {
        set({
          room: {
            ...room,
            players: [...room.players, player],
          },
        });
      }
    });

    newSocket.on('room:player-left', ({ playerId, newHostId }) => {
      const { room } = get();
      if (room) {
        const updatedPlayers = room.players
          .filter((p) => p.id !== playerId)
          .map((p) => ({
            ...p,
            isHost: newHostId ? p.id === newHostId : p.isHost,
          }));

        set({
          room: {
            ...room,
            players: updatedPlayers,
          },
        });
      }
    });

    // Game events
    newSocket.on('game:state-sync', (data: GameStateSyncData) => {
      const { room } = get();
      if (room) {
        set({
          room: {
            ...room,
            players: data.players,
            status: data.roomStatus,
          },
        });
      }
    });

    newSocket.on('game:started', () => {
      const { room } = get();
      if (room) {
        set({
          room: {
            ...room,
            status: 'playing',
          },
        });
      }
    });

    newSocket.on('game:finished', ({ finalScores }) => {
      const { room } = get();
      if (room) {
        set({
          room: {
            ...room,
            status: 'finished',
            players: finalScores,
          },
        });
      }
    });

    newSocket.on('error', ({ message }) => {
      set({ error: message });
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({
        socket: null,
        connected: false,
        connecting: false,
        room: null,
        myPlayerId: null,
      });
    }
  },

  autoJoin: async (playerName, avatarUrl, sessionId) => {
    const { socket, connected } = get();
    if (!socket || !connected) {
      set({ error: '서버에 연결되지 않았습니다.' });
      return null;
    }

    return new Promise((resolve) => {
      socket.emit(
        'room:auto-join',
        { playerName, avatarUrl, sessionId },
        (response) => {
          if (response.success && response.room && response.playerId) {
            set({
              room: response.room,
              myPlayerId: response.playerId,
              error: null,
            });
            resolve(response.room);
          } else {
            set({ error: response.error || '자동 참가 실패' });
            resolve(null);
          }
        }
      );
    });
  },

  createRoom: async (playerName, avatarUrl, roomName) => {
    const { socket, connected } = get();
    if (!socket || !connected) {
      set({ error: '서버에 연결되지 않았습니다.' });
      return null;
    }

    return new Promise((resolve) => {
      socket.emit(
        'room:create',
        { playerName, avatarUrl, roomName },
        (response) => {
          if (response.success && response.room && response.playerId) {
            set({
              room: response.room,
              myPlayerId: response.playerId,
              error: null,
            });
            resolve(response.room);
          } else {
            set({ error: response.error || '방 생성 실패' });
            resolve(null);
          }
        }
      );
    });
  },

  joinRoom: async (code, playerName, avatarUrl) => {
    const { socket, connected } = get();
    if (!socket || !connected) {
      set({ error: '서버에 연결되지 않았습니다.' });
      return null;
    }

    return new Promise((resolve) => {
      socket.emit(
        'room:join',
        { code, playerName, avatarUrl },
        (response) => {
          if (response.success && response.room && response.playerId) {
            set({
              room: response.room,
              myPlayerId: response.playerId,
              error: null,
            });
            resolve(response.room);
          } else {
            set({ error: response.error || '방 참가 실패' });
            resolve(null);
          }
        }
      );
    });
  },

  leaveRoom: async () => {
    const { socket, connected } = get();
    if (!socket || !connected) return false;

    return new Promise((resolve) => {
      socket.emit('room:leave', (response) => {
        if (response.success) {
          set({ room: null, myPlayerId: null, error: null });
          resolve(true);
        } else {
          set({ error: response.error || '방 나가기 실패' });
          resolve(false);
        }
      });
    });
  },

  startGame: async () => {
    const { socket, connected } = get();
    if (!socket || !connected) {
      set({ error: '서버에 연결되지 않았습니다.' });
      return false;
    }

    return new Promise((resolve) => {
      socket.emit('game:start', (response) => {
        if (response.success) {
          set({ error: null });
          resolve(true);
        } else {
          set({ error: response.error || '게임 시작 실패' });
          resolve(false);
        }
      });
    });
  },

  submitShot: async (data) => {
    const { socket, connected } = get();
    if (!socket || !connected) {
      return { success: false };
    }

    return new Promise((resolve) => {
      socket.emit('game:submit-shot', data, (response) => {
        resolve({
          success: response.success,
          shot: response.shot,
          newPosition: response.newPosition,
          newTotalDistance: response.newTotalDistance,
          finished: response.finished,
        });
      });
    });
  },

  _setRoom: (room) => set({ room }),
  _setError: (error) => set({ error }),
  _updatePlayers: (players) => {
    const { room } = get();
    if (room) {
      set({ room: { ...room, players } });
    }
  },
}));

/**
 * Socket 연결 훅
 * 컴포넌트 마운트 시 자동 연결
 */
export function useSocketConnection() {
  const connect = useSocketStore((s) => s.connect);
  const connected = useSocketStore((s) => s.connected);
  const connecting = useSocketStore((s) => s.connecting);
  const error = useSocketStore((s) => s.error);

  return { connect, connected, connecting, error };
}

/**
 * 방 상태 훅
 */
export function useRoom() {
  const room = useSocketStore((s) => s.room);
  const myPlayerId = useSocketStore((s) => s.myPlayerId);
  const autoJoin = useSocketStore((s) => s.autoJoin);
  const createRoom = useSocketStore((s) => s.createRoom);
  const joinRoom = useSocketStore((s) => s.joinRoom);
  const leaveRoom = useSocketStore((s) => s.leaveRoom);
  const startGame = useSocketStore((s) => s.startGame);

  const myPlayer = room?.players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.isHost ?? false;
  const otherPlayers = room?.players.filter((p) => p.id !== myPlayerId) ?? [];

  return {
    room,
    myPlayerId,
    myPlayer,
    isHost,
    otherPlayers,
    autoJoin,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
  };
}
