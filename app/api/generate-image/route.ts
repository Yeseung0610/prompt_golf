import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/ai/generateImage';

export const runtime = 'nodejs';

/**
 * POST /api/generate-image  { prompt }
 * Turns the player's prompt into an image (OpenAI). The returned data/URL is
 * used directly as the player's "screen" — no HTML render/capture needed.
 */
export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ success: false, error: '프롬프트를 입력해주세요.' }, { status: 400 });
  }

  try {
    const { dataUrl, provider } = await generateImage(prompt);
    return NextResponse.json({ success: true, dataUrl, provider });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'image generation failed', detail: String(err) },
      { status: 500 },
    );
  }
}
