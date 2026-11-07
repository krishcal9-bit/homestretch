'use client';
import { Minus, Plus } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { dur, ease, exit } from '@/lib/motion';

const bezier = (e: readonly number[]) => `cubic-bezier(${e.join(',')})`;

/**
 * The stepper's number rolls in the direction it changed: up for more, down for fewer (old out 10px and
 * fading, new in from the other side; lib/motion durations and ease). Two spans share one grid cell and the
 * roll runs on the Web Animations API, so a tap costs no layout, no stylesheet and no per-frame JS: a stepper
 * is tapped many times in a row, and AnimatePresence "popLayout" forced a full style recalc on every tap.
 */
function RollingValue({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const cur = useRef<HTMLSpanElement>(null);
  const old = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useLayoutEffect(() => {
    const from = prev.current;
    if (from === value) return;
    prev.current = value;
    const o = old.current;
    const c = cur.current;
    if (!o || !c || reduce || typeof c.animate !== 'function') return;
    const d = value > from ? 1 : -1;
    o.textContent = String(from);
    c.animate([{ transform: `translateY(${10 * d}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: dur.short * 1000, easing: bezier(ease.out) });
    o.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-10 * d}px)`, opacity: 0 }], { duration: exit.duration * 1000, easing: bezier(exit.ease) });
  }, [value, reduce]);
  return (
    <span className="relative inline-grid overflow-hidden">
      <span ref={old} className="col-start-1 row-start-1 whitespace-nowrap opacity-0" />
      <span ref={cur} className="col-start-1 row-start-1 whitespace-nowrap">
        {value}
      </span>
    </span>
  );
}

export function Stepper({
  id,
  value,
  min,
  max,
  onChange,
  decLabel,
  incLabel,
  flash,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  decLabel: string;
  incLabel: string;
  flash?: number;
}) {
  const [focused, setFocused] = useState(false);
  // Stable handlers (latest value via a ref), so the ± buttons don't re-render on every tap.
  const latest = useRef({ value, min, max, onChange });
  useLayoutEffect(() => {
    latest.current = { value, min, max, onChange };
  });
  const dec = useCallback(() => {
    const l = latest.current;
    l.onChange(Math.max(l.min, l.value - 1));
  }, []);
  const inc = useCallback(() => {
    const l = latest.current;
    l.onChange(Math.min(l.max, l.value + 1));
  }, []);
  return (
    <div className="inline-flex w-fit items-center rounded-[8px] border border-line bg-surface">
      <StepButton side="l" disabled={value <= min} label={decLabel} onClick={dec} />
      <div className="relative">
      <input
        key={flash}
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`tnum h-[48px] w-[56px] border-x border-line bg-transparent text-center text-[18px] font-medium ${focused ? '' : 'text-transparent'} [appearance:textfield] focus:outline-none focus-visible:bg-pine-soft [&::-webkit-inner-spin-button]:appearance-none`}
      />
        {flash ? <span key={`w${flash}`} className="fill-wash !inset-0 !rounded-none" aria-hidden /> : null}
        {/* the number rolls when it changes (input stays underneath for typing and a11y) */}
        {!focused && (
          <span className="tnum pointer-events-none absolute inset-0 flex items-center justify-center text-[18px] font-medium text-ink" aria-hidden>
            <RollingValue value={value} />
          </span>
        )}
      </div>
      <StepButton side="r" disabled={value >= max} label={incLabel} onClick={inc} />
    </div>
  );
}

const BTN =
  'flex h-[48px] w-[52px] items-center justify-center text-pine transition-[color,background-color,scale] duration-[120ms,120ms,160ms] ease-[ease,ease,var(--ease-out)] hover:bg-pine-soft active:scale-[0.92] disabled:text-line disabled:hover:bg-transparent disabled:active:scale-100';

/**
 * − / + with press feedback. The press is a CSS :active scale (compositor, no JS on pointerdown), and the
 * button is memoized so it renders only when it becomes enabled or disabled: a tap stays cheap on slow phones.
 */
const StepButton = memo(function StepButton({ side, disabled, label, onClick }: { side: 'l' | 'r'; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`${BTN} ${side === 'l' ? 'rounded-l-[8px]' : 'rounded-r-[8px]'}`} disabled={disabled} aria-label={label} onClick={onClick}>
      {side === 'l' ? <Minus size={18} strokeWidth={1.75} /> : <Plus size={18} strokeWidth={1.75} />}
    </button>
  );
});
