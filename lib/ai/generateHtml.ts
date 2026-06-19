/**
 * Prompt → HTML generation. Turns the player's natural-language prompt into a
 * self-contained HTML web page that will be rendered + screenshotted and then
 * compared against the target image.
 *
 * Default provider: Google Gemini (free tier, `gemini-2.5-flash`). With no
 * GEMINI_API_KEY set it falls back to a deterministic mock so the game still
 * runs offline. Server-only.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GenerateHtmlResult {
  html: string;
  provider: string;
}

export type GenerateHtmlFn = (prompt: string) => Promise<GenerateHtmlResult>;

const SYSTEM_INSTRUCTION = `You are a front-end engineer in a game where players describe a web page and you must recreate it as a single self-contained HTML document.

Rules:
- Output ONLY raw HTML. No markdown fences, no explanation.
- Everything inline: put all CSS in a <style> tag. No external resources, no <img> with external URLs (use CSS gradients/shapes or inline SVG instead), no <script>.
- Make it a complete <!DOCTYPE html> document with <html><head><style>…</style></head><body>…</body></html>.
- Fill the full viewport (body { margin:0 }). Aim for a clean, realistic layout matching the description.`;

/** Strip accidental markdown code fences from a model response. */
function cleanHtml(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '');
  return s.trim();
}

const mockGenerateHtml: GenerateHtmlFn = async (prompt: string) => {
  const safe = prompt.replace(/[<>&]/g, '');
  const hue = Math.abs(hash(prompt)) % 360;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:system-ui,sans-serif}
    body{height:100vh;display:flex;flex-direction:column;background:linear-gradient(135deg,hsl(${hue},65%,55%),hsl(${(hue + 60) % 360},60%,40%));color:#fff}
    header{padding:20px 32px;font-weight:700;font-size:22px;background:rgba(0,0,0,.15)}
    main{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:32px}
    .card{background:rgba(255,255,255,.15);backdrop-filter:blur(6px);padding:40px;border-radius:20px;max-width:520px}
    h1{font-size:34px;margin-bottom:14px}p{opacity:.9;line-height:1.5}
  </style></head><body>
    <header>★ Generated Page</header>
    <main><div class="card"><h1>${safe.slice(0, 40) || 'Web Page'}</h1><p>${safe}</p></div></main>
  </body></html>`;
  return { html, provider: 'mock' };
};

const geminiGenerateHtml: GenerateHtmlFn = async (prompt: string) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return mockGenerateHtml(prompt);

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Recreate this web page as HTML:\n\n${prompt}` }],
          },
        ],
        generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) return mockGenerateHtml(prompt);

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const html = cleanHtml(text);
    if (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<body')) {
      return mockGenerateHtml(prompt);
    }
    return { html, provider: 'gemini' };
  } catch {
    return mockGenerateHtml(prompt);
  }
};

const PROVIDERS: Record<string, GenerateHtmlFn> = {
  gemini: geminiGenerateHtml,
  mock: mockGenerateHtml,
};

export const generateHtml: GenerateHtmlFn =
  PROVIDERS[process.env.HTML_PROVIDER ?? 'gemini'] ?? geminiGenerateHtml;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
