import { NextRequest, NextResponse } from 'next/server';
import { getChallengeById } from '@/lib/content/challenges';
import { evaluateSubmission } from '@/lib/ai/evaluateSubmission';

export const runtime = 'nodejs';

const MAX_SUBMISSION_LEN = 8000;

/**
 * POST /api/evaluate  { challengeId, submission }
 * 루브릭 트랙(backend/sre 등) 제출물을 LLM Judge로 채점해
 * 공통 평가 출력 계약({ score, summary, breakdown, strengths, penalties })을 반환한다.
 */
export async function POST(req: NextRequest) {
  let body: { challengeId?: string; submission?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const challenge = getChallengeById(body.challengeId ?? '');
  if (!challenge) {
    return NextResponse.json({ error: 'unknown challengeId' }, { status: 400 });
  }
  if (challenge.evaluator === 'visual') {
    return NextResponse.json({ error: 'visual 챌린지는 /api/compare를 사용하세요' }, { status: 400 });
  }

  const submission = (body.submission ?? '').trim();
  if (!submission) {
    return NextResponse.json({ error: 'submission is required' }, { status: 400 });
  }

  try {
    const result = await evaluateSubmission({
      challenge,
      submission: submission.slice(0, MAX_SUBMISSION_LEN),
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: 'evaluation failed', detail: String(err) },
      { status: 500 },
    );
  }
}
