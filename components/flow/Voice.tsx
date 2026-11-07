'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mic, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { spring, reveal } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import type { SpeechFields } from '@/lib/speech';

type RecResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<RecResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
const getRecognition = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
/** Set for the session once the browser's speech service has failed (Brave, Chromium, Safari with dictation off…). */
const OFF_KEY = 'hs.voiceOff';
/** How long a recognizer may take to start before we call it unavailable (longer while a permission prompt is up). */
const START_WAIT = 5000;
const PROMPT_WAIT = 20000;
/** The microphone never stays open longer than this. */
const MAX_LISTEN = 60000;

type Fail = 'blocked' | 'unavailable' | 'noMic' | 'noSpeech';
const FAIL: Record<string, Fail> = {
  'not-allowed': 'blocked',
  'audio-capture': 'noMic',
  'no-speech': 'noSpeech',
  network: 'unavailable',
  'service-not-allowed': 'unavailable',
  'language-not-supported': 'unavailable',
  'bad-grammar': 'unavailable',
};

/**
 * D3: mic button + panel. Speech (Web Speech API) or typed text → /api/parse-speech → form fills.
 * Speech recognition is only as good as the browser's service, so every way it can fail ends in a clear message
 * and the typing panel: a blocked microphone, no microphone, nothing heard, or a browser without a working
 * service (that one hides the mic for the rest of the visit). What was heard is submitted even when the browser
 * never marks it final. Phones listen for one utterance (Android's continuous mode repeats phrases).
 * Memoized: with a stable `onFields` it doesn't re-render on every keystroke or stepper tap.
 */
