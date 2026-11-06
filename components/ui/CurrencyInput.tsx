'use client';
import { useEffect, useState } from 'react';
import { parseMoney } from '@/lib/draft';

const fmt = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));

/** Leading "$" inside the field, thousands separators on blur, accepts pasted "$2,400.00". */
export function CurrencyInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  flash,
  placeholder,
  'aria-label': ariaLabel,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  describedBy?: string;
  flash?: number;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-ink-2" aria-hidden>
        $
      </span>
      <input
        key={flash}
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className={`field tnum pl-[28px] ${flash ? 'just-filled' : ''} ${invalid ? 'border-signal-red' : ''}`}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        onBlur={() => {
          setFocused(false);
          setText(fmt(parseMoney(text)));
        }}
      />
    </div>
  );
}
