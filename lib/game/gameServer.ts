/**
 * 게임 서버 상태 관리 (메모리 기반)
 *
 * REST API용 서버 사이드 게임 상태를 관리합니다.
 * 개발 환경에서는 메모리에 저장, 프로덕션에서는 Redis 등으로 교체 가능.
 */

import type { CoursePosition, Shot, LandingZone } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  avatarUrl: string | null;
  currentStroke: number;
  ballPosition: CoursePosition;
  totalDistance: number;
  score: number;
  finished: boolean;
  lastSeen: number; // 마지막 활동 시간 (폴링 기반 연결 감지)
  isHost: boolean;
}

export interface GameRoom {
  id: string;
  name: string;
  players: Map<string, Player>; // sessionId → Player
  status: 'waiting' | 'playing' | 'finished';
  currentHole: number;
  createdAt: number;
  lastActivity: number;
}

export interface PlayerDTO {
  id: string;
  sessionId: string;
  name: string;
  avatarUrl: string | null;
  currentStroke: number;
  ballPosition: CoursePosition;
  totalDistance: number;
  score: number;
  finished: boolean;
  isHost: boolean;
  online: boolean;
}

export interface GameStateDTO {
  roomId: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerDTO[];
  currentHole: number;
  myPlayerId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global State (메모리 저장)
// ─────────────────────────────────────────────────────────────────────────────

// 메인 방 (항상 존재)
const MAIN_ROOM_ID = 'main-room';
let mainRoom: GameRoom | null = null;

// 플레이어 온라인 판정 시간 (5초 이내 폴링하면 온라인)
const ONLINE_THRESHOLD_MS = 5000;

// 비활성 플레이어 정리 시간 (10분)
const INACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function getOrCreateMainRoom(): GameRoom {
  if (!mainRoom) {
    mainRoom = {
      id: MAIN_ROOM_ID,
      name: 'Prompt Golf',
      players: new Map(),
      status: 'playing',  // 게임은 항상 진행 중 상태
      currentHole: 1,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
  }
  return mainRoom;
}

function playerToDTO(player: Player): PlayerDTO {
  const now = Date.now();
  return {
    id: player.id,
    sessionId: player.sessionId,
    name: player.name,
    avatarUrl: player.avatarUrl,
    currentStroke: player.currentStroke,
    ballPosition: player.ballPosition,
    totalDistance: player.totalDistance,
    score: player.score,
    finished: player.finished,
    isHost: player.isHost,
    online: now - player.lastSeen < ONLINE_THRESHOLD_MS,
  };
}

function cleanupInactivePlayers(room: GameRoom): void {
  const now = Date.now();
  const toRemove: string[] = [];

  const entries = Array.from(room.players.entries());
  for (const [sessionId, player] of entries) {
    if (now - player.lastSeen > INACTIVE_THRESHOLD_MS) {
      toRemove.push(sessionId);
    }
  }

  for (const sessionId of toRemove) {
    room.players.delete(sessionId);
    console.log(`[GameServer] Removed inactive player: ${sessionId}`);
  }

  // 호스트가 없으면 다음 플레이어를 호스트로
  const players = Array.from(room.players.values());
  if (players.length > 0 && !players.some((p) => p.isHost)) {
    players[0].isHost = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 게임 참가 (메인 방에 자동 참가)
 */
export function joinGame(
  sessionId: string,
  name: string,
  avatarUrl: string | null
): { success: true; playerId: string } | { success: false; error: string } {
  const room = getOrCreateMainRoom();
  cleanupInactivePlayers(room);

  // 기존 플레이어 찾기
  let player = room.players.get(sessionId);

  if (player) {
    // 재접속: 이름/아바타 업데이트
    player.name = name;
    player.avatarUrl = avatarUrl;
    player.lastSeen = Date.now();
    console.log(`[GameServer] Player reconnected: ${name} (${sessionId.slice(0, 8)}...)`);
  } else {
    // 새 플레이어
    const isHost = room.players.size === 0;
    player = {
      id: generateId(),
      sessionId,
      name,
      avatarUrl,
      currentStroke: 0,
      ballPosition: { x: 0, z: 0 },
      totalDistance: 0,
      score: 0,
      finished: false,
      lastSeen: Date.now(),
      isHost,
    };
    room.players.set(sessionId, player);
    console.log(`[GameServer] New player joined: ${name} (${room.players.size} total)`);
  }

  room.lastActivity = Date.now();

  return { success: true, playerId: player.id };
}

/**
 * 게임 상태 조회 (폴링)
 * @param sessionId 플레이어 세션 ID
 * @param adminMode true면 플레이어 lastSeen 업데이트 안 함 (관찰자 모드)
 */
export function getGameState(sessionId: string, adminMode = false): GameStateDTO | null {
  const room = getOrCreateMainRoom();
  cleanupInactivePlayers(room);

  // adminMode가 아닐 때만 폴링한 플레이어의 lastSeen 업데이트
  const player = adminMode ? null : room.players.get(sessionId);
  if (player) {
    player.lastSeen = Date.now();
  }

  const players = Array.from(room.players.values()).map(playerToDTO);

  return {
    roomId: room.id,
    roomName: room.name,
    status: room.status,
    players,
    currentHole: room.currentHole,
    myPlayerId: player?.id ?? null,
  };
}

/**
 * 게임 시작 (호스트 또는 참가한 플레이어)
 * @param adminMode true면 플레이어 체크 건너뜀 (Admin 전용)
 */
export function startGame(
  sessionId: string,
  adminMode = false
): { success: true } | { success: false; error: string } {
  const room = getOrCreateMainRoom();
  const player = room.players.get(sessionId);

  // adminMode가 아니면 플레이어 체크만 (호스트 체크 생략 - 누구나 시작 가능)
  if (!adminMode) {
    if (!player) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }
    // 호스트 체크 제거 - 참가한 플레이어는 누구나 게임 시작 가능
  }

  if (room.status !== 'waiting') {
    // 이미 playing 상태면 성공으로 처리 (중복 시작 요청 허용)
    if (room.status === 'playing') {
      return { success: true };
    }
    return { success: false, error: '게임이 이미 완료되었습니다.' };
  }

  // 모든 플레이어 초기화
  const players = Array.from(room.players.values());
  for (const p of players) {
    p.currentStroke = 0;
    p.ballPosition = { x: 0, z: 0 };
    p.totalDistance = 0;
    p.score = 0;
    p.finished = false;
  }

  room.status = 'playing';
  room.lastActivity = Date.now();

  console.log(`[GameServer] Game started by ${adminMode ? 'Admin' : player?.name}`);

  return { success: true };
}

/**
 * 샷 제출
 */
export function submitShot(
  sessionId: string,
  data: {
    prompt: string;
    targetN: number;
    similarity: number;
  }
): {
  success: true;
  newPosition: CoursePosition;
  newStroke: number;
  newTotalDistance: number;
  finished: boolean;
} | { success: false; error: string } {
  const room = getOrCreateMainRoom();
  const player = room.players.get(sessionId);

  if (!player) {
    return { success: false, error: '플레이어를 찾을 수 없습니다.' };
  }

  if (room.status !== 'playing') {
    return { success: false, error: '게임이 진행 중이 아닙니다.' };
  }

  if (player.finished) {
    return { success: false, error: '이미 홀을 완료했습니다.' };
  }

  // 샷 결과 계산 (서버 권위적)
  const { similarity } = data;

  // 유사도 기반 거리 계산 (0-100% → 0-100m)
  const shotDistance = similarity * 100;

  // 측면 편차 (유사도가 낮을수록 큼)
  const lateralDeviation = (1 - similarity) * 30 * (Math.random() > 0.5 ? 1 : -1);

  // 새 위치 계산
  const FLAG_Z = 380;
  const oldZ = player.ballPosition.z;
  const newZ = Math.min(oldZ + shotDistance, FLAG_Z);
  const newX = player.ballPosition.x + lateralDeviation;

  // 홀 완료 판정 (깃발 근처 10m 이내)
  const distanceToFlag = Math.sqrt(
    Math.pow(newX - (-15), 2) + Math.pow(newZ - FLAG_Z, 2)
  );
  const finished = distanceToFlag < 15;

  // 상태 업데이트
  player.currentStroke += 1;
  player.ballPosition = { x: newX, z: newZ };
  player.totalDistance += shotDistance;
  player.finished = finished;
  player.lastSeen = Date.now();

  if (finished) {
    // 파 4 기준 스코어 계산
    player.score = player.currentStroke - 4;
    console.log(`[GameServer] ${player.name} finished hole in ${player.currentStroke} strokes`);
  }

  room.lastActivity = Date.now();

  // 모든 플레이어가 완료했는지 확인
  const allFinished = Array.from(room.players.values()).every((p) => p.finished);
  if (allFinished) {
    room.status = 'finished';
    console.log(`[GameServer] All players finished!`);
  }

  return {
    success: true,
    newPosition: player.ballPosition,
    newStroke: player.currentStroke,
    newTotalDistance: player.totalDistance,
    finished: player.finished,
  };
}

/**
 * 게임 리셋 (호스트 또는 Admin)
 * @param adminMode true면 호스트 체크 건너뜀
 */
export function resetGame(
  sessionId: string,
  adminMode = false
): { success: true } | { success: false; error: string } {
  const room = getOrCreateMainRoom();
  const player = room.players.get(sessionId);

  // adminMode가 아니면 플레이어 및 호스트 체크
  if (!adminMode) {
    if (!player) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    if (!player.isHost) {
      return { success: false, error: '호스트만 게임을 리셋할 수 있습니다.' };
    }
  }

  // 모든 플레이어 초기화
  const players = Array.from(room.players.values());
  for (const p of players) {
    p.currentStroke = 0;
    p.ballPosition = { x: 0, z: 0 };
    p.totalDistance = 0;
    p.score = 0;
    p.finished = false;
  }

  // 리셋 후 바로 playing 상태로 시작 (별도 시작 버튼 불필요)
  room.status = 'playing';
  room.lastActivity = Date.now();

  console.log(`[GameServer] Game reset and auto-started by ${adminMode ? 'Admin' : player?.name}`);

  return { success: true };
}

/**
 * 플레이어 나가기
 */
export function leaveGame(sessionId: string): { success: true } {
  const room = getOrCreateMainRoom();
  const player = room.players.get(sessionId);

  if (player) {
    room.players.delete(sessionId);
    console.log(`[GameServer] Player left: ${player.name}`);

    // 호스트가 나갔으면 다음 플레이어를 호스트로
    if (player.isHost) {
      const remaining = Array.from(room.players.values());
      if (remaining.length > 0) {
        remaining[0].isHost = true;
      }
    }
  }

  return { success: true };
}
