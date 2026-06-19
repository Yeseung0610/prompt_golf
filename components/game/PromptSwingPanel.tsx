'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Target } from '@/lib/game/types';

const MAX_LEN = 300;

// 로딩 단계 정의
const LOADING_STEPS = [
  { key: 'generating', label: '웹페이지 생성 중', icon: '🎨' },
  { key: 'capturing', label: '화면 캡처 중', icon: '📸' },
  { key: 'comparing', label: '유사도 비교 중', icon: '🔍' },
];

function getStepIndex(statusText?: string): number {
  if (!statusText) return 0;
  if (statusText.includes('생성')) return 0;
  if (statusText.includes('캡처')) return 1;
  if (statusText.includes('비교')) return 2;
  return 0;
}

interface PromptSwingPanelProps {
  target: Target | null;
  swinging: boolean;
  /** Short status line shown while swinging (생성 중 / 캡처 중 / 비교 중). */
  statusText?: string;
  onSwing: (prompt: string) => void;
}

/** Unified bottom panel: target image · prompt textarea · swing button. */
export function PromptSwingPanel({
  target,
  swinging,
  statusText,
  onSwing,
}: PromptSwingPanelProps) {
  const [prompt, setPrompt] = useState('');

  const handleSwing = () => {
    const trimmed = prompt.trim();
    if (!trimmed || swinging || !target) return;
    onSwing(trimmed);
  };

  return (
    <div className="hud-panel flex items-stretch gap-4 p-4">
      {/* Target (만들어야 할 화면) */}
      <div className="flex w-44 shrink-0 flex-col">
        <span className="hud-label mb-1.5">
          만들어야 할 화면 {target ? `(타수 ${target.n})` : ''}
        </span>
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/15">
          {target ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.url} alt="목표 이미지" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-white/45">
              public/targets 에 image_1.png 부터 넣어주세요
            </div>
          )}
        </div>
      </div>


      {/* Prompt input */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <span className="hud-label mb-1.5">프롬프트 입력</span>

        {/* 텍스트 입력 영역 */}
        <div className="relative flex-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSwing();
            }}
            placeholder="만들고 싶은 웹페이지 화면을 설명해주세요…"
            disabled={swinging}
            className="thin-scroll h-full w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/35 focus:border-action/60 focus:outline-none disabled:opacity-40"
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
                  {LOADING_STEPS.map((step, i) => {
                    const currentStep = getStepIndex(statusText);
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
                        {i < LOADING_STEPS.length - 1 && (
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
            {prompt.length} / {MAX_LEN}
          </span>
        </div>
      </div>

      {/* Swing button */}
      <div className="flex items-center">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSwing}
          disabled={swinging || !prompt.trim() || !target}
          className="action-btn h-12 px-6 text-base"
        >
          {swinging ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              스윙 중…
            </>
          ) : (
            <>🏌️ 스윙하기</>
          )}
        </motion.button>
      </div>
    </div>
  );
}
