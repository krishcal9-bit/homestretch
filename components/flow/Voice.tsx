'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mic, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { spring, exit as exitT } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import type { SpeechFields } from '@/lib/speech';

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const getRecognition = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * D3: mic button + panel. Speech (Web Speech API) or typed text → /api/parse-speech → form fills.
 * Memoized: with a stable `onFields` it doesn't re-render on every keystroke or stepper tap.
 */
export const VoiceControl = memo(function VoiceControl({ screen, onFields }: { screen: 'household' | 'income' | 'housing' | 'money'; onFields: (f: SpeechFields) => number }) {
  const { t, lang } = useLang();
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState<null | 'voice' | 'type'>(null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rec = useRef<Rec | null>(null);
  const finalText = useRef('');

  useEffect(() => setSupported(!!getRecognition()), []);
  useEffect(() => () => rec.current?.stop(), []);

  const submit = async (transcript: string) => {
    if (!transcript.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/parse-speech', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript, lang, screen }) });
      const data = await res.json();
      if (!res.ok) throw new Error();
      const n = onFields(data.fields ?? {});
      setMsg(n > 0 ? { ok: true, text: t('voice.filled', { n }) } : { ok: false, text: t('voice.nothing') });
    } catch {
      setMsg({ ok: false, text: t('voice.error') });
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const R = getRecognition();
    if (!R) return setOpen('type');
    setOpen('voice');
    setMsg(null);
    setText('');
    finalText.current = '';
    const r = new R();
    r.lang = lang === 'es' ? 'es-US' : 'en-US';
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      let interim = '';
      let fin = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else interim += res[0].transcript;
      }
      finalText.current = fin;
      setText((fin + ' ' + interim).trim());
    };
    r.onend = () => {
      setListening(false);
      const said = finalText.current || text;
      if (said) submit(said);
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <>
      {supported ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring.snappy}
          onClick={() => (listening ? rec.current?.stop() : listen())}
          aria-label={listening ? t('voice.stop') : t('voice.speak')}
          aria-pressed={listening}
          data-testid="mic"
          className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms] ${listening ? 'border-pine bg-pine text-white' : 'border-line bg-surface text-pine hover:bg-pine-soft'}`}
        >
          <Mic size={18} strokeWidth={1.75} aria-hidden />
        </motion.button>
      ) : null}
      <VoicePanelPortal>
        {!open && (
          <button type="button" onClick={() => setOpen('type')} className="mt-1 min-h-[44px] text-[15px] font-medium text-pine underline-offset-4 hover:underline" data-testid="type-instead">
            {t('voice.typeInstead')}
          </button>
        )}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, transition: exitT }} transition={spring.smooth} className="overflow-hidden">
              <div className="panel mt-4 !p-4">
                <div className="flex items-start justify-between gap-3">
                  <label htmlFor="voice-text" className="text-[15px] font-medium text-ink">
                    {open === 'voice' && listening ? t('voice.listening') : t('voice.typeLabel')}
                  </label>
                  <button type="button" onClick={() => { rec.current?.stop(); setOpen(null); }} aria-label={t('voice.close')} className="-m-3 flex h-[44px] w-[44px] items-center justify-center text-ink-2 hover:text-ink">
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>
                <textarea
                  id="voice-text"
                  data-testid="voice-text"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('voice.typePlaceholder')}
                  className="field mt-2 block w-full resize-none py-3 text-[15px] leading-[22px]"
                />
                <div className="mt-3 flex items-center gap-3">
                  {listening ? (
                    <Button type="button" variant="secondary" onClick={() => rec.current?.stop()}>
                      {t('voice.stop')}
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" loading={busy} onClick={() => submit(text)} disabled={!text.trim()} data-testid="voice-fill">
                      {t('voice.fill')}
                    </Button>
                  )}
                </div>
                <div aria-live="polite" className="min-h-[22px]">
                  {msg && <p className={`mt-3 text-[15px] ${msg.ok ? 'text-ink' : 'text-signal-red'}`}>{msg.text}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </VoicePanelPortal>
    </>
  );
});

/** Renders the panel just below the screen title (sibling slot), so the mic stays next to the title. */
function VoicePanelPortal({ children }: { children: React.ReactNode }) {
  return <div className="basis-full">{children}</div>;
}
