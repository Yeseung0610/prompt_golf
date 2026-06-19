/**
 * 게임 이벤트 핸들러
 *
 * - game:start: 게임 시작 (호스트만)
 * - game:submit-shot: 샷 제출
 * - player:update: 플레이어 상태 업데이트
 */

import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  PlayerDTO,
} from '../types';
import { rooms, socketToRoom, toPlayerDTO } from '../SocketServer';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** 유사도 헛스윙 임계값 */
const MISS_SWING_THRESHOLD = 0.3;

/** 최대 샷 거리 */
const MAX_SHOT_DISTANCE = 160;

/** 홀 인정 거리 */
const HOLE_RADIUS = 8;

export function setupGameHandlers(io: IOServer, socket: IOSocket): void {
  /**
   * 게임 시작 (호스트만)
   */
  socket.on('game:start', async (callback) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) {
      callback({ success: false, error: '참가 중인 방이 없습니다.' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: '방을 찾을 수 없습니다.' });
      return;
    }

    // 호스트 체크
    if (room.hostSocketId !== socket.id) {
      callback({ success: false, error: '호스트만 게임을 시작할 수 있습니다.' });
      return;
    }

    // 이미 시작됨
    if (room.status !== 'waiting') {
      callback({ success: false, error: '이미 게임이 진행 중입니다.' });
      return;
    }

    // 최소 인원 체크 (1인 테스트 허용)
    const connectedPlayers = Array.from(room.players.values())
      .filter((p) => p.connected);

    if (connectedPlayers.length < 1) {
      callback({ success: false, error: '최소 1명의 플레이어가 필요합니다.' });
      return;
    }

    // 타겟 이미지 로드 (실제로는 API 호출)
    // 서버에서 직접 파일 시스템 접근이 어려우므로 클라이언트에서 이미 로드된 것을 가정
    // 또는 별도 API를 통해 로드

    // 게임 상태 업데이트
    room.status = 'playing';
    room.gameState.startedAt = Date.now();

    // 모든 플레이어 초기화
    const playersArray = Array.from(room.players.values());
    for (const player of playersArray) {
      player.currentStroke = 0;
      player.ballPosition = { x: 0, z: 0 };
      player.totalDistance = 0;
      player.score = 0;
      player.finished = false;
    }

    console.log(`[Game] Game started in room ${room.code}`);

    // 모든 클라이언트에게 게임 시작 알림
    io.to(roomId).emit('game:started', {
      targets: room.gameState.targets,
    });

    // 전체 상태 동기화
    io.to(roomId).emit('game:state-sync', {
      players: Array.from(room.players.values()).map(toPlayerDTO),
      gameState: room.gameState,
      roomStatus: room.status,
    });

    callback({ success: true });
  });

  /**
   * 샷 제출
   */
  socket.on('game:submit-shot', (data, callback) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) {
      callback({ success: false, error: '참가 중인 방이 없습니다.' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: '방을 찾을 수 없습니다.' });
      return;
    }

    if (room.status !== 'playing') {
      callback({ success: false, error: '게임이 진행 중이 아닙니다.' });
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      callback({ success: false, error: '플레이어를 찾을 수 없습니다.' });
      return;
    }

    if (player.finished) {
      callback({ success: false, error: '이미 홀을 완료했습니다.' });
      return;
    }

    const { prompt, targetN, similarity, generatedHtml, screenshotUrl } = data;
    const hole = room.gameState.hole;

    // 샷 계산 (서버 권위적)
    const isMissSwing = similarity < MISS_SWING_THRESHOLD;
    const power = isMissSwing ? 0.04 : Math.pow(similarity, 1.3);

    const remainingBefore = Math.max(0, hole.distance - player.totalDistance);
    const reach = Math.min(MAX_SHOT_DISTANCE, remainingBefore + 25);
    let distanceMoved = Math.round(power * reach);
    if (isMissSwing) distanceMoved = Math.min(distanceMoved, 12);

    // 랜덤 각도 오프셋 (-3° ~ +3°)
    const angleOffset = Math.random() * 6 - 3;
    const angleRad = (angleOffset * Math.PI) / 180;

    const newTotalDistance = Math.min(hole.distance + 20, player.totalDistance + distanceMoved);
    const newX = player.ballPosition.x + distanceMoved * Math.sin(angleRad);
    const newPosition = { x: newX, z: newTotalDistance };

    // 홀까지 거리 계산
    const dx = newPosition.x - hole.flagPosition.x;
    const dz = newPosition.z - hole.flagPosition.z;
    const remaining = Math.sqrt(dx * dx + dz * dz);
    const finished = remaining <= HOLE_RADIUS;

    // 샷 기록
    const shot = {
      teamId: player.id,
      prompt,
      targetN,
      generatedHtml,
      screenshotUrl,
      similarity,
      distanceMoved,
      angleOffset: Math.round(angleOffset * 10) / 10,
      isMissSwing,
    };

    // 플레이어 상태 업데이트
    player.currentStroke += 1;
    player.ballPosition = newPosition;
    player.totalDistance = newTotalDistance;
    player.finished = finished;

    if (finished) {
      player.score = player.currentStroke - hole.par;
    }

    // 샷 히스토리에 추가
    room.gameState.shots.push(shot);

    console.log(
      `[Game] ${player.name} shot: ${distanceMoved}m (sim: ${(similarity * 100).toFixed(0)}%)`,
    );

    // 다른 플레이어들에게 브로드캐스트
    socket.to(roomId).emit('game:shot-result', {
      playerId: player.id,
      shot,
      newPosition,
      newTotalDistance,
      finished,
    });

    // 게임 종료 체크
    const allFinished = Array.from(room.players.values())
      .filter((p) => p.connected)
      .every((p) => p.finished);

    if (allFinished) {
      room.status = 'finished';

      const finalScores: PlayerDTO[] = Array.from(room.players.values())
        .map(toPlayerDTO)
        .sort((a, b) => a.score - b.score);

      io.to(roomId).emit('game:finished', { finalScores });

      console.log(`[Game] Game finished in room ${room.code}`);
    }

    callback({
      success: true,
      shot,
      newPosition,
      newTotalDistance,
      finished,
    });
  });

  /**
   * 플레이어 상태 업데이트 (위치 동기화 등)
   */
  socket.on('player:update', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // 위치 업데이트
    if (data.ballPosition) {
      player.ballPosition = data.ballPosition;
    }
    if (data.totalDistance !== undefined) {
      player.totalDistance = data.totalDistance;
    }

    // 다른 플레이어들에게 동기화 (throttle 권장)
    socket.to(roomId).emit('game:state-sync', {
      players: Array.from(room.players.values()).map(toPlayerDTO),
      gameState: room.gameState,
      roomStatus: room.status,
    });
  });
}
