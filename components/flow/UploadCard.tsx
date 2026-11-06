'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';
import { Spinner } from '@/components/ui/Spinner';

type State = { kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

/** Camera/file upload card. Posts the file to `endpoint`; `onResult` turns the JSON into a success message. */
export function UploadCard({ id, title, body, button, endpoint, onResult }: { id: string; title: string; body: string; button: string; endpoint: string; onResult: (data: Record<string, unknown>) => string }) {
  const { t, lang } = useLang();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const upload = async (file: File) => {
    setState({ kind: 'reading' });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      const res = await fetch(endpoint, { method: 'POST', body: fd, signal: ctrl.signal });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setState({ kind: 'error', message: data?.error?.message ?? t('upload.genericError') });
      else setState({ kind: 'done', message: onResult(data) });
    } catch {
      setState({ kind: 'error', message: t('upload.genericError') });
    }
  };
  return (
    <div className="panel mt-2 !p-5" data-testid={`upload-${id}`}>
      <p className="text-[16px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{body}</p>
      <input
        ref={input}
        id={`file-${id}`}
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
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border border-line bg-surface px-4 text-[15px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft disabled:opacity-60"
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
              exit={{ opacity: 0 }}
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
