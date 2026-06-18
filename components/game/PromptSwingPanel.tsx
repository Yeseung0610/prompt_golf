'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Hole } from '@/lib/game/types';
import { TargetImagePreview } from './TargetImagePreview';

const MAX_LEN = 300;

interface PromptSwingPanelProps {
  hole: Hole;
  swinging: boolean;
  onSwing: (prompt: string) => void;
}

/** Unified bottom panel: target preview · prompt textarea · swing button. */
export function PromptSwingPanel({ hole, swinging, onSwing }: PromptSwingPanelProps) {
  const [prompt, setPrompt] = useState('');

  const handleSwing = () => {
    const trimmed = prompt.trim();
    if (!trimmed || swinging) return;
    onSwing(trimmed);
  };

  return (
    <div className="hud-panel flex items-stretch gap-4 p-4">
      <TargetImagePreview imageUrl={hole.targetImageUrl} description={hole.targetDescription} />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="hud-label mb-1.5">프롬프트 입력</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSwing();
          }}
          placeholder="만들고 싶은 골프 장면을 설명해주세요…"
          disabled={swinging}
          className="thin-scroll flex-1 resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/35 focus:border-action/60 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1 text-right text-[11px] text-white/40">
          {prompt.length} / {MAX_LEN}
        </div>
      </div>

      <div className="flex items-center">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSwing}
          disabled={swinging || !prompt.trim()}
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
