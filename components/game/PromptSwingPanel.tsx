'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Target } from '@/lib/game/types';
import type { ChallengeHole } from '@/lib/content/types';
import { ImageZoomDialog } from './ImageZoomDialog';
import { ChallengeBriefCard } from './ChallengeBriefCard';

const MAX_LEN = 2000;
// 루브릭 트랙은 설계/보고서 등 긴 텍스트 산출물을 받으므로 더 넉넉하게
const MAX_LEN_RUBRIC = 8000;
// 작성 중 프롬프트 임시 저장 키 (리마운트/새로고침에도 입력이 날아가지 않도록)
const DRAFT_KEY = 'prompt_golf_draft';

// 로딩 단계 정의 (이미지 생성 → 유사도 비교)
const LOADING_STEPS = [
  { key: 'generating', label: '이미지 생성 중', icon: '🎨' },
  { key: 'comparing', label: '유사도 비교 중', icon: '🔍' },
];

// 루브릭 트랙 로딩 단계 (LLM Judge 평가 1단계)
const LOADING_STEPS_RUBRIC = [{ key: 'evaluating', label: '제출물 평가 중', icon: '⚖️' }];

function getStepIndex(statusText?: string): number {
  if (!statusText) return 0;
  if (statusText.includes('비교')) return 1;
  return 0;
}

interface PromptSwingPanelProps {
  target: Target | null;
  /** 현재 타수의 챌린지. 루브릭 트랙이면 이미지 대신 브리프 카드를 보여준다. */
  challenge?: ChallengeHole | null;
  swinging: boolean;
  /** Short status line shown while swinging (생성 중 / 캡처 중 / 비교 중). */
  statusText?: string;
  /** 확대 보기 여부 (부모가 패널 너비도 함께 키운다). */
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  /** 입력 변경 시 호출 (관전자 실시간 동기화용). */
  onPromptChange?: (prompt: string) => void;
  onSwing: (prompt: string) => void;
}

