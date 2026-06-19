/**
 * 방 관리 이벤트 핸들러
 *
 * - room:create: 새 방 생성
 * - room:join: 방 참가
 * - room:leave: 방 나가기
 */

import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types';
import {
  rooms,
  socketToRoom,
  createRoom,
  createPlayer,
  toRoomDTO,
  toPlayerDTO,
  getOrCreateMainRoom,
  MAIN_ROOM_ID,
} from '../SocketServer';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * 방 코드로 방 찾기
 */
function findRoomByCode(code: string) {
  const upperCode = code.toUpperCase();
  const roomsArray = Array.from(rooms.values());
  for (const room of roomsArray) {
    if (room.code === upperCode) {
      return room;
    }
  }
  return null;
}

export function setupRoomHandlers(io: IOServer, socket: IOSocket): void {
  /**
   * 메인 방에 자동 참가 (코드 입력 없이, sessionId로 플레이어 식별)
   */
  socket.on('room:auto-join', (data, callback) => {
    const { playerName, avatarUrl, sessionId } = data;
    const effectiveSessionId = sessionId || socket.id; // sessionId 없으면 socket.id 사용

    // 이미 이 소켓이 방에 있으면 기존 정보 반환
    const existingRoomId = socketToRoom.get(socket.id);
    if (existingRoomId) {
      const existingRoom = rooms.get(existingRoomId);
      if (existingRoom) {
        const existingPlayer = existingRoom.players.get(socket.id);
        if (existingPlayer) {
          // 이름/아바타 업데이트
          existingPlayer.name = playerName;
          existingPlayer.avatarUrl = avatarUrl ?? null;

          callback({
            success: true,
            room: toRoomDTO(existingRoom),
            playerId: existingPlayer.id,
          });
          return;
        }
      }
    }

    // 메인 방 가져오기 (없으면 자동 생성)
    const room = getOrCreateMainRoom();

    // sessionId로 기존 플레이어 찾기 (재접속)
    let existingPlayer: ReturnType<typeof room.players.get> | undefined;
    let oldSocketId: string | undefined;

    const playerEntries = Array.from(room.players.entries());
    for (const [socketId, player] of playerEntries) {
      if (player.sessionId === effectiveSessionId) {
        existingPlayer = player;
        oldSocketId = socketId;
        break;
      }
    }

    let player;

    if (existingPlayer && oldSocketId) {
      // 기존 플레이어 재접속: 소켓 ID 업데이트, 이름/아바타 업데이트
      room.players.delete(oldSocketId);
      socketToRoom.delete(oldSocketId);

      existingPlayer.socketId = socket.id;
      existingPlayer.name = playerName;
      existingPlayer.avatarUrl = avatarUrl ?? null;
      existingPlayer.connected = true;

      room.players.set(socket.id, existingPlayer);
      player = existingPlayer;

      console.log(`[Room] ${playerName} reconnected to main room (session: ${effectiveSessionId.slice(0, 8)}...)`);
    } else {
      // 새 플레이어
      const isHost = room.players.size === 0;
      player = createPlayer(socket.id, effectiveSessionId, playerName, avatarUrl ?? null, isHost);

      if (isHost) {
        room.hostSocketId = socket.id;
      }

      room.players.set(socket.id, player);

      console.log(`[Room] ${playerName} joined main room (${room.players.size} players)`);

      // 다른 플레이어들에게 알림 (재접속이 아닌 경우만)
      socket.to(room.id).emit('room:player-joined', {
        player: toPlayerDTO(player),
      });
    }

    socketToRoom.set(socket.id, room.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;

    // Socket.io 룸 참가
    socket.join(room.id);

    callback({
      success: true,
      room: toRoomDTO(room),
      playerId: player.id,
    });
  });

  /**
   * 방 생성 (더 이상 사용하지 않지만 호환성 유지)
   */
  socket.on('room:create', (data, callback) => {
    const { playerName, avatarUrl, roomName } = data;

    // 이미 방에 있으면 에러
    if (socketToRoom.has(socket.id)) {
      callback({ success: false, error: '이미 다른 방에 참가 중입니다.' });
      return;
    }

    // 플레이어 생성 (세션 ID는 소켓 ID 사용)
    const player = createPlayer(socket.id, socket.id, playerName, avatarUrl ?? null, true);

    // 방 생성
    const room = createRoom(socket.id, player, roomName);

    // 저장
    rooms.set(room.id, room);
    socketToRoom.set(socket.id, room.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;

    // Socket.io 룸 참가
    socket.join(room.id);

    console.log(`[Room] Created room ${room.code} by ${playerName}`);

    callback({
      success: true,
      room: toRoomDTO(room),
      playerId: player.id,
    });
  });

  /**
   * 방 참가
   */
  socket.on('room:join', (data, callback) => {
    const { code, playerName, avatarUrl } = data;

    // 이미 방에 있으면 에러
    if (socketToRoom.has(socket.id)) {
      callback({ success: false, error: '이미 다른 방에 참가 중입니다.' });
      return;
    }

    // 방 찾기
    const room = findRoomByCode(code);
    if (!room) {
      callback({ success: false, error: '존재하지 않는 방 코드입니다.' });
      return;
    }

    // 방 상태 체크
    if (room.status !== 'waiting') {
      callback({ success: false, error: '이미 게임이 진행 중인 방입니다.' });
      return;
    }

    // 인원 체크
    const connectedCount = Array.from(room.players.values())
      .filter((p) => p.connected).length;
    if (connectedCount >= room.maxPlayers) {
      callback({ success: false, error: '방이 가득 찼습니다.' });
      return;
    }

    // 플레이어 생성 (세션 ID는 소켓 ID 사용)
    const player = createPlayer(socket.id, socket.id, playerName, avatarUrl ?? null, false);

    // 방에 추가
    room.players.set(socket.id, player);
    socketToRoom.set(socket.id, room.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;

    // Socket.io 룸 참가
    socket.join(room.id);

    console.log(`[Room] ${playerName} joined room ${room.code}`);

    // 다른 플레이어들에게 알림
    socket.to(room.id).emit('room:player-joined', {
      player: toPlayerDTO(player),
    });

    callback({
      success: true,
      room: toRoomDTO(room),
      playerId: player.id,
    });
  });

  /**
   * 방 나가기
   */
  socket.on('room:leave', (callback) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) {
      callback({ success: false, error: '참가 중인 방이 없습니다.' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socketToRoom.delete(socket.id);
      callback({ success: false, error: '방을 찾을 수 없습니다.' });
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      socketToRoom.delete(socket.id);
      callback({ success: false, error: '플레이어를 찾을 수 없습니다.' });
      return;
    }

    // 방에서 제거
    room.players.delete(socket.id);
    socketToRoom.delete(socket.id);
    socket.data.playerId = '';
    socket.data.roomId = null;

    // Socket.io 룸 떠나기
    socket.leave(roomId);

    console.log(`[Room] ${player.name} left room ${room.code}`);

    // 남은 플레이어가 있으면 알림
    const remainingPlayers = Array.from(room.players.values()).filter((p) => p.connected);

    if (remainingPlayers.length === 0) {
      // 빈 방 삭제
      rooms.delete(roomId);
      console.log(`[Room] Deleted empty room ${room.code}`);
    } else {
      // 호스트가 나갔으면 이전
      if (player.isHost) {
        const newHost = remainingPlayers[0];
        newHost.isHost = true;
        room.hostSocketId = newHost.socketId;

        socket.to(roomId).emit('room:player-left', {
          playerId: player.id,
          newHostId: newHost.id,
        });
      } else {
        socket.to(roomId).emit('room:player-left', {
          playerId: player.id,
        });
      }
    }

    callback({ success: true });
  });
}
