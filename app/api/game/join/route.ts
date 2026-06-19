/**
 * POST /api/game/join
 * 게임 참가 (메인 방에 자동 참가)
 */

import { NextRequest, NextResponse } from 'next/server';
import { joinGame } from '@/lib/game/gameServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, name, avatarUrl } = body;

    if (!sessionId || !name) {
      return NextResponse.json(
        { success: false, error: 'sessionId와 name은 필수입니다.' },
        { status: 400 }
      );
    }

    const result = joinGame(sessionId, name, avatarUrl ?? null);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/game/join error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
