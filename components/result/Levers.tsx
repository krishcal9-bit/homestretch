'use client';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { Slider } from '@/components/ui/Slider';
import { parseMoney } from '@/lib/draft';
import type { Levers as LeversT } from '@/lib/types';
import { useEffect, useState } from 'react';

export const LEVER_DEFS: { key: keyof LeversT; max: number; step: number }[] = [
  { key: 'extraDebt', max: 500, step: 10 },
  { key: 'monthlySavings', max: 1000, step: 10 },
  { key: 'coApplicantIncome', max: 3000, step: 50 },
];

function NumberTwin({ id, value, max, onChange, label }: { id: string; value: number; max: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(Math.round(value)));
  }, [value, focused]);
  return (
    <div className="relative w-[96px] shrink-0">
      <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[15px] text-ink-2" aria-hidden>
        $
      </span>
      <input
        id={id}
        inputMode="numeric"
        aria-label={label}
        className="field tnum !min-h-[40px] !pl-[22px] !pr-2 text-right text-[15px]"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseMoney(e.target.value);
          if (n !== null) onChange(Math.min(max, n));
        }}
      />
    </div>
  );
}

export function Levers({ levers, onChange }: { levers: LeversT; onChange: (l: LeversT) => void }) {
  const { t, lang } = useLang();
  return (
    <div className="flex flex-col gap-5">
      {LEVER_DEFS.map(({ key, max: baseMax, step }) => {
        // A solved value (D1) can exceed the default range; stretch the range to fit it.
        const max = Math.max(baseMax, Math.ceil(levers[key] / 100) * 100);
        const label = t(`result.lever.${key}`);
        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor={`lever-${key}`} className="text-[15px] font-medium leading-[20px] text-ink">
                {label}
              </label>
              <NumberTwin id={`lever-${key}-n`} value={levers[key]} max={key === 'coApplicantIncome' ? 3000 : key === 'extraDebt' ? 800 : 1500} label={`${label} ($)`} onChange={(v) => onChange({ ...levers, [key]: v })} />
            </div>
            <Slider
              id={`lever-${key}`}
              value={levers[key]}
              min={0}
              max={max}
              step={step}
              label={label}
              valueText={t('result.perMonth', { amount: money(levers[key], lang) })}
              onChange={(v) => onChange({ ...levers, [key]: v })}
            />
          </div>
        );
      })}
    </div>
  );
}
