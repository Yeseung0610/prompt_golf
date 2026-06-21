/**
 * GET /api/game/state
 * 게임 상태 조회 (폴링)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGameState } from '@/lib/game/gameServer';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const adminMode = request.nextUrl.searchParams.get('adminMode') === 'true';
    const sinceRaw = request.nextUrl.searchParams.get('sinceShotId');
    const sinceShotId = sinceRaw == null ? null : Number(sinceRaw);

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId는 필수입니다.' },
        { status: 400 }
      );
    }

    const state = getGameState(
      sessionId,
      adminMode,
      sinceShotId != null && Number.isFinite(sinceShotId) ? sinceShotId : null
    );

    if (!state) {
      return NextResponse.json(
        { success: false, error: '게임 상태를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error('[API] /api/game/state error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
