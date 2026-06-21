'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ImageZoomDialogProps {
  /** 표시할 이미지 URL. null이면 닫힘. */
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/** 이미지를 화면 중앙에 크게 띄우는 팝업 다이얼로그 (X 버튼 / 바깥 클릭으로 닫기). */
export function ImageZoomDialog({ src, alt = '', onClose }: ImageZoomDialogProps) {
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
        >
          {/* X 버튼 */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white/80 transition hover:bg-white/20 hover:text-white"
            title="닫기"
          >
            ✕
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={src}
            alt={alt}
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl ring-1 ring-white/15"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
