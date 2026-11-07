'use client';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAnimate } from 'motion/react';
import { Download, FileText } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { PaperSheet, PAD_BOTTOM, PAD_TOP, RULE } from '@/components/illustrations/result/PaperSheet';

type Finding = { finding: string; whatToDo?: string; kind?: string | null };
const AREA = 'tnum block w-full resize-none overflow-hidden bg-transparent px-5 text-[15px] leading-[24px] text-ink outline-none';

/**
 * D4: drafts a letter of explanation. A sheet of paper slides up, the letter is written onto it line by
 * line (it stays an editable text area on the paper), a pen signs the signature line, and "Download letter"
 * pulses once when it's done.
 */
export function LetterEditor({ finding }: { finding: Finding }) {
  const { t, lang } = useLang();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [written, setWritten] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [textLines, setTextLines] = useState(0);
  const [pulseScope, pulse] = useAnimate<HTMLSpanElement>();
  const id = `letter-${finding.finding.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '')}`;

  const write = async () => {
    setOpen(true);
    setStreaming(true);
    setWritten(false);
    setText('');
    try {
      const res = await fetch('/api/letter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ finding, lang }) });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((s) => s + dec.decode(value, { stream: true }));
      }
    } catch {
      setText((s) => s || t('upload.genericError'));
    } finally {
      setStreaming(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/pdf/letter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter-of-explanation-${lang}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setDownloading(false);
    }
  };

  // Auto-grow the text area with its text (no inner scroll), always a whole number of ruled lines.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    const used = text ? Math.ceil((el.scrollHeight - PAD_TOP - PAD_BOTTOM) / RULE) : 0;
    setTextLines(used);
    el.style.height = `${PAD_TOP + Math.max(10, used) * RULE + PAD_BOTTOM}px`;
  }, [text, open]);

  const onWritten = () => {
    setWritten(true);
    if (pulseScope.current) pulse(pulseScope.current, { scale: [1, 1.04, 1] }, { duration: 0.4, ease: ease.out });
  };
  const busy = streaming || !written;
  const ghost = useRef<HTMLTextAreaElement>(null);
  const [signTop, setSignTop] = useState<number | null>(null);
  // the letter's signature line ("______"), once the text is complete
  const sign = useMemo(() => {
    if (streaming) return null;
    const m = /_{6,}/.exec(text);
    return m ? { before: text.slice(0, m.index), line: m[0], after: text.slice(m.index + m[0].length) } : null;
  }, [text, streaming]);
  useLayoutEffect(() => {
    const g = ghost.current;
    const a = area.current;
    if (!sign || !g || !a) {
      setSignTop(null);
      return;
    }
    const measure = () => {
      g.style.width = `${a.offsetWidth}px`;
      g.value = sign.before + sign.line;
      g.style.height = '0px';
      setSignTop(g.scrollHeight - PAD_BOTTOM - RULE);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(a);
    return () => ro.disconnect();
  }, [sign]);

  return (
    <div className="mt-4">
      {!open && (
        <Button variant="secondary" onClick={write} data-testid="write-letter">
          <FileText size={18} strokeWidth={1.75} aria-hidden />
          {t('letter.write')}
        </Button>
      )}
      {open && (
        <div>
          <label htmlFor={id} className="mb-2 mt-1 block text-[15px] font-medium text-ink">
            {t('letter.label')}
          </label>
          <PaperSheet streaming={streaming} minLines={10} lineCount={textLines} onWritten={onWritten}>
            <div className="relative">
            {/* the signature line, found by measuring the letter up to it in an identical (hidden) text area, so the
                pen signs exactly over the "______" whatever the wrapping */}
            {sign && (
              <>
                <textarea ref={ghost} aria-hidden tabIndex={-1} readOnly rows={1} className={`${AREA} pointer-events-none invisible absolute left-0 top-0`} style={{ paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }} />
                {signTop !== null && (
                  <span data-sign-line aria-hidden className="tnum pointer-events-none invisible absolute left-5 whitespace-pre text-[15px] leading-[24px]" style={{ top: signTop }}>
                    {sign.line}
                  </span>
                )}
              </>
            )}
            <textarea
              ref={area}
              id={id}
              data-testid="letter-text"
              value={text}
              rows={1}
              readOnly={busy}
              onChange={(e) => setText(e.target.value)}
              aria-busy={busy}
              spellCheck={!busy}
              className={AREA}
              style={{ paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM, outline: 'none' }}
            />
            </div>
          </PaperSheet>
          <p className="t-helper mt-3 text-ink-2" aria-live="polite">
            {busy ? t('letter.writing') : t('letter.editHelp')}
          </p>
          <div className="mt-3">
            <span ref={pulseScope} className="inline-block">
              <Button variant="secondary" onClick={download} loading={downloading} disabled={busy || !text}>
                <Download size={18} strokeWidth={1.75} aria-hidden />
                {t('letter.download')}
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