/** Unified bottom panel: target image(또는 챌린지 브리프) · prompt textarea · swing button. */
export function PromptSwingPanel({
  target,
  challenge,
  swinging,
  statusText,
  expanded,
  onExpandedChange,
  onPromptChange,
  onSwing,
}: PromptSwingPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // 루브릭 트랙 여부 — 목표 이미지 대신 브리프를 보여주고 텍스트 산출물을 받는다.
  const isRubric = challenge != null && challenge.track !== 'image';
  const maxLen = isRubric ? MAX_LEN_RUBRIC : MAX_LEN;
  const loadingSteps = isRubric ? LOADING_STEPS_RUBRIC : LOADING_STEPS;
  const canSwing = isRubric || target != null;

  // 마운트 시 저장된 draft 복원 (재참가/리마운트/새로고침에도 입력 보존)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        setPrompt(saved);
        onPromptChange?.(saved);
      }
    } catch {
      /* ignore */
    }
    // 마운트 시 1회만 복원
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePrompt = (value: string) => {
    const v = value.slice(0, maxLen);
    setPrompt(v);
    try {
      sessionStorage.setItem(DRAFT_KEY, v);
    } catch {
      /* ignore */
    }
    onPromptChange?.(v);
  };

  const handleSwing = () => {
    const trimmed = prompt.trim();
    if (!trimmed || swinging || !canSwing) return;
    // 스윙 시작 시 draft 비움 (다음 샷은 새로 입력)
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setPrompt('');
    onSwing(trimmed);
  };

  return (
    <div
      className={`hud-panel flex items-stretch gap-4 p-4 transition-[height] duration-300 ${
        expanded ? 'h-[68vh]' : ''
      }`}
    >
      {/* Target — 이미지 트랙은 목표 화면, 루브릭 트랙은 챌린지 브리프 */}
      <div className={`flex shrink-0 flex-col ${expanded ? 'w-[46%]' : isRubric ? 'w-72' : 'w-44'}`}>
        <span className="hud-label mb-1.5">
          {isRubric
            ? '챌린지 브리프'
            : `만들어야 할 화면 ${target ? `(타수 ${target.n})` : ''}`}
        </span>
        {isRubric ? (
          <div className={expanded ? 'min-h-0 flex-1' : 'h-52'}>
            <ChallengeBriefCard challenge={challenge} expanded={expanded} />
          </div>
        ) : (
        <div
          className={`relative overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/15 ${
            expanded ? 'flex-1' : 'aspect-[16/10]'
          }`}
        >
          {target ? (
            <button
              type="button"
              onClick={() => setZoomSrc(target.url)}
              className="group relative h-full w-full cursor-zoom-in"
              title="크게 보기"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={target.url}
                alt="목표 이미지"
                className={`h-full w-full ${expanded ? 'object-contain' : 'object-cover'}`}
              />
              <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80 opacity-0 transition group-hover:opacity-100">
                🔍 크게
              </span>
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-white/45">
              public/targets 에 image_1.png 부터 넣어주세요
            </div>
          )}
        </div>
        )}
      </div>


      {/* Prompt input */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <span className="hud-label mb-1.5">{isRubric ? '산출물 작성' : '프롬프트 입력'}</span>

        {/* 텍스트 입력 영역 */}
        <div className="relative flex-1">
          <textarea
            value={prompt}
            onChange={(e) => updatePrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSwing();
            }}
            placeholder={
              isRubric
                ? '브리프의 요구사항을 만족하는 산출물을 작성하세요… (설계, 대응 절차 등)'
                : '만들고 싶은 웹페이지 화면을 설명해주세요…'
            }
            disabled={swinging}
            className={`thin-scroll h-full w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-white placeholder:text-white/35 focus:border-action/60 focus:outline-none disabled:opacity-40 ${
              expanded ? 'text-base' : 'text-sm'
            }`}
          />

          {/* 로딩 오버레이 */}
          <AnimatePresence>
            {swinging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/70 backdrop-blur-sm"
              >
                {/* 로딩 스피너 */}
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-action" />

                {/* 현재 상태 텍스트 */}
                <motion.div
                  key={statusText}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-base font-medium text-white"
                >
                  {statusText || 'AI가 열심히 만드는 중…'}
                </motion.div>

                {/* 단계 표시기 */}
                <div className="flex items-center gap-2">
                  {loadingSteps.map((step, i) => {
                    const currentStep = isRubric ? 0 : getStepIndex(statusText);
                    const isActive = i === currentStep;
                    const isCompleted = i < currentStep;

                    return (
                      <div key={step.key} className="flex items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
                            isActive
                              ? 'bg-action text-white scale-110'
                              : isCompleted
                              ? 'bg-green-500/80 text-white'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {isCompleted ? '✓' : step.icon}
                        </div>
                        {i < loadingSteps.length - 1 && (
                          <div
                            className={`mx-1 h-0.5 w-6 ${
                              isCompleted ? 'bg-green-500/80' : 'bg-white/10'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 힌트 텍스트 */}
                <p className="mt-3 text-xs text-white/40">
                  잠시만 기다려주세요...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 하단 정보 */}
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-white/50">
            {!swinging && 'Cmd/Ctrl + Enter로 빠른 스윙'}
          </span>
          <span className="text-white/40">
            {prompt.length} / {maxLen}
          </span>
        </div>
      </div>

      {/* Swing button + 크게 보기 토글 */}
      <div className="flex flex-col justify-center gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSwing}
          disabled={swinging || !prompt.trim() || !canSwing}
          className="action-btn h-12 px-6 text-base"
        >
          {swinging ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {isRubric ? '평가 중…' : '스윙 중…'}
            </>
          ) : (
            <>{isRubric ? '📤 제출하기' : '🏌️ 스윙하기'}</>
          )}
        </motion.button>

        <button
          onClick={() => onExpandedChange(!expanded)}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          {expanded ? '🔽 작게 보기' : '🔍 크게 보기'}
        </button>
      </div>

      {/* 목표 이미지 확대 팝업 */}
      <ImageZoomDialog src={zoomSrc} alt="목표 이미지" onClose={() => setZoomSrc(null)} />
    </div>
  );
}
