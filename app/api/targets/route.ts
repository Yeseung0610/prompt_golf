import { NextResponse } from 'next/server';
import { listTargetFiles, toTargetItems } from '@/lib/game/targetsStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/targets
 * 타겟 이미지 목록을 manifest 순서대로 반환. 각 항목의 n은 타수(1부터)에 대응.
 */
export async function GET() {
  try {
    const files = await listTargetFiles();
    return NextResponse.json({ targets: toTargetItems(files) });
  } catch {
    // 폴더 없거나 읽기 실패 → 빈 목록 (게임은 플레이스홀더 표시)
    return NextResponse.json({ targets: [] });
  }
}
