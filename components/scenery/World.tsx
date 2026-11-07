'use client';
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { Sky } from './Sky';
import { Horizon, HZ } from './Horizon';

/**
 * The landing page's world: one continuous Orange County neighborhood behind every section. Fixed to the
 * viewport (sections slide over it): the sky shifts from late afternoon at the top of the page to golden hour
 * by the last section; the horizon band sits along the bottom. Parallax by depth (far 0.15, mid 0.4,
 * front 1, max 16px): layers lag a little while a section scrolls and settle when it lands, and lean a
 * touch away from the cursor. All transforms; nothing under reduced motion.
 * Sets --street-bottom (px from the viewport bottom to the street) so the hero's house can stand on it.
 */
export const BAND_H = 'clamp(150px, 26vh, 250px)';

/** A layer's parallax at depth d: leans away from the cursor, lags mid-scroll (max 16px at d = 1). */
function useLayer(d: number, cx: MotionValue<number>, cy: MotionValue<number>, lag: MotionValue<number>) {
  const x = useTransform(cx, (v) => -v * 16 * d);
  const y = useTransform([lag, cy] as const, ([l, v]: number[]) => l * 16 * d - v * 6 * d);
  return { x, y };
}

export function World() {
  const reduce = !!useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const golden = useTransform(scrollYProgress, [0, 0.15, 0.85], [0, 0, 1]);
  const [goldenNow, setGoldenNow] = useState(0);
  useMotionValueEvent(golden, 'change', (v) => {
    const q = Math.round(v * 5) / 5; // the lamps and porch lights only need a few steps
    setGoldenNow((g) => (g === q ? g : q));
  });
  // a triangle wave per section: 0 at rest, 1 mid-scroll
  const lag = useTransform(scrollY, (y) => {
    if (reduce || typeof window === 'undefined') return 0;
    const p = (y / Math.max(1, window.innerHeight - 64)) % 1;
    return 1 - Math.abs(2 * p - 1);
  });
  const cx = useSpring(0, { stiffness: 60, damping: 20 });
  const cy = useSpring(0, { stiffness: 60, damping: 20 });
  useEffect(() => {
    if (reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      cx.set((e.clientX / window.innerWidth) * 2 - 1);
      cy.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [cx, cy, reduce]);
  const far = useLayer(0.15, cx, cy, lag);
  const mid = useLayer(0.4, cx, cy, lag);
  const front = useLayer(1, cx, cy, lag);

  // where the street is, for the hero's house
  useEffect(() => {
    const set = () => {
      const band = document.querySelector<HTMLElement>('[data-world-band]');
      if (!band) return;
      const r = band.getBoundingClientRect();
      const s = Math.max(r.width / HZ.w, r.height / HZ.h);
      document.documentElement.style.setProperty('--street-bottom', `${Math.round((HZ.h - HZ.street) * s)}px`);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden data-testid="world">
      <Sky golden={golden} clouds={!reduce} birds={!reduce} />
      <div className="absolute inset-x-0 bottom-0" style={{ height: BAND_H }} data-world-band>
        <Horizon layers={reduce ? undefined : { far, mid, front }} golden={goldenNow} life={!reduce} />
      </div>
    </div>
  );
}
