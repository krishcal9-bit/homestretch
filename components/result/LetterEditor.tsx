'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, FileText } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';
import { Button } from '@/components/ui/Button';

type Finding = { finding: string; whatToDo?: string; kind?: string | null };

/** D4: drafts a letter of explanation, streaming into an editable text area; downloads as PDF. */
export function LetterEditor({ finding }: { finding: Finding }) {
  const { t, lang } = useLang();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const write = async () => {
    setOpen(true);
    setStreaming(true);
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

  // Auto-grow the text area as text streams in (no inner scroll).
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(176, el.scrollHeight + 2)}px`;
  }, [text, open]);

  return (
    <div className="mt-4">
      {!open && (
        <Button variant="secondary" onClick={write} data-testid="write-letter">
          <FileText size={18} strokeWidth={1.75} aria-hidden />
          {t('letter.write')}
        </Button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={spring.smooth} className="overflow-hidden px-[2px] pb-[2px]">
            <label htmlFor={`letter-${finding.finding.slice(0, 12)}`} className="mb-2 mt-1 block text-[15px] font-medium text-ink">
              {t('letter.label')}
            </label>
            <textarea
              ref={area}
              id={`letter-${finding.finding.slice(0, 12)}`}
              data-testid="letter-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-busy={streaming}
              className="field tnum block w-full resize-none py-3 text-[15px] leading-[22px]"
            />
            <p className="t-helper mt-2 text-ink-2">{streaming ? t('letter.writing') : t('letter.editHelp')}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={download} loading={downloading} disabled={streaming || !text}>
                <Download size={18} strokeWidth={1.75} aria-hidden />
                {t('letter.download')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
