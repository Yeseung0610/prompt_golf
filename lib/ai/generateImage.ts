/**
 * Image generation abstraction. The default implementation is a mock that
 * returns a deterministic placeholder image so the game is fully playable
 * with no API keys. Swap `generateImage` for a real provider by setting the
 * `IMAGE_PROVIDER` env var (currently supports "openai") and providing keys.
 *
 * This module is server-only (used inside the API route).
 */

export interface GenerateImageResult {
  imageUrl: string;
  provider: string;
}

export type GenerateImageFn = (prompt: string) => Promise<GenerateImageResult>;

/** Deterministic mock: builds an SVG "rendering" of the prompt. */
const mockGenerateImage: GenerateImageFn = async (prompt: string) => {
  const hue = hashHue(prompt);
  const label = prompt.slice(0, 48).replace(/[<>&]/g, '');
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,72%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,42%)"/>
    </linearGradient></defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <rect y="250" width="640" height="150" fill="hsl(120,45%,42%)"/>
    <circle cx="320" cy="120" r="44" fill="hsl(${(hue + 180) % 360},80%,75%)" opacity="0.85"/>
    <text x="320" y="360" font-family="sans-serif" font-size="20" fill="#ffffff" text-anchor="middle" opacity="0.85">${label}</text>
  </svg>`;
  return {
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`,
    provider: 'mock',
  };
};

/** Example real provider wired through OpenAI Images API. */
const openaiGenerateImage: GenerateImageFn = async (prompt: string) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockGenerateImage(prompt);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!res.ok) {
    // Fail soft to the mock so the game never hard-blocks on a swing.
    return mockGenerateImage(prompt);
  }

  const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  const item = data.data?.[0];
  const imageUrl = item?.url
    ? item.url
    : item?.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : (await mockGenerateImage(prompt)).imageUrl;

  return { imageUrl, provider: 'openai' };
};

export const generateImage: GenerateImageFn =
  process.env.IMAGE_PROVIDER === 'openai' ? openaiGenerateImage : mockGenerateImage;

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
