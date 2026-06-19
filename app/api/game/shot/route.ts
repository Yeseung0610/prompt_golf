/**
 * POST /api/game/shot
 * 샷 제출
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitShot } from '@/lib/game/gameServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, prompt, targetN, similarity } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId는 필수입니다.' },
        { status: 400 }
      );
    }

    if (typeof similarity !== 'number') {
      return NextResponse.json(
        { success: false, error: 'similarity는 필수입니다.' },
        { status: 400 }
      );
    }

    const result = submitShot(sessionId, {
      prompt: prompt ?? '',
      targetN: targetN ?? 0,
      similarity,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/game/shot error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
