'use client';
import { motion } from 'motion/react';

/**
 * The saved plan code as a split-flap board: each character sits on its own tile with the split line across
 * it (a pseudo-element), and flips down into place (rotateX -90° → 0, 40ms apart). Tiles are inline-block
 * with no whitespace or block-level children, so the element's innerText is exactly the code (the e2e reads it).
 */
export function SplitFlapCode({ code, play }: { code: string; play: boolean }) {
  return (
    <p className="tnum mt-2 whitespace-nowrap [perspective:480px]" data-testid="plan-code">
      {code.split('').map((ch, i) => {
        const delay = 0.08 + i * 0.04;
        return (
          <motion.span
            key={`${code}-${i}`}
            className="relative mr-[6px] inline-block h-[52px] w-[40px] rounded-[8px] border border-line bg-paper text-center align-top text-[28px] font-semibold leading-[50px] text-ink after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-line after:content-[''] last:mr-0"
            style={{ transformOrigin: '50% 50%', backfaceVisibility: 'hidden' }}
            initial={play ? { rotateX: -90, opacity: 0 } : false}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ rotateX: { type: 'spring', duration: 0.45, bounce: 0.2, delay }, opacity: { duration: 0.08, delay } }}
          >
            {ch}
          </motion.span>
        );
      })}
    </p>
  );
}
