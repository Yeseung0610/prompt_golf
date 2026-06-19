'use client';

import { motion } from 'framer-motion';

interface CompareOverlayProps {
  targetUrl: string;
  generatedUrl: string;
  similarity: number;
  onComplete: () => void;
}

/** 원본 vs 생성 이미지 비교 오버레이 (5초 표시 후 콜백) */
export function CompareOverlay({
  targetUrl,
  generatedUrl,
  similarity,
  onComplete,
}: CompareOverlayProps) {
  const percent = Math.round(similarity * 100);

  // 유사도에 따른 색상
  const getColor = () => {
    if (percent >= 80) return '#22c55e'; // green
    if (percent >= 60) return '#eab308'; // yellow
    if (percent >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  // 유사도에 따른 메시지
  const getMessage = () => {
    if (percent >= 90) return '완벽해요! 🎯';
    if (percent >= 80) return '훌륭해요! 👏';
    if (percent >= 60) return '좋아요! 👍';
    if (percent >= 40) return '아쉬워요 😅';
    return '다시 도전! 💪';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        // 5초 후 onComplete 호출
        setTimeout(onComplete, 5000);
      }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="flex flex-col items-center gap-6"
      >
        {/* 이미지 비교 영역 */}
        <div className="flex items-center gap-8">
          {/* 원본 (목표) 이미지 */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="text-sm font-semibold text-white/70">🎯 목표 화면</span>
            <div className="relative overflow-hidden rounded-xl ring-2 ring-white/20 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={targetUrl}
                alt="목표"
                className="h-[240px] w-[380px] object-cover"
              />
            </div>
          </motion.div>

          {/* VS 표시 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white"
          >
            VS
          </motion.div>

          {/* 생성된 이미지 */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="text-sm font-semibold text-white/70">🖼️ 내 결과</span>
            <div
              className="relative overflow-hidden rounded-xl shadow-2xl ring-2"
              style={{ borderColor: getColor() }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedUrl}
                alt="생성 결과"
                className="h-[240px] w-[380px] object-cover"
              />
            </div>
          </motion.div>
        </div>

        {/* 유사도 표시 */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-white/60">일치율</span>
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
              className="text-6xl font-bold"
              style={{ color: getColor() }}
            >
              {percent}%
            </motion.span>
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xl font-semibold text-white"
          >
            {getMessage()}
          </motion.span>
        </motion.div>

        {/* 프로그레스 바 (5초 카운트다운) */}
        <motion.div className="mt-2 h-1.5 w-80 overflow-hidden rounded-full bg-white/20">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 5, ease: 'linear' }}
            className="h-full rounded-full"
            style={{ backgroundColor: getColor() }}
          />
        </motion.div>
        <span className="text-xs text-white/40">공이 날아갑니다...</span>
      </motion.div>
    </motion.div>
  );
}
