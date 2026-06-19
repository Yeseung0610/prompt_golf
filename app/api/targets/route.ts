import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET_DIR = path.join(process.cwd(), 'public', 'targets');
const EXT = /^image_(\d+)\.(png|jpe?g|webp|gif|svg)$/i;

/**
 * GET /api/targets
 * Lists target images placed in /public/targets named image_{n}.(png|jpg|…),
 * sorted by n. Each n corresponds to a stroke (타수); the hole stays the same.
 */
export async function GET() {
  try {
    const files = await fs.readdir(TARGET_DIR);
    const targets = files
      .map((file) => {
        const m = file.match(EXT);
        if (!m) return null;
        return { n: Number(m[1]), file, url: `/targets/${file}` };
      })
      .filter((t): t is { n: number; file: string; url: string } => t !== null)
      .sort((a, b) => a.n - b.n);

    return NextResponse.json({ targets });
  } catch {
    // Folder missing or unreadable → empty list (game shows a placeholder).
    return NextResponse.json({ targets: [] });
  }
}
