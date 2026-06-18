/**
 * Image similarity abstraction. Returns a 0..1 score comparing a generated
 * image to the hole's target image.
 *
 * The default implementation is a mock that derives a stable pseudo-score
 * from the prompt + target so gameplay is deterministic-feeling without any
 * vision API. Replace `compareSimilarity` with a real embedding/vision model
 * by setting `SIMILARITY_PROVIDER`.
 *
 * Server-only.
 */

export interface CompareInput {
  prompt: string;
  generatedImageUrl: string;
  targetImageUrl: string;
  /** Optional keywords that describe the target scene (used by the mock). */
  targetKeywords?: string[];
}

export type CompareSimilarityFn = (input: CompareInput) => Promise<number>;

/**
 * Mock scorer: rewards prompts that mention concepts present in the target
 * description, plus a stable per-prompt jitter. Always returns 0..1.
 */
const mockCompare: CompareSimilarityFn = async ({ prompt, targetKeywords = [] }) => {
  const p = prompt.toLowerCase();

  const vocab = [
    ['하늘', 'sky', '구름', 'cloud', 'blue'],
    ['산', 'mountain', '언덕', 'hill'],
    ['물', 'water', '호수', 'lake', '강', 'river', '해저드'],
    ['그린', 'green', '잔디', 'grass', '페어웨이', 'fairway'],
    ['깃발', 'flag', '홀', 'hole', 'pin'],
    ['나무', 'tree', '숲', 'forest'],
    ['벙커', 'bunker', 'sand', '모래'],
    ['석양', 'sunset', '노을', '일몰'],
  ];

  let hits = 0;
  let possible = 0;
  for (const group of vocab) {
    const inTarget = group.some((w) => targetKeywords.some((k) => k.includes(w)) || false);
    // Each concept the player mentions adds signal; matching target concepts
    // counts double.
    const mentioned = group.some((w) => p.includes(w));
    if (mentioned) hits += inTarget ? 2 : 1;
    if (inTarget) possible += 2;
  }

  const base = possible > 0 ? hits / (possible + 3) : Math.min(1, hits / 6);

  // Length bonus: richer prompts score slightly higher, with diminishing return.
  const lengthBonus = Math.min(0.18, prompt.trim().length / 600);

  // Stable jitter so the same prompt yields the same score within a session.
  const jitter = (hashFloat(prompt) - 0.5) * 0.18;

  const score = clamp01(base + lengthBonus + jitter + 0.18);
  return Math.round(score * 100) / 100;
};

export const compareSimilarity: CompareSimilarityFn = mockCompare;

function clamp01(n: number): number {
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
