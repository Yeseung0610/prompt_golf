'use client';

/**
 * 멀티플레이어 게임 상태 관리
 *
 * 로컬 모드와 멀티플레이어 모드를 통합하여 관리합니다.
 * 멀티플레이어 모드에서는 서버에서 받은 상태를 동기화합니다.
 */

import { create } from 'zustand';
import type { CoursePosition, Hole, Shot, Target, PenaltyEvent } from '@/lib/game/types';
import type { PlayerDTO, RoomDTO, RoomStatus } from '@/server/socket/types';
import { HOLE } from '@/lib/game/data';

export type GameMode = 'local' | 'multiplayer';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  currentStroke: number;
  ballPosition: CoursePosition;
  totalDistance: number;
  score: number;
  finished: boolean;
  connected: boolean;
  isHost: boolean;
  /** 공이 현재 날아가는 중인지 */
  isFlying: boolean;
}

export interface MultiplayerState {
  /** 게임 모드 */
  mode: GameMode;
  /** 현재 방 정보 (멀티플레이어 모드) */
  room: RoomDTO | null;
  /** 내 플레이어 ID */
  myPlayerId: string | null;
  /** 모든 플레이어 (멀티플레이어용) */
  players: MultiplayerPlayer[];
  /** 홀 정보 */
  hole: Hole;
  /** 타겟 이미지 목록 */
  targets: Target[];
  /** 타겟 로드 완료 */
  targetsLoaded: boolean;
  /** 방 상태 */
  roomStatus: RoomStatus | null;
  /** 마지막 샷 */
  lastShot: Shot | null;
  /** 샷 틱 (애니메이션 트리거) */
  shotTick: number;
  /** 마지막 벌타 */
  lastPenalty: PenaltyEvent | null;
  /** 마지막 안전 위치 */
  lastSafePosition: CoursePosition;

  // Selectors
  myPlayer: () => MultiplayerPlayer | undefined;
  otherPlayers: () => MultiplayerPlayer[];
  currentTarget: () => Target | null;
  leaderboard: () => MultiplayerPlayer[];

  // Actions
  setMode: (mode: GameMode) => void;
  setRoom: (room: RoomDTO | null) => void;
  setMyPlayerId: (id: string | null) => void;
  setTargets: (targets: Target[]) => void;

  /** 서버에서 받은 상태로 동기화 */
  syncFromServer: (data: {
    players: PlayerDTO[];
    roomStatus: RoomStatus;
  }) => void;

  /** 다른 플레이어 샷 결과 반영 */
  applyOtherPlayerShot: (
    playerId: string,
    shot: Shot,
    newPosition: CoursePosition,
    newTotalDistance: number,
    finished: boolean
  ) => void;

  /** 내 샷 결과 반영 (로컬 상태 업데이트) */
  applyMyShot: (
    shot: Shot,
    newPosition: CoursePosition,
    newTotalDistance: number,
    finished: boolean
  ) => void;

  /** 플레이어 비행 상태 설정 */
  setPlayerFlying: (playerId: string, isFlying: boolean) => void;

  /** 벌타 적용 */
  applyPenalty: (penalty: PenaltyEvent) => void;
  clearPenalty: () => void;

  /** 리셋 */
  reset: () => void;
}

function playerDTOtoMultiplayer(dto: PlayerDTO): MultiplayerPlayer {
  return {
    ...dto,
    isFlying: false,
  };
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  mode: 'local',
  room: null,
  myPlayerId: null,
  players: [],
  hole: HOLE,
  targets: [],
  targetsLoaded: false,
  roomStatus: null,
  lastShot: null,
  shotTick: 0,
  lastPenalty: null,
  lastSafePosition: { x: 0, z: 0 },

  // Selectors
  myPlayer: () => {
    const { players, myPlayerId } = get();
    return players.find((p) => p.id === myPlayerId);
  },

  otherPlayers: () => {
    const { players, myPlayerId } = get();
    return players.filter((p) => p.id !== myPlayerId);
  },

  currentTarget: () => {
    const me = get().myPlayer();
    const idx = me?.currentStroke ?? 0;
    return get().targets[idx] ?? null;
  },

  leaderboard: () => {
    return [...get().players].sort((a, b) => a.score - b.score);
  },

  // Actions
  setMode: (mode) => set({ mode }),

  setRoom: (room) => {
    if (room) {
      set({
        room,
        roomStatus: room.status,
        players: room.players.map(playerDTOtoMultiplayer),
      });
    } else {
      set({ room: null, roomStatus: null, players: [] });
    }
  },

  setMyPlayerId: (id) => set({ myPlayerId: id }),

  setTargets: (targets) => set({ targets, targetsLoaded: true }),

  syncFromServer: ({ players, roomStatus }) => {
    // 기존 isFlying 상태 유지
    const currentPlayers = get().players;
    const flyingMap = new Map(currentPlayers.map((p) => [p.id, p.isFlying]));

    set({
      players: players.map((dto) => ({
        ...playerDTOtoMultiplayer(dto),
        isFlying: flyingMap.get(dto.id) ?? false,
      })),
      roomStatus,
    });
  },

  applyOtherPlayerShot: (playerId, shot, newPosition, newTotalDistance, finished) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              currentStroke: p.currentStroke + 1,
              ballPosition: newPosition,
              totalDistance: newTotalDistance,
              finished,
              score: finished ? p.currentStroke + 1 - state.hole.par : p.score,
              isFlying: true, // 비행 시작
            }
          : p
      ),
      shotTick: state.shotTick + 1,
    }));
  },

  applyMyShot: (shot, newPosition, newTotalDistance, finished) => {
    const { myPlayerId, hole } = get();
    if (!myPlayerId) return;

    set((state) => ({
      players: state.players.map((p) =>
        p.id === myPlayerId
          ? {
              ...p,
              currentStroke: p.currentStroke + 1,
              ballPosition: newPosition,
              totalDistance: newTotalDistance,
              finished,
              score: finished ? p.currentStroke + 1 - hole.par : p.score,
              isFlying: true,
            }
          : p
      ),
      lastShot: shot,
      shotTick: state.shotTick + 1,
      lastSafePosition: state.myPlayer()?.ballPosition ?? { x: 0, z: 0 },
    }));
  },

  setPlayerFlying: (playerId, isFlying) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, isFlying } : p
      ),
    }));
  },

  applyPenalty: (penalty) => {
    const { myPlayerId } = get();
    if (!myPlayerId) return;

    set((state) => ({
      players: state.players.map((p) =>
        p.id === myPlayerId
          ? {
              ...p,
              currentStroke: p.currentStroke + penalty.strokes,
              ballPosition: penalty.resetPosition,
            }
          : p
      ),
      lastPenalty: penalty,
      shotTick: state.shotTick + 1,
    }));
  },

  clearPenalty: () => set({ lastPenalty: null }),

  reset: () =>
    set({
      players: [],
      lastShot: null,
      shotTick: 0,
      lastPenalty: null,
      lastSafePosition: { x: 0, z: 0 },
    }),
}));
