/**
 * Socket.io 서버 설정
 *
 * Next.js 커스텀 서버와 통합되어 WebSocket 연결을 처리합니다.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  Room,
  Player,
  ServerGameState,
  PlayerDTO,
  RoomDTO,
} from './types';
import { setupRoomHandlers } from './handlers/roomHandler';
import { setupGameHandlers } from './handlers/gameHandler';

/** 기본 홀 정보 */
const DEFAULT_HOLE = {
  id: 1,
  par: 4,
  distance: 395,
  flagPosition: { x: -15, z: 380 },
  teePosition: { x: 0, z: 0 },
  windSpeed: 5,
  windDirection: 45,
  difficulty: 'medium',
};

/** 활성 방 저장소 */
export const rooms = new Map<string, Room>();

/** Socket ID → Room ID 매핑 */
export const socketToRoom = new Map<string, string>();

/** 메인 방 ID (서버 시작 시 자동 생성) */
export const MAIN_ROOM_ID = 'main-room';
export const MAIN_ROOM_CODE = 'MAIN';

/**
 * 메인 방 가져오기 (없으면 생성)
 */
export function getOrCreateMainRoom(): Room {
  let mainRoom = rooms.get(MAIN_ROOM_ID);

  if (!mainRoom) {
    const gameState: ServerGameState = {
      hole: DEFAULT_HOLE,
      targets: [],
      currentTurnPlayerId: null,
      shots: [],
      startedAt: null,
    };

    mainRoom = {
      id: MAIN_ROOM_ID,
      code: MAIN_ROOM_CODE,
      name: 'Prompt Golf',
      players: new Map(),
      gameState,
      status: 'waiting',
      createdAt: Date.now(),
      hostSocketId: '',
      maxPlayers: 16, // 메인 방은 더 많은 플레이어 허용
    };

    rooms.set(MAIN_ROOM_ID, mainRoom);
    console.log('[Socket] Main room created');
  }

  return mainRoom;
}

/**
 * 6자리 랜덤 방 코드 생성 (더 이상 사용하지 않지만 호환성 유지)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 중복 체크
  const roomsArray = Array.from(rooms.values());
  for (const room of roomsArray) {
    if (room.code === code) {
      return generateRoomCode();
    }
  }
  return code;
}

/**
 * 고유 ID 생성
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Player → PlayerDTO 변환
 */
export function toPlayerDTO(player: Player): PlayerDTO {
  return {
    id: player.id,
    name: player.name,
    avatarUrl: player.avatarUrl,
    currentStroke: player.currentStroke,
    ballPosition: player.ballPosition,
    totalDistance: player.totalDistance,
    score: player.score,
    finished: player.finished,
    connected: player.connected,
    isHost: player.isHost,
  };
}

/**
 * Room → RoomDTO 변환
 */
export function toRoomDTO(room: Room): RoomDTO {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    players: Array.from(room.players.values()).map(toPlayerDTO),
    status: room.status,
    maxPlayers: room.maxPlayers,
  };
}

/**
 * 새 플레이어 생성
 */
export function createPlayer(
  socketId: string,
  sessionId: string,
  name: string,
  avatarUrl: string | null,
  isHost: boolean
): Player {
  return {
    id: generateId(),
    socketId,
    sessionId,
    name,
    avatarUrl,
    currentStroke: 0,
    ballPosition: { x: 0, z: 0 },
    totalDistance: 0,
    score: 0,
    finished: false,
    connected: true,
    isHost,
  };
}

/**
 * 새 방 생성
 */
export function createRoom(hostSocketId: string, hostPlayer: Player, roomName?: string): Room {
  const roomId = generateId();
  const code = generateRoomCode();

  const gameState: ServerGameState = {
    hole: DEFAULT_HOLE,
    targets: [],
    currentTurnPlayerId: null,
    shots: [],
    startedAt: null,
  };

  const room: Room = {
    id: roomId,
    code,
    name: roomName || `${hostPlayer.name}의 방`,
    players: new Map([[hostSocketId, hostPlayer]]),
    gameState,
    status: 'waiting',
    createdAt: Date.now(),
    hostSocketId,
    maxPlayers: 8,
  };

  return room;
}

/**
 * Socket.io 서버 초기화
 */
export function initializeSocketServer(
  httpServer: HttpServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // 초기 데이터 설정
    socket.data.playerId = '';
    socket.data.roomId = null;

    // 핸들러 설정
    setupRoomHandlers(io, socket);
    setupGameHandlers(io, socket);

    // 연결 해제 처리
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);

      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const player = room.players.get(socket.id);
          if (player) {
            // 플레이어를 비연결 상태로 표시 (잠시 후 재접속 가능)
            player.connected = false;

            // 호스트가 나갔으면 다른 사람에게 호스트 이전
            if (player.isHost) {
              const connectedPlayers = Array.from(room.players.values())
                .filter((p) => p.connected && p.id !== player.id);

              if (connectedPlayers.length > 0) {
                const newHost = connectedPlayers[0];
                newHost.isHost = true;
                player.isHost = false;
                room.hostSocketId = newHost.socketId;

                // 호스트 변경 알림
                socket.to(roomId).emit('room:player-left', {
                  playerId: player.id,
                  newHostId: newHost.id,
                });
              } else {
                // 모든 플레이어가 나감 - 방 삭제
                rooms.delete(roomId);
              }
            } else {
              socket.to(roomId).emit('room:player-left', { playerId: player.id });
            }
          }
        }
        socketToRoom.delete(socket.id);
      }
    });
  });

  // 주기적으로 빈 방 정리 (10분마다)
  setInterval(() => {
    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;

    const roomEntries = Array.from(rooms.entries());
    for (const [roomId, room] of roomEntries) {
      const hasConnectedPlayers = Array.from(room.players.values())
        .some((p) => p.connected);

      if (!hasConnectedPlayers && now - room.createdAt > TEN_MINUTES) {
        console.log(`[Socket] Cleaning up empty room: ${roomId}`);
        rooms.delete(roomId);
      }
    }
  }, 10 * 60 * 1000);

  // 서버 시작 시 메인 방 생성
  getOrCreateMainRoom();

  console.log('[Socket] Socket.io server initialized');

  return io;
}
