/**
 * 콘텐츠 확장 도메인 모델 (docs/prompt-golf-expansion-plan.md 기반).
 *
 * 기존 "similarity 0~1 → 골프 샷" 루프를 깨지 않고, 트랙별 챌린지(Hole)와
 * 루브릭 평가 결과(공통 평가 출력 계약)를 얹기 위한 타입들.
 * 클라이언트/서버 양쪽에서 import 가능한 순수 타입·데이터 전용.
 */

/** 직무 트랙. image는 기존 이미지 유사도 트랙. */
export type Track = 'image' | 'frontend' | 'backend' | 'sre-devops' | 'non-dev';

/** 트랙별 표시 메타 (배지/라벨용). */
export interface TrackMeta {
  label: string;
  icon: string;
  /** Tailwind 클래스 (배지 배경/텍스트). */
  badgeClass: string;
}

export const TRACK_META: Record<Track, TrackMeta> = {
  image: { label: '이미지', icon: '🎨', badgeClass: 'bg-emerald-500/25 text-emerald-200' },
  frontend: { label: '프론트엔드', icon: '🖥️', badgeClass: 'bg-sky-500/25 text-sky-200' },
  backend: { label: '백엔드', icon: '🗄️', badgeClass: 'bg-violet-500/25 text-violet-200' },
  'sre-devops': { label: 'SRE/DevOps', icon: '🚨', badgeClass: 'bg-orange-500/25 text-orange-200' },
  'non-dev': { label: '콘텐츠', icon: '📝', badgeClass: 'bg-pink-500/25 text-pink-200' },
};

/** 루브릭 평가 차원 1개. weight 합은 100 기준. */
export interface RubricDimension {
  /** breakdown 키로도 쓰이는 식별자 (영문 snake/kebab 권장). */
  key: string;
  /** 플레이어에게 보여줄 이름. */
  label: string;
  weight: number;
  description: string;
}

/** 평가자 유형. visual은 기존 이미지 비교, rubric-judge는 LLM 루브릭 평가. */
export type EvaluatorType = 'visual' | 'rubric-judge' | 'hybrid';

/**
 * 플레이어가 풀어야 하는 하나의 업무 문제(Hole).
 * self-contained 원칙: 브리프·기대 산출물·제약·평가 기준이 이 객체 안에 모두 있다.
 */
export interface ChallengeHole {
  id: string;
  title: string;
  track: Track;
  /** 플레이어에게 주는 문제 브리프 (여러 줄). */
  targetBrief: string;
  /** 기대 산출물 설명 (예: "API 엔드포인트 설계 + DB 테이블 설계 + ..."). */
  expectedOutputType: string;
  /** 반드시 지켜야 하는 요구사항/제약 목록. */
  constraints: string[];
  /** 명시적 평가 기준 (숨은 기준으로 감점하지 않는다). */
  rubric: RubricDimension[];
  evaluator: EvaluatorType;
  /** LLM Judge에게만 전달하는 채점 힌트 (플레이어에게는 노출하지 않음). */
  notesForJudge?: string;
  /** image 트랙 전용: 사용할 기존 타겟 이미지 인덱스(0부터). */
  targetIndex?: number;
}

/**
 * 공통 평가 출력 계약 (설계안 3장).
 * 게임 로직은 score만 사용하고, 나머지는 플레이어 피드백에 쓴다.
 */
export interface EvaluationResult {
  /** 0~1 정규화 점수. 기존 similarity 자리에 그대로 들어간다. */
  score: number;
  summary: string;
  /** 루브릭 key → 0~1 점수. */
  breakdown: Record<string, number>;
  strengths: string[];
  penalties: string[];
}
