'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PenaltyEvent, HazardType } from '@/lib/game/types';

interface PenaltyOverlayProps {
  penalty: PenaltyEvent;
  onDismiss: () => void;
  /** Auto dismiss after this many milliseconds */
  dismissAfter?: number;
}

const HAZARD_ICONS: Record<HazardType, string> = {
  water: '💧',
  bunker: '⛱️',
  ob: '🚫',
  tree: '🌲',
};

const HAZARD_COLORS: Record<HazardType, string> = {
  water: 'from-blue-500/30 to-blue-900/50',
  bunker: 'from-yellow-500/30 to-yellow-900/50',
  ob: 'from-red-500/30 to-red-900/50',
  tree: 'from-green-500/30 to-green-900/50',
};

const HAZARD_BORDER: Record<HazardType, string> = {
  water: 'border-blue-400',
  bunker: 'border-yellow-400',
  ob: 'border-red-400',
  tree: 'border-green-400',
};

/**
 * Animated overlay shown when the ball enters a hazard.
 * Displays penalty strokes and hazard type with appropriate styling.
 */
export function PenaltyOverlay({
  penalty,
  onDismiss,
  dismissAfter = 3000,
}: PenaltyOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, dismissAfter);
    return () => clearTimeout(timer);
  }, [onDismiss, dismissAfter]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      {/* Background flash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.5 }}
        className={`absolute inset-0 bg-gradient-to-b ${HAZARD_COLORS[penalty.type]}`}
      />

      {/* Penalty card */}
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: -20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={`
          relative px-8 py-6 rounded-2xl
          bg-black/80 backdrop-blur-lg
          border-2 ${HAZARD_BORDER[penalty.type]}
          shadow-2xl
        `}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-6xl text-center mb-4"
        >
          {HAZARD_ICONS[penalty.type]}
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-white font-bold text-center mb-2"
        >
          {penalty.message}
        </motion.p>

        {/* Penalty strokes */}
        {penalty.strokes > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="text-3xl font-bold text-red-400 text-center"
          >
            +{penalty.strokes} 벌타
          </motion.div>
        )}

        {/* Progress bar */}
        <motion.div
          className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: dismissAfter / 1000, ease: 'linear' }}
            className={`h-full ${penalty.type === 'water' ? 'bg-blue-400' : penalty.type === 'ob' ? 'bg-red-400' : 'bg-yellow-400'}`}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
