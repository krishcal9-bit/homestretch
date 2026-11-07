'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { ease, spring, exit as exitT } from '@/lib/motion';
import { Spinner } from '@/components/ui/Spinner';
import { PayStubDoc, SCAN_MS, type StubPhase } from '@/components/illustrations/intake/PayStubDoc';

type State = { kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

/**
 * What a successful upload produces: the message under the card, and optionally a value that flies from the
 * document into a form field (`to` is the field's id); `land` writes it into the form when it arrives.
 */
export type UploadOutcome = string | { message: string; fly: { text: string; to: string; land: () => void } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A measured flight: the stub's amount box (`from`) and the transform that puts its text on the field's. */
type Flight = { text: string; from: DOMRect; x: number; y: number; s: number };
const FLY_DELAY = 0.16; // the amount shows on the stub first
const FLY_DUR = 0.4;

/** Camera/file upload card. Posts the file to `endpoint`; `onResult` turns the JSON into a success message. */
export function UploadCard({
  id,
  title,
  body,
  button,
  endpoint,
  onResult,
  art,
}: {
  id: string;
  title: string;
  body: string;
  button: string;
  endpoint: string;
  onResult: (data: Record<string, unknown>) => UploadOutcome;
  /** 'paystub': a pay stub sketch that is scanned on upload, and the amount it reads flies into the field. */
  art?: 'paystub';
}) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [phase, setPhase] = useState<StubPhase>('idle');
  const [amount, setAmount] = useState<string>();
  const [flight, setFlight] = useState<Flight | null>(null);
  // A value in flight is always written into the form, even if the card unmounts before it lands.
  const pendingLand = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      pendingLand.current?.();
      pendingLand.current = null;
    },
    [],
  );
  const land = useCallback(() => {
    const f = pendingLand.current;
    pendingLand.current = null;
    f?.();
    setFlight(null);
  }, []);

  const upload = async (file: File) => {
    setState({ kind: 'reading' });
    if (art) setPhase('scanning');
    const started = performance.now();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);
    let res: Response | null = null;
    let data: Record<string, unknown> & { error?: { message?: string } } = {};
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      res = await fetch(endpoint, { method: 'POST', body: fd, signal: ctrl.signal });
      clearTimeout(timer);
      data = await res.json().catch(() => ({}));
    } catch {
      res = null;
    }
    // Let the scan line finish its sweep (whole sweeps only) before showing what it read.
    if (art && !reduce) {
      const elapsed = performance.now() - started;
      await sleep(Math.ceil(Math.max(elapsed, 1) / SCAN_MS) * SCAN_MS - elapsed);
    }
    if (!res || !res.ok) {
      setPhase('idle');
      setState({ kind: 'error', message: (res && data?.error?.message) || t('upload.genericError') });
      return;
    }
    const out = onResult(data);
    if (typeof out === 'string') {
      setPhase(art ? 'read' : 'idle');
      setState({ kind: 'done', message: out });
      return;
    }
    setAmount(out.fly.text);
    setPhase('read');
    setState({ kind: 'done', message: out.message });
    pendingLand.current = out.fly.land;
    // The amount appears on the stub, then a copy flies into the field (FLIP: measured, transform only).
    requestAnimationFrame(() => {
      const span = amountRef.current;
      const from = span?.getBoundingClientRect();
      const r = document.getElementById(out.fly.to)?.getBoundingClientRect();
      if (reduce || !span || !from || !r || from.width === 0 || r.top < 0 || r.bottom > window.innerHeight) return land();
      // Where the text sits inside the stub's box, so the copy's text lands exactly on the field's text.
      const range = document.createRange();
      range.selectNodeContents(span);
      const txt = range.getBoundingClientRect();
      const s = 16 / 13; // the field's text size over the stub's
      const a = txt.left - from.left;
      const b = txt.top - from.top + txt.height / 2;
      // CurrencyInput draws its "$" 14px in from the left edge; the flying "$5,200" lands on top of it.
      setFlight({ text: out.fly.text, from, x: r.left + 14 - from.left - s * a, y: r.top + r.height / 2 - from.top - s * b, s });
    });
  };

  return (
    <div className="panel mt-2 !p-5" data-testid={`upload-${id}`}>
      {/* with art: title and body beside the sketch, the button full-width below (it never wraps) */}
      <div className={art ? 'flex items-start gap-4' : undefined}>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-ink">{title}</p>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{body}</p>
        </div>
        {art === 'paystub' && <PayStubDoc phase={phase} amount={amount} amountRef={amountRef} />}
      </div>
      <input
        ref={input}
        id={`file-${id}`}
        aria-label={button}
        tabIndex={-1}
        type="file"
        accept="image/*,application/pdf,.heic,.heif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state.kind === 'reading'}
        className="press mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border border-line bg-surface px-4 text-[15px] font-medium text-pine hover:bg-pine-soft disabled:opacity-60"
      >
        {state.kind === 'reading' ? <Spinner /> : <Upload size={18} strokeWidth={1.75} aria-hidden />}
        {state.kind === 'reading' ? t('upload.reading') : state.kind === 'idle' ? button : t('upload.tryAgain')}
      </button>
      <div aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {(state.kind === 'done' || state.kind === 'error') && (
            <motion.p
              key={state.kind + state.message}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: exitT }}
              transition={spring.smooth}
              role={state.kind === 'error' ? 'alert' : undefined}
              data-testid={`upload-${id}-${state.kind}`}
              className={`tnum mt-3 border-l-2 pl-3 text-[15px] leading-[22px] ${state.kind === 'error' ? 'border-signal-red text-signal-red' : 'border-pine text-ink'}`}
            >
              {state.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {flight && createPortal(<FlyingValue key={flight.text + flight.from.top} {...flight} onLand={land} />, document.body)}
    </div>
  );
}

/**
 * The read amount, copied off the stub, flying into the field. It starts exactly over the stub's amount and
 * ends with its text where the field's text sits, at the field's 16px size; then the field takes over.
 */
function FlyingValue({ text, from, x, y, s, onLand }: Flight & { onLand: () => void }) {
  // The amount shows on the stub for a beat, then flies; the timer is a backstop if the animation is cut short.
  useEffect(() => {
    const id = setTimeout(onLand, (FLY_DELAY + FLY_DUR) * 1000 + 300);
    return () => clearTimeout(id);
  }, [onLand]);
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none fixed z-50 flex items-center justify-center rounded-[3px] bg-pine-soft"
      style={{ left: from.left, top: from.top, width: from.width, height: from.height, originX: 0, originY: 0 }}
      initial={{ x: 0, y: 0, scale: 1 }}
      animate={{ x, y, scale: s }}
      transition={{ duration: FLY_DUR, delay: FLY_DELAY, ease: ease.inOut }}
      onAnimationComplete={onLand}
    >
      <span className="tnum text-[13px] leading-[15px] text-ink">{text}</span>
    </motion.span>
  );
}
