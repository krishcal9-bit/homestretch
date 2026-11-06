'use client';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ease } from '@/lib/motion';

/**
 * First visit per session (~2.4s): a pine line draws across the middle of a blank page, rises into a
 * one-stroke house whose door fills brass, "Homestretch" fades in under it, then the camera pulls back:
 * the line scales into the hero's real Road track and the house shrinks onto the Keys marker while the
 * hero assembles underneath. Click or any key skips it.
 */
export const OPEN = { line: 0.15, lineDur: 0.5, house: 0.65, houseDur: 0.6, door: 1.15, text: 1.3, pull: 1.8, pullDur: 0.6 };
export const OPEN_TOTAL = OPEN.pull + OPEN.pullDur;

const HOUSE_W = 112;
const HOUSE_H = 104;
const pullSpring = { type: 'spring', duration: OPEN.pullDur, bounce: 0 } as const;

type Rect = { left: number; top: number; width: number; height: number };

export function Opening({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [pull, setPull] = useState<null | { track: Rect; keys: Rect }>(null);
  const done = useRef(false);

  useEffect(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    // the overlay below is now up; drop the pre-paint veil
    requestAnimationFrame(() => document.documentElement.classList.remove('hs-veil'));
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const finish = (skipped: boolean) => {
      if (done.current) return;
      done.current = true;
      document.documentElement.style.overflow = prev;
      if (skipped) onSkip();
      else onDone();
    };
    const skip = () => finish(true);
    window.addEventListener('pointerdown', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    // Measure the hero's real Road (rendered underneath) at the moment of the pull-back.
    const tPull = setTimeout(() => {
      const track = document.querySelector('[data-testid=sample-road] svg line') as SVGLineElement | null;
      const keys = document.querySelector('[data-testid=sample-road] [data-milestone=keys]') as SVGCircleElement | null;
      if (!track || !keys) return finish(true);
      const tr = track.getBoundingClientRect();
      const kr = keys.getBoundingClientRect();
      setPull({ track: { left: tr.left, top: tr.top + tr.height / 2, width: tr.width, height: tr.height }, keys: { left: kr.left + kr.width / 2, top: kr.top + kr.height / 2, width: kr.width, height: kr.height } });
    }, OPEN.pull * 1000);
    const tDone = setTimeout(() => finish(false), (OPEN_TOTAL + 0.05) * 1000);
    return () => {
      clearTimeout(tPull);
      clearTimeout(tDone);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      document.documentElement.style.overflow = prev;
    };
  }, [onDone, onSkip]);

  if (!vw) return <div className="fixed inset-0 z-[70] bg-paper" aria-hidden />;

  const cy = Math.round(vh / 2);
  const lineW = Math.round(vw * 0.62);
  const houseLeft = lineW;
  const houseTop = cy - HOUSE_H;
  // one continuous stroke from the line's end: up the left wall, over the roof, down the right wall, back to the door
  const house = `M0 ${HOUSE_H} V40 L${HOUSE_W / 2} 4 L${HOUSE_W} 40 V${HOUSE_H} H${HOUSE_W / 2 + 13} V${HOUSE_H - 34} H${HOUSE_W / 2 - 13} V${HOUSE_H}`;

  // Pull-back targets
  const lineTarget = pull ? { x: pull.track.left, y: pull.track.top - cy, scaleX: pull.track.width / lineW } : null;
  const houseScale = pull ? Math.max(0.12, (pull.keys.width * 0.9) / HOUSE_W) : 1;
  const houseTarget = pull ? { x: pull.keys.left - (houseLeft + HOUSE_W / 2), y: pull.keys.top - (houseTop + HOUSE_H / 2), scale: houseScale } : null;

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden data-testid="opening">
      {/* the blank page; fades away as the camera pulls back to reveal the hero */}
      <motion.div className="absolute inset-0 bg-paper" initial={false} animate={{ opacity: pull ? 0 : 1 }} transition={{ duration: 0.45, ease: ease.out }} />

      {/* the line */}
      <motion.div
        className="absolute left-0"
        style={{ top: cy - 2, width: lineW, height: 4, originX: 0, originY: 0.5 }}
        initial={false}
        animate={lineTarget ? { x: lineTarget.x, y: lineTarget.y, scaleX: lineTarget.scaleX, opacity: [1, 1, 0] } : { x: 0, y: 0, scaleX: 1 }}
        transition={lineTarget ? { ...pullSpring, opacity: { duration: OPEN.pullDur, times: [0, 0.75, 1] } } : undefined}
      >
        <svg width={lineW} height="4" className="block overflow-visible">
          <motion.line x1="0" x2={lineW} y1="2" y2="2" stroke="var(--pine)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: OPEN.lineDur, ease: ease.inOut, delay: OPEN.line }} />
        </svg>
      </motion.div>

      {/* the house, rising from the line's end */}
      <motion.div
        className="absolute"
        style={{ left: houseLeft, top: houseTop, width: HOUSE_W, height: HOUSE_H }}
        initial={false}
        animate={houseTarget ? { x: houseTarget.x, y: houseTarget.y, scale: houseTarget.scale, opacity: [1, 1, 0] } : { x: 0, y: 0, scale: 1 }}
        transition={houseTarget ? { ...pullSpring, opacity: { duration: OPEN.pullDur, times: [0, 0.88, 1] } } : undefined}
      >
        <svg width={HOUSE_W} height={HOUSE_H + 2} viewBox={`0 0 ${HOUSE_W} ${HOUSE_H + 2}`} className="block overflow-visible">
          <motion.rect
            x={HOUSE_W / 2 - 13}
            y={HOUSE_H - 34}
            width="26"
            height="34"
            fill="var(--brass)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: ease.out, delay: OPEN.door }}
          />
          <motion.path d={house} fill="none" stroke="var(--pine)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: OPEN.houseDur, ease: ease.inOut, delay: OPEN.house }} />
        </svg>
      </motion.div>

      {/* the name */}
      <motion.p
        className="absolute text-center text-[20px] font-semibold tracking-[-0.01em] text-ink"
        style={{ left: houseLeft - 60, width: HOUSE_W + 120, top: cy + 20 }}
        initial={{ opacity: 0, y: 6 }}
        animate={pull ? { opacity: 0, y: 0, transition: { duration: 0.15 } } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: ease.out, delay: OPEN.text }}
      >
        Homestretch
      </motion.p>
    </div>
  );
}
