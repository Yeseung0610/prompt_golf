/**
 * POST /api/game/draft
 * 작성 중인 프롬프트 실시간 갱신 (관전자 표시용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateDraftPrompt } from '@/lib/game/gameServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, prompt } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId는 필수입니다.' },
        { status: 400 }
      );
    }

    const result = updateDraftPrompt(sessionId, typeof prompt === 'string' ? prompt : '');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/game/draft error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
