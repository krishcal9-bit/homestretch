'use client';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { Counts, RiskLevel as Level } from '@/lib/forecast';
import { spring } from '@/lib/motion';
import { RiskLevel } from './RiskLevel';

// Homeowners by risk level, without and with support: two horizontal bars per level on one fixed scale (all
// homes), so a bar's length is its share of the portfolio. Bars morph on spring.smooth as the controls move
// (interruptible, keeps velocity when retargeted); the counts at their ends roll. Transforms only: each bar is a
// 1px body scaled to length plus a rounded 4px cap that moves along, so the data end never stretches.

const LEVELS: Level[] = ['stable', 'watch', 'act'];
const BEFORE = 'var(--chart-base)';
const AFTER = 'var(--pine)';
const BAR = 14;
const CAP = 8;
const NUM_W = 40; // room for the count after the bar
const whole = (n: number) => String(Math.round(n));

function Bar({ value, total, width, fill, testId }: { value: number; total: number; width: number; fill: string; testId: string }) {
  const reduce = !!useReducedMotion();
  const target = total > 0 ? (Math.max(0, value) / total) * Math.max(0, width - NUM_W) : 0;
  const w = useMotionValue(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduce) {
      first.current = false;
      w.jump(target);
      return;
    }
    const c = animate(w, target, spring.smooth);
    return () => c.stop();
  }, [target, reduce, w]);
  return <BarShape w={w} fill={fill} value={value} testId={testId} />;
}

function BarShape({ w, fill, value, testId }: { w: MotionValue<number>; fill: string; value: number; testId: string }) {
  const body = useTransform(w, (v) => Math.max(0, v - CAP / 2));
  const capX = useTransform(w, (v) => v - CAP);
  const numX = useTransform(w, (v) => v + 8);
  return (
    <div className="relative" style={{ height: BAR }}>
      <div className="absolute inset-y-0 left-0 right-0 overflow-hidden">
        <motion.div className="absolute inset-y-0 left-0 w-px" style={{ background: fill, scaleX: body, originX: 0 }} />
        <motion.div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: CAP, background: fill, x: capX }} />
      </div>
      <motion.span className="absolute top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink" style={{ x: numX, left: 0 }} data-testid={testId} data-value={value}>
        <AnimatedNumber speed="snappy" value={value} format={whole} />
      </motion.span>
    </div>
  );
}

export function StressChart({ before, after, total, label }: { before: Counts; after: Counts; total: number; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <figure className="m-0" data-testid="stress-chart">
      <div className="flex items-center gap-5 text-[13px] text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BEFORE }} />
          With the shock, no support
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: AFTER }} />
          With support
        </span>
      </div>
      <div className="mt-3 border-b border-line" role="img" aria-label={label}>
        {LEVELS.map((l, i) => (
          <div key={l} className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-4 border-t border-line py-4">
            <div className="text-[15px]">
              <RiskLevel level={l} />
            </div>
            <div ref={i === 0 ? wrap : undefined} className="flex flex-col gap-[3px]">
              {width > 0 ? (
                <>
                  <Bar value={before[l]} total={total} width={width} fill={BEFORE} testId={`bar-before-${l}`} />
                  <Bar value={after[l]} total={total} width={width} fill={AFTER} testId={`bar-after-${l}`} />
                </>
              ) : (
                <div style={{ height: BAR * 2 + 3 }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Homeowners by risk level, with the shock and with support</caption>
        <thead>
          <tr>
            <th scope="col">Risk level</th>
            <th scope="col">No support</th>
            <th scope="col">With support</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => (
            <tr key={l}>
              <th scope="row">{l === 'act' ? 'Act now' : l === 'watch' ? 'Watch' : 'Stable'}</th>
              <td>{before[l]}</td>
              <td>{after[l]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
