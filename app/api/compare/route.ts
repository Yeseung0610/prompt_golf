import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { compareScreenshots, type ImagePayload } from '@/lib/ai/compareScreenshots';

export const runtime = 'nodejs';

const TARGET_DIR = path.join(process.cwd(), 'public', 'targets');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** Parse a data: URL into a Gemini-style inlineData payload. */
function parseDataUrl(dataUrl: string): ImagePayload | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

async function loadTarget(file: string): Promise<ImagePayload | null> {
  try {
    const buf = await fs.readFile(path.join(TARGET_DIR, file));
    const ext = path.extname(file).toLowerCase();
    return { mimeType: MIME[ext] ?? 'image/png', data: buf.toString('base64') };
  } catch {
    return null;
  }
}

/**
 * POST /api/compare  { screenshot: dataURL, targetFile }
 * Compares the captured page screenshot against the target image (Gemini
 * vision) and returns a 0..1 similarity score.
 */
export async function POST(req: NextRequest) {
  let body: { screenshot?: string; targetFile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const generated = body.screenshot ? parseDataUrl(body.screenshot) : null;
  if (!generated) {
    return NextResponse.json({ error: 'screenshot(dataURL) is required' }, { status: 400 });
  }

  // Guard against path traversal: only allow image_{n}.{ext} basenames.
  const file = body.targetFile ?? '';
  if (!/^image_\d+\.(png|jpe?g|webp|gif|svg)$/i.test(file)) {
    return NextResponse.json({ error: 'invalid targetFile' }, { status: 400 });
  }

  const target = await loadTarget(file);
  if (!target) {
    return NextResponse.json({ error: 'target image not found' }, { status: 404 });
  }

  try {
    const similarity = await compareScreenshots({ generated, target });
    return NextResponse.json({ similarity });
  } catch (err) {
    return NextResponse.json(
      { error: 'comparison failed', detail: String(err) },
      { status: 500 },
    );
  }
}
