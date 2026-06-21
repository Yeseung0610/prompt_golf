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

/** Parse the generated image (data: URL or remote https URL) into a payload. */
function parseGenerated(src: string): ImagePayload | null {
  const m = src.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  if (/^https?:\/\//i.test(src)) return { mimeType: 'image/png', data: src, isUrl: true };
  return null;
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
 * POST /api/compare  { generatedUrl: dataURL|https, targetFile }
 * Compares the player's generated image against the target image (OpenAI
 * vision) and returns a 0..1 similarity score.
 * (`screenshot` is accepted as a legacy alias for `generatedUrl`.)
 */
export async function POST(req: NextRequest) {
  let body: { generatedUrl?: string; screenshot?: string; targetFile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const src = body.generatedUrl ?? body.screenshot ?? '';
  const generated = src ? parseGenerated(src) : null;
  if (!generated) {
    return NextResponse.json({ error: 'generatedUrl(dataURL/https) is required' }, { status: 400 });
  }

  // Guard against path traversal: safe basename only (no slashes), image ext.
  const file = body.targetFile ?? '';
  if (file !== path.basename(file) || !/^[\w.-]+\.(png|jpe?g|webp|gif|svg)$/i.test(file)) {
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
