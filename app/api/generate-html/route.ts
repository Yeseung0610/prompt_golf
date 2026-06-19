import { NextRequest, NextResponse } from 'next/server';
import { generateHtml } from '@/lib/ai/generateHtml';

export const runtime = 'nodejs';

/**
 * POST /api/generate-html  { prompt }
 * Turns the player's prompt into a self-contained HTML document (Gemini).
 * The client renders it in a sandboxed iframe and captures a screenshot.
 */
export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ error: '프롬프트를 입력해주세요.' }, { status: 400 });
  }

  try {
    const { html, provider } = await generateHtml(prompt);
    return NextResponse.json({ success: true, html, provider });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'HTML generation failed', detail: String(err) },
      { status: 500 },
    );
  }
}
