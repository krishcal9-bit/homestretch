'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { Slider } from '@/components/ui/Slider';

const THUMB = 24;

/**
 * "Set aside each month": the thumb follows the finger at once; the forecast hears about it at most once a frame
 * (rAF), and the saved value is written when the drag ends. A tick marks the engine's recommended amount.
 */
export function FlattenSlider({ value, max, recommended, onLive, onCommit }: { value: number; max: number; recommended: number; onLive: (v: number) => void; onCommit: (v: number) => void }) {
  const { t, lang } = useLang();
  const [v, setV] = useState(value);
  const dragging = useRef(false);
  const raf = useRef(0);
  const pending = useRef(value);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // an outside change (one tap on the recommendation, a Shock Shield move) moves the thumb too
  useEffect(() => {
    if (!dragging.current) setV(value);
  }, [value]);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );
  const change = (n: number) => {
    setV(n);
    pending.current = n;
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        onLive(pending.current);
      });
    // keyboard and taps commit after a short pause; drags commit on release
    if (commitTimer.current) clearTimeout(commitTimer.current);
    if (!dragging.current) commitTimer.current = setTimeout(() => onCommit(pending.current), 400);
  };
  const f = max > 0 ? Math.min(1, recommended / max) : 0;
  return (
    <div
      onPointerDown={() => {
        dragging.current = true;
      }}
      onPointerUp={() => {
        dragging.current = false;
        onCommit(pending.current);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onCommit(pending.current);
      }}
    >
      {/* stacked, one line each: the value can grow from "$0" to "$1,000" without moving the slider under the finger */}
      <label htmlFor="keep-setaside" className="block truncate text-[15px] font-medium leading-[20px] text-ink-2">
        {t('keep.slider.label')}
      </label>
      <p className="tnum mt-1 whitespace-nowrap text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-ink" data-testid="setaside-value">
        {t('keep.slider.value', { amount: money(v, lang) })}
      </p>
      <div className="relative mt-2">
        <Slider id="keep-setaside" value={v} min={0} max={max} step={1} onChange={change} label={t('keep.slider.label')} valueText={t('keep.slider.value', { amount: money(v, lang) })} />
        {recommended > 0 && recommended <= max && (
          <div className="pointer-events-none relative h-[22px]" aria-hidden>
            <span className="absolute top-0 h-[8px] w-[2px] -translate-x-1/2 rounded-full bg-ink-2" style={{ left: `calc(${f * 100}% + ${(0.5 - f) * THUMB}px)` }} />
            <span
              className="tnum absolute top-[9px] whitespace-nowrap text-[12px] leading-[13px] text-ink-2"
              style={{ left: `calc(${f * 100}% + ${(0.5 - f) * THUMB}px)`, transform: `translateX(${f > 0.8 ? '-100%' : f < 0.2 ? '0' : '-50%'})` }}
            >
              {t('keep.slider.tick', { amount: money(recommended, lang) })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
