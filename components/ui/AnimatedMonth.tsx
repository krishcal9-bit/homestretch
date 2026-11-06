'use client';
import { AnimatePresence, motion } from 'motion/react';
import { dur, ease } from '@/lib/motion';

/** Month crossfade: old moves up 8px and fades, new comes in from 8px below. */
export function AnimatedMonth({ text, className = '', testId, wrap = false }: { text: string; className?: string; testId?: string; wrap?: boolean }) {
  return (
    <span className={`relative inline-grid overflow-hidden ${className}`} data-testid={testId} aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          initial={{ y: 8, opacity: 0, filter: 'blur(2px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -8, opacity: 0, filter: 'blur(2px)' }}
          transition={{ duration: dur.short, ease: ease.out }}
          className={`col-start-1 row-start-1 ${wrap ? '' : 'whitespace-nowrap'}`}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
