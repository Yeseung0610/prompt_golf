/**
 * Prompt → image generation via OpenAI Images API (default model gpt-image-1).
 * Returns a base64 PNG data URL (or a remote URL for models that return one).
 * Falls back to a deterministic offline mock image when no OPENAI_API_KEY is set
 * or the call fails, so the game keeps running. Server-only.
 */

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export interface GenerateImageResult {
  /** A data: URL (mock/gpt-image-1) or https URL (e.g. dall-e-3). */
  dataUrl: string;
  provider: string;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic offline placeholder image as an SVG data URL. */
function mockImage(prompt: string): GenerateImageResult {
  const hue = Math.abs(hash(prompt)) % 360;
  const safe = prompt.replace(/[<&>]/g, '').slice(0, 60);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},65%,55%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,40%)"/>
    </linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <text x="512" y="520" font-family="sans-serif" font-size="42" fill="#ffffff" text-anchor="middle">${safe}</text>
  </svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return { dataUrl, provider: 'mock' };
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockImage(prompt);

  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE ?? '1024x1024';

  try {
    const res = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        // 타겟 이미지(웹 화면)와 맞물리도록 "화면 스크린샷" 맥락을 부여한다.
        prompt: `A clean, realistic UI screenshot of a web page/app screen. ${prompt}`,
        n: 1,
        size,
      }),
    });

    if (!res.ok) return mockImage(prompt);

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return { dataUrl: `data:image/png;base64,${b64}`, provider: 'openai' };
    const url = data.data?.[0]?.url;
    if (url) return { dataUrl: url, provider: 'openai' };
    return mockImage(prompt);
  } catch {
    return mockImage(prompt);
  }
}
