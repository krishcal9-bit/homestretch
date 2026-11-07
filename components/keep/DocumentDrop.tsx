'use client';
import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { exit as exitT, spring } from '@/lib/motion';
import { Spinner } from '@/components/ui/Spinner';
import { patchProfile, useKeep } from '@/lib/keepStore';
import { docFacts, docToPatch } from '@/lib/keepDocs';
import { explainTemplate } from '@/lib/shield';
import { thisMonth } from '@/lib/forecast';
import type { DocumentExtract } from '@/lib/keepSchemas';
import type { KeepProfile } from '@/lib/keep';

export const SAMPLE_NOTICE = '/samples/ramirez-insurance-renewal.png';

type State =
  | { kind: 'idle' }
  | { kind: 'reading'; sample: boolean }
  | { kind: 'done'; message: string; explain: string | null }
  | { kind: 'error'; message: string };

/**
 * Document drop: an insurance renewal or declarations page, an escrow analysis, a property tax bill or an HOA notice.
 * What it reads fills the setup fields (tagged "From your document"), then a one- or two-sentence explanation says
 * what it means for the payment, with numbers from the document and the forecast engine only.
 */
export function DocumentDrop() {
  const { t, lang } = useLang();
  const [, update] = useKeep();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const busy = state.kind === 'reading';

  const explain = async (d: DocumentExtract, profile: KeepProfile) => {
    const facts = docFacts(d, profile, thisMonth());
    if (!facts) return;
    let text = explainTemplate(lang, facts);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const res = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, facts }), signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) text = ((await res.json()) as { text: string }).text || text;
    } catch {}
    setState((s) => (s.kind === 'done' ? { ...s, explain: text } : s));
  };

  const upload = async (file: File, sample = false) => {
    setState({ kind: 'reading', sample });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);
    let res: Response | null = null;
    let data: (DocumentExtract & { error?: { message?: string } }) | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      res = await fetch('/api/extract/document', { method: 'POST', body: fd, signal: ctrl.signal });
      clearTimeout(timer);
      data = await res.json().catch(() => null);
    } catch {
      res = null;
    }
    if (!res || !res.ok || !data) {
      setState({ kind: 'error', message: data?.error?.message || t('keep.doc.error') });
      return;
    }
    const patch = docToPatch(data);
    const fields = (Object.keys(patch) as (keyof KeepProfile)[]).filter((k) => k !== 'insuranceIncrease' && k !== 'hoaGrowth');
    const box: { next?: KeepProfile } = {};
    update((s) => {
      const out = patchProfile(s, patch, 'document');
      box.next = out.profile;
      return out;
    });
    setState({
      kind: 'done',
      message: t('keep.doc.done', { doc: t(`keep.doc.type.${data.documentType}`), fields: fields.map((f) => t(`keep.docField.${f}`)).join(', ') }),
      explain: null,
    });
    if (box.next) void explain(data, box.next);
  };

  const trySample = async () => {
    setState({ kind: 'reading', sample: true });
    try {
      const blob = await (await fetch(SAMPLE_NOTICE)).blob();
      await upload(new File([blob], 'ramirez-insurance-renewal.png', { type: 'image/png' }), true);
    } catch {
      setState({ kind: 'error', message: t('keep.doc.error') });
    }
  };

  return (
    <section className="panel !p-5" data-testid="doc-drop" aria-labelledby="doc-drop-title">
      <div className="flex items-start gap-3">
        <FileText size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-pine" aria-hidden />
        <div className="min-w-0">
          <h2 id="doc-drop-title" className="text-[16px] font-medium leading-[22px] text-ink">
            {t('keep.doc.title')}
          </h2>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{t('keep.doc.body')}</p>
        </div>
      </div>
      <input
        ref={input}
        id="file-keep-doc"
        aria-label={t('keep.doc.upload')}
        tabIndex={-1}
        type="file"
        accept="image/*,application/pdf,.heic,.heif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="press inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border border-line bg-surface px-4 text-[15px] font-medium text-pine hover:bg-pine-soft disabled:opacity-60"
        >
          {busy && !state.sample ? <Spinner /> : <Upload size={18} strokeWidth={1.75} aria-hidden />}
          {busy && !state.sample ? t('keep.doc.reading') : t('keep.doc.upload')}
        </button>
        <button
          type="button"
          onClick={trySample}
          disabled={busy}
          className="press inline-flex min-h-[44px] items-center gap-2 rounded-[8px] px-3 text-[15px] font-medium text-pine hover:bg-pine-soft disabled:opacity-60"
          data-testid="use-sample-notice"
        >
          {busy && state.sample ? <Spinner /> : null}
          {busy && state.sample ? t('keep.doc.reading') : t('keep.doc.sample')}
        </button>
      </div>
      <p className="t-helper mt-3 text-ink-2">{t('keep.doc.privacy')}</p>
      <div aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {(state.kind === 'done' || state.kind === 'error') && (
            <motion.div
              key={state.kind + (state.kind === 'done' ? state.message : state.message)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: exitT }}
              transition={spring.smooth}
              className={`mt-4 border-l-2 pl-3 ${state.kind === 'error' ? 'border-signal-red' : 'border-pine'}`}
            >
              <p role={state.kind === 'error' ? 'alert' : undefined} data-testid={`doc-${state.kind}`} className={`tnum text-[15px] leading-[22px] ${state.kind === 'error' ? 'text-signal-red' : 'text-ink-2'}`}>
                {state.message}
              </p>
              {state.kind === 'done' &&
                (state.explain ? (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring.smooth} className="tnum mt-2 text-[16px] font-medium leading-[24px] text-ink" data-testid="doc-explain">
                    {state.explain}
                  </motion.p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2" aria-label={t('keep.doc.explaining')}>
                    <div className="skeleton h-[16px] w-full" />
                    <div className="skeleton h-[16px] w-2/3" />
                  </div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
