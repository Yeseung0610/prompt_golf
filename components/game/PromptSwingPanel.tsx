'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Target } from '@/lib/game/types';

const MAX_LEN = 300;

interface PromptSwingPanelProps {
  target: Target | null;
  swinging: boolean;
  /** Short status line shown while swinging (생성 중 / 캡처 중 / 비교 중). */
  statusText?: string;
  /** Last captured screenshot to preview next to the target. */
  lastScreenshot?: string | null;
  onSwing: (prompt: string) => void;
}

/** Unified bottom panel: target image · prompt textarea · swing button. */
export function PromptSwingPanel({
  target,
  swinging,
  statusText,
  lastScreenshot,
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

      {/* Captured result (last screenshot) */}
      {lastScreenshot && (
        <div className="flex w-44 shrink-0 flex-col">
          <span className="hud-label mb-1.5">내 결과 (캡처)</span>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-black/40 ring-1 ring-action/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lastScreenshot} alt="생성 결과" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {/* Prompt input */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="hud-label mb-1.5">프롬프트 입력</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSwing();
          }}
          placeholder="만들고 싶은 웹페이지 화면을 설명해주세요…"
          disabled={swinging}
          className="thin-scroll flex-1 resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/35 focus:border-action/60 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-action/90">{swinging ? statusText : ''}</span>
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
