/**
 * POST /api/game/reset
 * 게임 리셋 (호스트 또는 Admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetGame } from '@/lib/game/gameServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, adminMode } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId는 필수입니다.' },
        { status: 400 }
      );
    }

    const result = resetGame(sessionId, adminMode === true);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/game/reset error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
