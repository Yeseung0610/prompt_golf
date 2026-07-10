/**
 * 데모 챌린지 팩 (docs/prompt-golf-expansion-plan.md 5·6장).
 *
 * 타수(stroke) 순서 = DEMO_CHALLENGES 배열 순서.
 *   타수 1: 이미지 화면 재현 (기존 타겟 이미지 사용)
 *   타수 2: 백엔드 예약 시스템 API 설계
 *   타수 3: SRE Checkout 장애 대응
 * 시퀀스를 넘어선 타수는 남은 타겟 이미지를 이미지 홀로 이어간다(기존 동작 호환).
 */

import type { ChallengeHole } from './types';

export const DEMO_CHALLENGES: ChallengeHole[] = [
  {
    id: 'image-recreate-1',
    title: '목표 화면 재현',
    track: 'image',
    targetBrief: '목표 이미지를 보고 최대한 비슷한 화면을 프롬프트로 재현하세요.',
    expectedOutputType: '이미지 생성 프롬프트',
    constraints: ['레이아웃·색상·주요 요소를 목표와 비슷하게'],
    rubric: [
      { key: 'visual', label: '시각적 유사도', weight: 100, description: '레이아웃, 색상, 형태, 구도, 주요 요소 일치도' },
    ],
    evaluator: 'visual',
    targetIndex: 0,
  },
  {
    id: 'backend-reservation-api',
    title: '예약 시스템 API 설계',
    track: 'backend',
    targetBrief: '소규모 병원 예약 시스템을 위한 API를 설계하세요.',
    expectedOutputType:
      'API 엔드포인트 설계 · Request/Response 예시 · DB 테이블 설계 · 인증/권한 전략 · 에러 코드 설계 · 성능/확장성 고려사항',
    constraints: [
      '환자는 예약 생성/조회/취소 가능',
      '의사는 자신의 일정 조회 가능',
      '중복 예약 방지',
      '관리자만 예약 현황 전체 조회 가능',
      '추후 모바일 앱에서 사용할 예정',
    ],
    rubric: [
      { key: 'requirements', label: '요구사항 충족', weight: 20, description: '기능 요구사항을 빠짐없이 다뤘는지' },
      { key: 'api_design', label: 'API 설계 일관성', weight: 20, description: '리소스 모델, status code, error model, pagination, idempotency' },
      { key: 'data_modeling', label: 'DB 모델링', weight: 20, description: '정규화, 제약조건, 인덱스, 무결성' },
      { key: 'security', label: '보안/권한/검증', weight: 20, description: '인증, 인가, input validation, 민감정보 보호' },
      { key: 'scalability', label: '확장성/성능', weight: 10, description: 'N+1 회피, 캐시, 비동기 처리, 병목 고려' },
      { key: 'tradeoffs', label: '설명/트레이드오프', weight: 10, description: '선택 이유와 대안 비교' },
    ],
    evaluator: 'rubric-judge',
    notesForJudge:
      '권한 모델이 구체적인가? race condition·중복 예약 같은 edge case를 다뤘는가? 오류 응답이 일관적인가? "그냥 잘 처리한다" 같은 추상 표현으로 회피하지 않았는가?',
  },
  {
    id: 'sre-checkout-incident',
    title: 'Checkout 장애 대응',
    track: 'sre-devops',
    targetBrief: [
      '상황:',
      '배포 10분 후 checkout API p95 latency가 300ms → 5s로 증가.',
      'Error rate는 1% → 18%. DB CPU는 95%.',
      '최근 변경사항은 추천 상품 조회 로직 추가.',
      '',
      '제공 로그:',
      '- SELECT * FROM recommendations WHERE user_id = ?',
      '- checkout timeout',
      '- connection pool exhausted',
    ].join('\n'),
    expectedOutputType:
      '의심 원인 · 즉시 완화 조치 · 확인할 메트릭/로그 · 롤백 여부 판단 · 재발 방지책 · postmortem 요약',
    constraints: [
      '근거 없는 위험한 조치(DB 재시작, 전체 재배포 등) 금지',
      '관측 데이터에 기반해 추론할 것',
      '고객 영향도와 우선순위를 언급할 것',
    ],
    rubric: [
      { key: 'diagnosis', label: '원인 진단 정확도', weight: 30, description: '로그/메트릭에서 원인을 올바르게 추론했는지' },
      { key: 'mitigation', label: '즉시 대응 안전성', weight: 20, description: '위험한 명령을 피하고 안전한 완화책을 제시했는지' },
      { key: 'evidence', label: '증거 기반 추론', weight: 15, description: '추측이 아니라 관측 데이터에 기반했는지' },
      { key: 'prevention', label: '재발 방지책', weight: 15, description: '근본 원인 제거, 테스트, 가드레일을 제안했는지' },
      { key: 'observability', label: '관측성 개선', weight: 10, description: 'metric/log/trace/alert 개선이 있는지' },
      { key: 'communication', label: '커뮤니케이션 품질', weight: 10, description: '영향도, 타임라인, 액션 아이템이 명확한지' },
    ],
    evaluator: 'rubric-judge',
    notesForJudge:
      'rollback 또는 feature flag disable 같은 안전한 완화책을 고려했는가? 재발 방지책이 구체적인가? 근거 없이 위험한 조치를 제안하면 크게 감점.',
  },
];

/** id로 챌린지 조회 (서버 evaluate 라우트에서 사용). */
export function getChallengeById(id: string): ChallengeHole | null {
  return DEMO_CHALLENGES.find((c) => c.id === id) ?? null;
}

/**
 * 타수(0부터) → 해당 타수에 플레이할 챌린지.
 * 시퀀스를 넘어선 타수는 남은 타겟 이미지를 이미지 홀로 소비한다.
 * @param strokeIndex 현재 타수 (0부터)
 * @param targetCount 사용 가능한 타겟 이미지 수
 */
export function challengeForStroke(strokeIndex: number, targetCount: number): ChallengeHole | null {
  if (strokeIndex < DEMO_CHALLENGES.length) return DEMO_CHALLENGES[strokeIndex];

  // 시퀀스 종료 후: 아직 안 쓴 타겟 이미지가 있으면 이미지 홀로 계속
  const usedImageTargets = DEMO_CHALLENGES.filter((c) => c.track === 'image').length;
  const nextTargetIndex = usedImageTargets + (strokeIndex - DEMO_CHALLENGES.length);
  if (nextTargetIndex >= targetCount) return null;

  return {
    ...DEMO_CHALLENGES[0],
    id: `image-recreate-${nextTargetIndex + 1}`,
    targetIndex: nextTargetIndex,
  };
}
