/**
 * GET /api/game/player?playerId=...
 * 관전 화면 전용: 특정 플레이어의 라이브 상태(작성 중 프롬프트 등) 폴링.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/game/gameServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get('playerId');
  if (!playerId) {
    return NextResponse.json({ success: false, error: 'playerId는 필수입니다.' }, { status: 400 });
  }

  const player = getPlayer(playerId);
  if (!player) {
    return NextResponse.json({ success: false, error: '플레이어를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, player });
}
