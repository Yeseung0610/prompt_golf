/**
 * 루브릭 기반 제출물 평가 (LLM Judge).
 *
 * 챌린지(Hole)의 브리프·제약·루브릭을 근거로 텍스트 제출물을 0~1로 채점하고
 * 공통 평가 출력 계약(EvaluationResult)을 반환한다.
 * 기본 프로바이더는 OpenAI chat completions이며, OPENAI_API_KEY가 없거나
 * 호출이 실패하면 결정론적 mock으로 폴백해 오프라인에서도 게임이 돌아간다.
 * Server-only.
 */

import type { ChallengeHole, EvaluationResult } from '@/lib/content/types';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface EvaluateInput {
  challenge: ChallengeHole;
  /** 플레이어가 제출한 텍스트 산출물. */
  submission: string;
}

export type EvaluateSubmissionFn = (input: EvaluateInput) => Promise<EvaluationResult>;

// ─────────────────────────────────────────────────────────────────────────────
// Mock (결정론적 — 같은 제출물은 항상 같은 점수)
// ─────────────────────────────────────────────────────────────────────────────

const mockEvaluate: EvaluateSubmissionFn = async ({ challenge, submission }) => {
  const trimmed = submission.trim();
  // 내용 충실도 프록시: 길이(최대 1200자 기준)와 구조화(줄바꿈/불릿) 여부
  const lengthFactor = Math.min(trimmed.length / 1200, 1);
  const lines = trimmed.split('\n').filter((l) => l.trim()).length;
  const structureFactor = Math.min(lines / 10, 1);

  const breakdown: Record<string, number> = {};
  for (const dim of challenge.rubric) {
    const noise = hashFloat(`${challenge.id}:${dim.key}:${trimmed.slice(0, 400)}`);
    const raw = 0.3 + lengthFactor * 0.3 + structureFactor * 0.15 + noise * 0.25;
    breakdown[dim.key] = Math.round(Math.min(1, raw) * 100) / 100;
  }

  const score = weightedScore(challenge, breakdown);
  const sorted = [...challenge.rubric].sort((a, b) => breakdown[b.key] - breakdown[a.key]);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    score,
    summary: `(오프라인 mock 평가) 제출물의 분량과 구조를 기준으로 채점했습니다. ${best.label} 항목이 상대적으로 좋고, ${worst.label} 항목이 아쉽습니다.`,
    breakdown,
    strengths: [`${best.label} 항목을 비교적 잘 다뤘습니다`],
    penalties: [`${worst.label} 항목을 더 구체적으로 보강하세요`],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI 루브릭 Judge
// ─────────────────────────────────────────────────────────────────────────────

function buildJudgePrompt(challenge: ChallengeHole, submission: string): string {
  const rubricLines = challenge.rubric
    .map((d) => `- ${d.key} (비중 ${d.weight}): ${d.label} — ${d.description}`)
    .join('\n');

  return [
    '당신은 직무 프롬프트 스킬 게임의 심판(Judge)입니다.',
    '아래 챌린지 브리프와 평가 루브릭만을 근거로 플레이어의 제출물을 채점하세요.',
    '숨은 기준으로 감점하지 말고, 루브릭에 명시된 항목만 평가합니다.',
    '',
    `## 챌린지: ${challenge.title} (트랙: ${challenge.track})`,
    '',
    '### 브리프',
    challenge.targetBrief,
    '',
    '### 기대 산출물',
    challenge.expectedOutputType,
    '',
    '### 요구사항/제약',
    challenge.constraints.map((c) => `- ${c}`).join('\n'),
    '',
    '### 평가 루브릭 (각 항목 0~1로 채점)',
    rubricLines,
    ...(challenge.notesForJudge
      ? ['', '### 심판 참고 사항 (플레이어 비공개)', challenge.notesForJudge]
      : []),
    '',
    '### 플레이어 제출물',
    '```',
    submission,
    '```',
    '',
    '다음 JSON만 출력하세요 (summary/strengths/penalties는 한국어):',
    '{"score": <0~1 가중 종합점수>, "summary": "<한두 문장 총평>", "breakdown": {' +
      challenge.rubric.map((d) => `"${d.key}": <0~1>`).join(', ') +
      '}, "strengths": ["<잘한 점>"], "penalties": ["<감점 요인>"]}',
  ].join('\n');
}

const openaiEvaluate: EvaluateSubmissionFn = async (input) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockEvaluate(input);

  const model = process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildJudgePrompt(input.challenge, input.submission) }],
        max_tokens: 800,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return mockEvaluate(input);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseEvaluation(text, input.challenge);
    return parsed ?? mockEvaluate(input);
  } catch {
    return mockEvaluate(input);
  }
};

const PROVIDERS: Record<string, EvaluateSubmissionFn> = {
  openai: openaiEvaluate,
  mock: mockEvaluate,
};

export const evaluateSubmission: EvaluateSubmissionFn =
  PROVIDERS[process.env.JUDGE_PROVIDER ?? 'openai'] ?? openaiEvaluate;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(n: unknown): number | null {
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.max(0, Math.min(1, v));
}

/** 루브릭 비중으로 breakdown을 가중 평균해 0~1 종합점수를 만든다. */
function weightedScore(challenge: ChallengeHole, breakdown: Record<string, number>): number {
  const totalWeight = challenge.rubric.reduce((sum, d) => sum + d.weight, 0) || 1;
  const sum = challenge.rubric.reduce(
    (acc, d) => acc + (breakdown[d.key] ?? 0) * d.weight,
    0,
  );
  return Math.round((sum / totalWeight) * 100) / 100;
}

/** LLM 응답 JSON을 공통 계약으로 정규화. 형식이 어긋나면 null. */
function parseEvaluation(text: string, challenge: ChallengeHole): EvaluationResult | null {
  try {
    const obj = JSON.parse(text) as Partial<EvaluationResult>;

    const breakdown: Record<string, number> = {};
    for (const dim of challenge.rubric) {
      const v = clamp01((obj.breakdown as Record<string, unknown> | undefined)?.[dim.key]);
      breakdown[dim.key] = v ?? 0;
    }

    // score가 없거나 범위를 벗어나면 breakdown 가중 평균으로 재계산
    const score = clamp01(obj.score) ?? weightedScore(challenge, breakdown);

    const toStrings = (arr: unknown): string[] =>
      Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string').slice(0, 5) : [];

    return {
      score,
      summary: typeof obj.summary === 'string' ? obj.summary : '평가가 완료되었습니다.',
      breakdown,
      strengths: toStrings(obj.strengths),
      penalties: toStrings(obj.penalties),
    };
  } catch {
    return null;
  }
}

function hashFloat(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
