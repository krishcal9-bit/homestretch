'use client';
import { motion, useReducedMotion } from 'motion/react';
import { P, alpha } from '@/lib/illustrationPalette';

/**
 * The saved plan code as a split-flap board: each character sits on a slate tile with a hinge across its
 * middle; the lower flap falls forward from the hinge and settles with a little bounce (left to right,
 * 50ms apart), shading as it turns toward the light. The board is drawn in its own layer under the code's
 * text, which stays transparent on top: the element's innerText (copy and paste, the e2e) is exactly the code.
 */
const TILE = {
  top: `linear-gradient(180deg, ${P.slateLight}, ${P.slate})`,
  bottom: `linear-gradient(180deg, ${P.slate}, ${P.slateDark})`,
};
const HALF =
  'absolute inset-x-0 h-1/2 overflow-hidden text-center before:absolute before:inset-x-0 before:block before:h-[52px] before:leading-[52px] before:content-[attr(data-ch)]';
const CELL = 'mr-[6px] inline-block h-[52px] w-[40px] align-top last:mr-0';

export function SplitFlapCode({ code, play }: { code: string; play: boolean }) {
  const reduce = useReducedMotion();
  const animateIn = play && !reduce;
  const chars = code.split('');
  return (
    <div className="relative mt-2 inline-block text-[28px] font-semibold">
      <div aria-hidden className="tnum absolute inset-0 whitespace-nowrap">
        {chars.map((ch, i) => {
          const delay = 0.1 + i * 0.05;
          return (
            <span key={`${code}-${i}`} className={`relative [perspective:220px] ${CELL}`}>
              {/* the blank flap the new one falls over */}
              <span className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-[8px]" style={{ background: TILE.bottom }} />
              <span data-ch={ch} className={`${HALF} top-0 rounded-t-[8px] before:top-0`} style={{ background: TILE.top, color: P.boardInk }} />
              <motion.span
                data-ch={ch}
                className={`${HALF} bottom-0 rounded-b-[8px] before:-top-[26px]`}
                style={{ background: TILE.bottom, color: P.boardInk, transformOrigin: '50% 0%', backfaceVisibility: 'hidden' }}
                initial={animateIn ? { rotateX: 92 } : false}
                animate={{ rotateX: 0 }}
                transition={{ type: 'spring', duration: 0.5, bounce: 0.32, delay }}
              >
                {/* the falling flap is in shade until it faces the light */}
                <motion.span className="absolute inset-0" style={{ background: alpha(P.ink, 0.45) }} initial={animateIn ? { opacity: 1 } : false} animate={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut', delay: delay + 0.05 }} />
              </motion.span>
              {/* the hinge: a dark seam with a lit lip under it, and the two pins at the ends */}
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-px" style={{ background: P.slateDark }} />
              <span className="absolute inset-x-0 top-1/2 h-px opacity-25" style={{ background: P.glassLight }} />
              <span className="absolute left-[2px] top-1/2 h-[6px] w-[3px] -translate-y-1/2 rounded-[1px]" style={{ background: P.slateDark }} />
              <span className="absolute right-[2px] top-1/2 h-[6px] w-[3px] -translate-y-1/2 rounded-[1px]" style={{ background: P.slateDark }} />
              {/* the top edge catches the light */}
              <span className="absolute inset-x-[6px] top-0 h-px opacity-40" style={{ background: P.glassLight }} />
            </span>
          );
        })}
      </div>
      <p className="tnum relative whitespace-nowrap leading-[52px] text-transparent selection:bg-pine-soft/50" data-testid="plan-code">
        {chars.map((ch, i) => (
          <span key={i} className={`${CELL} text-center`}>
            {ch}
          </span>
        ))}
      </p>
    </div>
  );
}
