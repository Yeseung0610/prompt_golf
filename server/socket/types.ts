/**
 * Socket.io 멀티플레이어 타입 정의
 *
 * io 게임 스타일 실시간 동기화를 위한 프로토콜
 */

import type { CoursePosition, Shot, Hole, Target } from '@/lib/game/types';

// ─────────────────────────────────────────────────────────────────────────────
// Player & Room
// ─────────────────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  socketId: string;
  /** 브라우저 세션 ID (재접속 시 동일 플레이어 식별용) */
  sessionId: string;
  name: string;
  avatarUrl: string | null;
  /** 현재 타수 */
  currentStroke: number;
  /** 공 위치 */
  ballPosition: CoursePosition;
  /** 총 이동 거리 */
  totalDistance: number;
  /** 파 대비 스코어 */
  score: number;
  /** 홀 완료 여부 */
  finished: boolean;
  /** 접속 상태 */
  connected: boolean;
  /** 호스트 여부 */
  isHost: boolean;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  /** 6자리 참가 코드 */
  code: string;
  /** 방 이름 */
  name: string;
  /** 플레이어 맵 (socketId → Player) */
  players: Map<string, Player>;
  /** 현재 게임 상태 */
  gameState: ServerGameState;
  /** 방 상태 */
  status: RoomStatus;
  /** 생성 시간 */
  createdAt: number;
  /** 호스트 socket ID */
  hostSocketId: string;
  /** 최대 플레이어 수 */
  maxPlayers: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Game State (Server-side)
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerGameState {
  /** 현재 홀 정보 */
  hole: Hole;
  /** 타겟 이미지 목록 */
  targets: Target[];
  /** 현재 턴 플레이어 ID (null = 모두 동시 플레이) */
  currentTurnPlayerId: string | null;
  /** 샷 히스토리 */
  shots: Shot[];
  /** 게임 시작 시간 */
  startedAt: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket Events: Client → Server
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** 메인 방 자동 참가 (코드 입력 없이, sessionId로 플레이어 식별) */
  'room:auto-join': (
    data: { playerName: string; avatarUrl?: string; sessionId?: string },
    callback: (response: RoomResponse) => void
  ) => void;

  /** 방 생성 (호환성 유지) */
  'room:create': (
    data: { playerName: string; avatarUrl?: string; roomName?: string },
    callback: (response: RoomResponse) => void
  ) => void;

  /** 방 참가 (호환성 유지) */
  'room:join': (
    data: { code: string; playerName: string; avatarUrl?: string },
    callback: (response: RoomResponse) => void
  ) => void;

  /** 방 나가기 */
  'room:leave': (callback: (response: BaseResponse) => void) => void;

  /** 게임 시작 (호스트만) */
  'game:start': (callback: (response: BaseResponse) => void) => void;

  /** 샷 제출 */
  'game:submit-shot': (
    data: SubmitShotData,
    callback: (response: ShotResponse) => void
  ) => void;

  /** 플레이어 상태 업데이트 (공 위치 등) */
  'player:update': (data: PlayerUpdateData) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket Events: Server → Client
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** 플레이어 입장 알림 */
  'room:player-joined': (data: { player: PlayerDTO }) => void;

  /** 플레이어 퇴장 알림 */
  'room:player-left': (data: { playerId: string; newHostId?: string }) => void;

  /** 전체 상태 동기화 */
  'game:state-sync': (data: GameStateSyncData) => void;

  /** 샷 결과 브로드캐스트 */
  'game:shot-result': (data: ShotResultData) => void;

  /** 게임 시작 알림 */
  'game:started': (data: { targets: Target[] }) => void;

  /** 게임 종료 */
  'game:finished': (data: { finalScores: PlayerDTO[] }) => void;

  /** 에러 알림 */
  'error': (data: { message: string; code?: string }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request/Response Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface RoomResponse extends BaseResponse {
  room?: RoomDTO;
  playerId?: string;
}

export interface ShotResponse extends BaseResponse {
  shot?: Shot;
  newPosition?: CoursePosition;
  newTotalDistance?: number;
  finished?: boolean;
}

export interface SubmitShotData {
  prompt: string;
  targetN: number;
  similarity: number;
  generatedHtml: string | null;
  screenshotUrl: string | null;
}

export interface PlayerUpdateData {
  ballPosition?: CoursePosition;
  totalDistance?: number;
}

export interface GameStateSyncData {
  players: PlayerDTO[];
  gameState: ServerGameState;
  roomStatus: RoomStatus;
}

export interface ShotResultData {
  playerId: string;
  shot: Shot;
  newPosition: CoursePosition;
  newTotalDistance: number;
  finished: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs (Data Transfer Objects)
// ─────────────────────────────────────────────────────────────────────────────

/** 클라이언트로 전송할 Player 데이터 */
export interface PlayerDTO {
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
}

/** 클라이언트로 전송할 Room 데이터 */
export interface RoomDTO {
  id: string;
  code: string;
  name: string;
  players: PlayerDTO[];
  status: RoomStatus;
  maxPlayers: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────────────────────

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  playerId: string;
  roomId: string | null;
}
