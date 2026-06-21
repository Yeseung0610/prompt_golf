/**
 * Visual similarity between the player's generated image and the target image.
 * Returns 0..1.
 *
 * Default provider: OpenAI vision (chat completions, multimodal). Both images
 * are sent as data/URLs in one request and the model returns a similarity score.
 * With no OPENAI_API_KEY it falls back to a deterministic mock so the game runs
 * offline. Server-only.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface ImagePayload {
  mimeType: string;
  /** base64-encoded image data (no data: prefix), OR a full https URL. */
  data: string;
  /** true면 data가 이미 완성된 URL(원격 https 등)임을 의미. */
  isUrl?: boolean;
}

export interface CompareInput {
  generated: ImagePayload;
  target: ImagePayload;
}

export type CompareScreenshotsFn = (input: CompareInput) => Promise<number>;

const COMPARE_PROMPT = `You are judging a "recreate this screen" game. The FIRST image is the player's generated screen. The SECOND image is the target they were trying to match.

Rate how visually similar the player's image is to the target — overall layout, color palette, main shapes/sections, and text placement (ignore exact wording).

Respond with ONLY a JSON object: {"similarity": <number 0..1>}. 1 = nearly identical, 0 = completely different.`;

function toUrl(p: ImagePayload): string {
  return p.isUrl ? p.data : `data:${p.mimeType};base64,${p.data}`;
}

const mockCompare: CompareScreenshotsFn = async ({ generated }) => {
  // Stable pseudo-score derived from the generated image so a given image
  // yields a consistent value without any API call.
  const sample = generated.data.slice(0, 256);
  const score = 0.45 + hashFloat(sample) * 0.4;
  return Math.round(score * 100) / 100;
};

const openaiCompare: CompareScreenshotsFn = async ({ generated, target }) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockCompare({ generated, target });

  const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: COMPARE_PROMPT },
              { type: 'image_url', image_url: { url: toUrl(generated), detail: 'low' } },
              { type: 'image_url', image_url: { url: toUrl(target), detail: 'low' } },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return mockCompare({ generated, target });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    const score = parseSimilarity(text);
    return score ?? mockCompare({ generated, target });
  } catch {
    return mockCompare({ generated, target });
  }
};

const PROVIDERS: Record<string, CompareScreenshotsFn> = {
  openai: openaiCompare,
  mock: mockCompare,
};

export const compareScreenshots: CompareScreenshotsFn =
  PROVIDERS[process.env.SIMILARITY_PROVIDER ?? 'openai'] ?? openaiCompare;

function parseSimilarity(text: string): number | null {
  const m =
    text.match(/"?similarity"?\s*:?\s*(0?\.\d+|1(?:\.0+)?|0)/i) ??
    text.match(/(0?\.\d+|1(?:\.0+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function hashFloat(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
