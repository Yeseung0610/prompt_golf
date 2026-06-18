import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/ai/generateImage';
import { compareSimilarity } from '@/lib/ai/compareSimilarity';

export const runtime = 'nodejs';

interface RequestBody {
  prompt?: string;
  targetImageUrl?: string;
  targetDescription?: string;
}

/**
 * POST /api/generate-shot
 * Generates an image from the prompt and scores it against the target image.
 * Ball movement (distance/angle/miss) is computed client-side via
 * `calculateShot` so the 3D state stays authoritative on the client.
 */
export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ error: '프롬프트를 입력해주세요.' }, { status: 400 });
  }
  if (!body.targetImageUrl) {
    return NextResponse.json({ error: 'targetImageUrl is required' }, { status: 400 });
  }

  try {
    const { imageUrl, provider } = await generateImage(prompt);

    const similarity = await compareSimilarity({
      prompt,
      generatedImageUrl: imageUrl,
      targetImageUrl: body.targetImageUrl,
      targetKeywords: (body.targetDescription ?? '')
        .toLowerCase()
        .split(/[\s,/]+/)
        .filter(Boolean),
    });

    return NextResponse.json({
      generatedImageUrl: imageUrl,
      similarity,
      provider,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Shot generation failed', detail: String(err) },
      { status: 500 },
    );
  }
}
