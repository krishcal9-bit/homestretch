'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { spring, exit as exitT } from '@/lib/motion';
import { Spinner } from '@/components/ui/Spinner';
import { PayStub, SCAN_MS } from '@/components/illustrations/PayStub';

type StubPhase = 'idle' | 'scanning' | 'read';
type State = { kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

/**
 * What a successful upload produces: the message under the card, and optionally a value that flies from the
 * document into a form field (`to` is the field's id); `land` writes it into the form when it arrives.
 */
export type UploadOutcome = string | { message: string; fly: { text: string; to: string; land: () => void } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  /** 'paystub': an illustrated pay stub (PayStub) that is scanned on upload, and the amount it reads flies into the field. */
  art?: 'paystub';
}) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [phase, setPhase] = useState<StubPhase>('idle');
  const [amount, setAmount] = useState<string>();
  // the field the read amount flies into (set while a flight is pending)
  const [flyTo, setFlyTo] = useState<string>();
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
    setFlyTo(undefined);
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
    // The amount shows on the stub, lifts off and flies into the field (PayStub measures and flies it).
    if (reduce) land();
    else setFlyTo(out.fly.to);
  };

  return (
    <div className="panel mt-2 !p-5" data-testid={`upload-${id}`}>
      {/* with art: title and body beside the pay stub, the button full-width below (it never wraps) */}
      <div className={art ? 'flex items-start gap-4' : undefined}>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-ink">{title}</p>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{body}</p>
        </div>
        {art === 'paystub' && <PayStub scanning={phase === 'scanning'} amount={phase === 'read' ? amount : undefined} flyTo={flyTo ? { id: flyTo, inset: 14 } : undefined} onLanded={flyTo ? land : undefined} />}
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
    </div>
  );
}
