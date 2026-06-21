/**
 * 관리자: 타겟(샷) 이미지 동적 관리
 *  - GET    목록 조회
 *  - POST   추가 (body: { dataUrl })
 *  - DELETE 삭제 (body: { file })
 *  - PUT    순서 변경 (body: { order: string[] })
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listTargetFiles,
  toTargetItems,
  addTargetFile,
  deleteTargetFile,
  reorderTargetFiles,
} from '@/lib/game/targetsStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export async function GET() {
  const files = await listTargetFiles();
  return NextResponse.json({ success: true, targets: toTargetItems(files) });
}

export async function POST(req: NextRequest) {
  let body: { dataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const m = (body.dataUrl ?? '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) {
    return NextResponse.json({ success: false, error: '이미지 dataURL이 필요합니다.' }, { status: 400 });
  }
  const mime = m[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json({ success: false, error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
  }

  try {
    const buf = Buffer.from(m[2], 'base64');
    const files = await addTargetFile(buf, ext);
    return NextResponse.json({ success: true, targets: toTargetItems(files) });
  } catch (err) {
    return NextResponse.json({ success: false, error: '저장 실패', detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: { file?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.file) {
    return NextResponse.json({ success: false, error: 'file이 필요합니다.' }, { status: 400 });
  }
  const files = await deleteTargetFile(body.file);
  return NextResponse.json({ success: true, targets: toTargetItems(files) });
}

export async function PUT(req: NextRequest) {
  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ success: false, error: 'order 배열이 필요합니다.' }, { status: 400 });
  }
  const files = await reorderTargetFiles(body.order);
  return NextResponse.json({ success: true, targets: toTargetItems(files) });
}
