/**
 * Visual similarity between the player's rendered/captured web page and the
 * target image. Returns 0..1.
 *
 * Default provider: Google Gemini vision (free tier, multimodal). Both images
 * are sent in a single request and the model returns a similarity score. With
 * no GEMINI_API_KEY it falls back to a deterministic mock so the game runs
 * offline. Server-only.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ImagePayload {
  mimeType: string;
  /** base64-encoded image data (no data: prefix). */
  data: string;
}

export interface CompareInput {
  generated: ImagePayload;
  target: ImagePayload;
}

export type CompareScreenshotsFn = (input: CompareInput) => Promise<number>;

const COMPARE_PROMPT = `You are judging a "recreate this screen" game. The FIRST image is the player's generated web page. The SECOND image is the target they were trying to match.

Rate how visually similar the player's page is to the target — overall layout, color palette, main shapes/sections, and text placement (ignore exact wording).

Respond with ONLY a JSON object: {"similarity": <number 0..1>}. 1 = nearly identical, 0 = completely different.`;

const mockCompare: CompareScreenshotsFn = async ({ generated }) => {
  // Stable pseudo-score derived from the generated image so a given capture
  // yields a consistent value without any API call.
  const sample = generated.data.slice(0, 256);
  const score = 0.45 + (hashFloat(sample) * 0.4);
  return Math.round(score * 100) / 100;
};

const geminiCompare: CompareScreenshotsFn = async ({ generated, target }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return mockCompare({ generated, target });

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: COMPARE_PROMPT },
              { inlineData: { mimeType: generated.mimeType, data: generated.data } },
              { inlineData: { mimeType: target.mimeType, data: target.data } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 100 },
      }),
    });

    if (!res.ok) return mockCompare({ generated, target });

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const score = parseSimilarity(text);
    return score ?? mockCompare({ generated, target });
  } catch {
    return mockCompare({ generated, target });
  }
};

const PROVIDERS: Record<string, CompareScreenshotsFn> = {
  gemini: geminiCompare,
  mock: mockCompare,
};

export const compareScreenshots: CompareScreenshotsFn =
  PROVIDERS[process.env.SIMILARITY_PROVIDER ?? 'gemini'] ?? geminiCompare;

function parseSimilarity(text: string): number | null {
  const m = text.match(/"?similarity"?\s*:?\s*(0?\.\d+|1(?:\.0+)?|0)/i) ?? text.match(/(0?\.\d+|1(?:\.0+)?)/);
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
