'use client';
import { animate } from 'motion/react';
import { useEffect, useState, type RefObject } from 'react';
import { ease } from '@/lib/motion';

export type DrawPhase = 'pending' | 'drawing' | 'done';

/**
 * Draws a chart's line paths left to right (their drawn length, as pathLength does) with a glowing dot riding
 * each line's leading end. `scope` holds the chart; `selector` finds its line paths in draw order; `dots`
 * are absolutely positioned elements over the chart's SVG (same origin), moved with transform only.
 * Starts once `go` is true and the paths exist; the dots settle into small end points.
 */
export function useLineDraw(scope: RefObject<HTMLElement | null>, selector: string, dots: RefObject<(HTMLElement | null)[]>, go: boolean, reduce: boolean, { duration = 0.95, stagger = 0.14 } = {}) {
  const [phase, setPhase] = useState<DrawPhase>('pending');
  useEffect(() => {
    if (!go) return;
    let raf = 0;
    let tries = 0;
    const runs: { stop: () => void }[] = [];
    const start = () => {
      const root = scope.current;
      const paths = root ? Array.from(root.querySelectorAll<SVGPathElement>(selector)) : [];
      const lens = paths.map((p) => p.getTotalLength());
      if ((paths.length === 0 || lens.some((l) => !l)) && tries++ < 120) {
        raf = requestAnimationFrame(start);
        return;
      }
      const ds = dots.current ?? [];
      const place = (i: number, v: number) => {
        const p = paths[i];
        const dot = ds[i];
        if (!p || !dot) return;
        const pt = p.getPointAtLength(lens[i] * v);
        dot.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
      };
      if (reduce || paths.length === 0) {
        paths.forEach((_, i) => place(i, 1));
        setPhase('done');
        return;
      }
      paths.forEach((p, i) => {
        p.style.strokeDasharray = `${lens[i]} ${lens[i]}`;
        p.style.strokeDashoffset = `${lens[i]}`;
        place(i, 0);
      });
      setPhase('drawing');
      let left = paths.length;
      paths.forEach((p, i) =>
        runs.push(
          animate(0, 1, {
            duration,
            ease: ease.inOut,
            delay: i * stagger,
            onUpdate: (v) => {
              p.style.strokeDashoffset = `${lens[i] * (1 - v)}`;
              place(i, v);
            },
            onComplete: () => {
              // hand the path back to the chart (it may redraw on resize)
              p.style.strokeDasharray = '';
              p.style.strokeDashoffset = '';
              if (--left === 0) setPhase('done');
            },
          }),
        ),
      );
    };
    raf = requestAnimationFrame(start);
    return () => {
      cancelAnimationFrame(raf);
      runs.forEach((r) => r.stop());
    };
  }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  return phase;
}