export const VoiceControl = memo(function VoiceControl({ screen, onFields }: { screen: 'household' | 'income' | 'housing' | 'money'; onFields: (f: SpeechFields) => number }) {
  const { t, lang } = useLang();
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState<null | 'voice' | 'type'>(null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // tone: ok (filled), info (what to do instead), error (the parse failed)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null);
  const rec = useRef<Rec | null>(null);
  const heard = useRef({ final: '', interim: '' });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let off = false;
    try {
      off = !!sessionStorage.getItem(OFF_KEY);
    } catch {}
    setSupported(!!getRecognition() && !off);
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  // leaving the screen cancels (never submits) whatever was being heard
  useEffect(
    () => () => {
      clearTimers();
      const r = rec.current;
      rec.current = null;
      try {
        r?.abort();
      } catch {}
    },
    [],
  );

  const submit = async (transcript: string) => {
    if (!transcript.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/parse-speech', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript, lang, screen }) });
      const data = await res.json();
      if (!res.ok) throw new Error();
      const n = onFields(data.fields ?? {});
      setMsg(n > 0 ? { tone: 'ok', text: t('voice.filled', { n }) } : { tone: 'info', text: t('voice.nothing') });
    } catch {
      setMsg({ tone: 'error', text: t('voice.error') });
    } finally {
      setBusy(false);
    }
  };
  // the recognizer's callbacks outlive the render that started it: always call the latest submit
  const submitRef = useRef(submit);
  submitRef.current = submit;

  /** hide: the browser's service is broken for good this visit (not just slow or waiting on a prompt) */
  const fail = (why: Fail, hide = why === 'unavailable') => {
    setListening(false);
    setOpen('type');
    setMsg({ tone: 'info', text: t(`voice.${why}`) });
    if (hide) {
      try {
        sessionStorage.setItem(OFF_KEY, '1');
      } catch {}
      setSupported(false);
    }
    requestAnimationFrame(() => textRef.current?.focus());
  };
  const failRef = useRef(fail);
  failRef.current = fail;

  /** Stop listening and use what was heard. */
  const finish = () => {
    try {
      rec.current?.stop();
    } catch {}
  };
  /** Stop listening and throw it away (the panel closed). */
  const cancel = () => {
    clearTimers();
    const r = rec.current;
    rec.current = null;
    setListening(false);
    try {
      r?.abort();
    } catch {}
  };

  const listen = () => {
    const R = getRecognition();
    if (!R) return fail('unavailable');
    cancel();
    setOpen('voice');
    setMsg(null);
    setText('');
    heard.current = { final: '', interim: '' };
    let r: Rec;
    try {
      r = new R();
    } catch {
      return fail('unavailable');
    }
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    r.lang = lang === 'es' ? 'es-US' : 'en-US';
    r.interimResults = true;
    r.continuous = !mobile;
    r.maxAlternatives = 1;
    let started = false;
    let error: string | null = null;
    const mine = () => rec.current === r;
    r.onstart = () => {
      started = true;
    };
    r.onresult = (e) => {
      if (!mine()) return;
      started = true;
      let fin = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else interim += res[0].transcript;
      }
      heard.current = { final: fin.trim(), interim: interim.trim() };
      setText(`${fin} ${interim}`.replace(/\s+/g, ' ').trim());
    };
    r.onerror = (e) => {
      error = e?.error ?? 'unknown';
    };
    r.onend = () => {
      if (!mine()) return;
      clearTimers();
      rec.current = null;
      setListening(false);
      const said = (heard.current.final || heard.current.interim).trim();
      if (said) return submitRef.current(said);
      if (error && error !== 'aborted') return failRef.current(FAIL[error] ?? 'unavailable');
      failRef.current(started ? 'noSpeech' : 'unavailable');
    };
    rec.current = r;
    setListening(true);
    // A recognizer that never starts (no speech service in this browser) is unavailable — unless the
    // browser is still asking for the microphone, in which case keep waiting.
    let waited = 0;
    const watch = () => {
      timers.current.push(
        setTimeout(async () => {
          waited += START_WAIT;
          if (!mine() || started) return;
          let state = 'unknown';
          try {
            state = (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
          } catch {}
          if (!mine() || started) return;
          if (state === 'prompt' && waited < PROMPT_WAIT) return watch();
          cancel();
          // still waiting on a prompt nobody answered: say so, but keep the mic for another try
          failRef.current(state === 'denied' ? 'blocked' : 'unavailable', state !== 'prompt');
        }, START_WAIT),
      );
    };
    watch();
    timers.current.push(setTimeout(() => mine() && finish(), MAX_LISTEN));
    try {
      r.start();
    } catch {
      cancel();
      fail('unavailable');
    }
  };

  return (
    <>
      {supported ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring.snappy}
          onClick={() => (listening ? finish() : listen())}
          aria-label={listening ? t('voice.stop') : t('voice.speak')}
          aria-pressed={listening}
          data-testid="mic"
          className={`relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms] ${listening ? 'border-pine bg-pine text-on-pine' : 'border-line bg-surface text-pine hover:bg-pine-soft'}`}
        >
          {/* while the mic is open, a soft ring breathes around it */}
          {listening && <span className="voice-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden />}
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
            <motion.div {...reveal}>
              <div className="panel mt-4 !p-4" data-testid="voice-panel">
                <div className="flex items-start justify-between gap-3">
                  <label htmlFor="voice-text" className="text-[15px] font-medium text-ink">
                    {open === 'voice' && listening ? t('voice.listening') : t('voice.typeLabel')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      cancel();
                      setOpen(null);
                      setMsg(null);
                    }}
                    aria-label={t('voice.close')}
                    className="-m-3 flex h-[44px] w-[44px] items-center justify-center text-ink-2 hover:text-ink"
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>
                <textarea
                  ref={textRef}
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
                    <Button type="button" variant="secondary" onClick={finish} data-testid="voice-done">
                      {t('voice.stop')}
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" loading={busy} onClick={() => submit(text)} disabled={!text.trim()} data-testid="voice-fill">
                      {t('voice.fill')}
                    </Button>
                  )}
                </div>
                <div aria-live="polite" className="min-h-[22px]">
                  {msg && (
                    <p className={`mt-3 text-[15px] ${msg.tone === 'error' ? 'border-l-2 border-signal-red pl-3 text-signal-red' : msg.tone === 'ok' ? 'text-ink' : 'text-ink-2'}`} data-testid="voice-msg">
                      {msg.text}
                    </p>
                  )}
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
