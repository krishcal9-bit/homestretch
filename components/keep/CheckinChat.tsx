'use client';
// KEEP · Monthly check-in (/keep/checkin): a text-message-style conversation with three tap questions. Every
// answer updates the Keep profile at once and says, in one sentence, how the forecast moved (lib/keepCheckin).
// At the end the check-in is saved to state.checkins and the messages go out by (mock) text: POST /api/keep-checkin.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { exit as exitT, spring, stagger } from '@/lib/motion';
import { patchProfile, type Checkin, type KeepState } from '@/lib/keepStore';
import type { KeepProfile, SystemKind } from '@/lib/keep';
import { applyAnswer, changeSentence, snapshot, type BillKind, type CheckinAnswer, type ForecastSnapshot } from '@/lib/keepCheckin';
import type { Lang } from '@/lib/types';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { KeepGate, KeepHead } from './KeepFrame';

type Update = (u: Partial<KeepState> | ((s: KeepState) => KeepState)) => void;
type T = (k: string, v?: Record<string, string | number>) => string;
type Msg = { id: number; from: 'bot' | 'me'; text: (t: T, lang: Lang) => string; link?: { href: string; label: string } };
type Stage =
  | 'start'
  | 'bills'
  | 'billKind'
  | 'billAmount'
  | 'income'
  | 'incomeAmount'
  | 'breaking'
  | 'done';

export function CheckinChat() {
  const { t } = useLang();
  return (
    <KeepGate>
      {(state, update) => (
        <>
          <KeepHead title={t('keepCheckin.title')} sub={t('keepCheckin.sub')} />
          <Conversation state={state} update={update} />
        </>
      )}
    </KeepGate>
  );
}

const BILL_FIELD: Record<BillKind, keyof KeepProfile> = { escrow: 'escrow', premium: 'premium', hoa: 'hoa', tax: 'supplementalTax' };
const nextMonthISO = (d = new Date()) => {
  const n = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

function Conversation({ state, update }: { state: KeepState; update: Update }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [queue, setQueue] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>('start');
  const [billKind, setBillKind] = useState<BillKind>('escrow');
  const [amount, setAmount] = useState<number | null>(null);
  const record = useRef<Checkin>({ date: '', newBills: false, incomeChange: 0, breaking: null });
  const nextId = useRef(1);
  const profileRef = useRef(state.profile);
  profileRef.current = state.profile;
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  // the page never scrolls on its own until the family has tapped an answer
  const interacted = useRef(false);

  const bot = useCallback((...texts: (Msg['text'] | { text: Msg['text']; link: Msg['link'] })[]) => {
    setQueue((q) => [...q, ...texts.map((x) => (typeof x === 'function' ? { id: nextId.current++, from: 'bot' as const, text: x } : { id: nextId.current++, from: 'bot' as const, ...x }))]);
  }, []);
  const me = (text: Msg['text']) => setMsgs((m) => [...m, { id: nextId.current++, from: 'me', text }]);

  // the bot "types" each queued message before it lands
  const typing = queue.length > 0;
  useEffect(() => {
    if (!queue.length) return;
    const head = queue[0];
    const id = setTimeout(() => {
      setMsgs((m) => [...m, head]);
      setQueue((q) => (q[0] === head ? q.slice(1) : q));
    }, reduce ? 120 : 700);
    return () => clearTimeout(id);
  }, [queue, reduce]);

  // keep the newest message in view
  useEffect(() => {
    if (!interacted.current) return;
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs.length, typing, stage, reduce]);

  const begin = useCallback(() => {
    record.current = { date: new Date().toISOString(), newBills: false, incomeChange: 0, breaking: null };
    setMsgs([]);
    bot((t) => t('keepCheckin.bot.hello'), (t) => t('keepCheckin.bot.bills'));
    setStage('bills');
  }, [bot]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    begin();
  }, [begin]);

  /** Apply an answer to the profile now; return the one-sentence change. */
  const apply = (a: CheckinAnswer) => {
    const before: ForecastSnapshot = snapshot(profileRef.current);
    const patch = applyAnswer(profileRef.current, a);
    const after = snapshot({ ...profileRef.current, ...patch });
    update((s) => patchProfile(s, patch));
    bot((t, l) => changeSentence(a.q, before, after, l));
  };

  const askIncome = () => {
    bot((t) => t('keepCheckin.bot.income'));
    setStage('income');
  };
  const askBreaking = () => {
    bot((t) => t('keepCheckin.bot.breaking'));
    setStage('breaking');
  };
  const finish = () => {
    const nextOn = nextMonthISO();
    bot((t, l) => t('keepCheckin.bot.thanks', { date: new Intl.DateTimeFormat(l === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric' }).format(new Date(`${nextOn}T12:00:00`)) }));
    setStage('done');
    const rec = { ...record.current };
    update((s) => ({ ...s, checkins: [...s.checkins, rec] }));
  };

  // once the last message has landed, send the conversation by (mock) text
  const sent = useRef(false);
  useEffect(() => {
    if (stage !== 'done' || queue.length || typing || sent.current) return;
    sent.current = true;
    const texts = msgs.filter((m) => m.from === 'bot').map((m) => m.text(t, lang));
    fetch('/api/keep-checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, messages: texts, nextOn: nextMonthISO() }) }).catch(() => {});
    console.log('[sms:mock]', texts.join(' / '));
  }, [stage, queue.length, typing, msgs, t, lang]);

  const choose = (labelKey: string, after: () => void) => {
    interacted.current = true;
    me((t) => t(labelKey));
    after();
  };

  const busy = typing || queue.length > 0;
  const $ = (n: number) => money(n, lang);
  const p = state.profile;

  const choices: { key: string; label: string; on: () => void }[] = (() => {
    switch (stage) {
      case 'bills':
        return [
          { key: 'no', label: t('keepCheckin.ans.noBills'), on: () => choose('keepCheckin.ans.noBills', askIncome) },
          {
            key: 'yes',
            label: t('keepCheckin.ans.yesBill'),
            on: () =>
              choose('keepCheckin.ans.yesBill', () => {
                record.current.newBills = true;
                bot((t) => t('keepCheckin.bot.whichBill'));
                setStage('billKind');
              }),
          },
        ];
      case 'billKind':
        return (['escrow', 'premium', 'hoa', 'tax'] as BillKind[]).map((k) => ({
          key: k,
          label: t(`keepCheckin.bill.${k}`),
          on: () =>
            choose(`keepCheckin.bill.${k}`, () => {
              setBillKind(k);
              const cur = Number(p[BILL_FIELD[k]]) || 0;
              setAmount(cur > 0 ? Math.round(cur) : null);
              bot((t) => t(`keepCheckin.bot.amount.${k}`));
              setStage('billAmount');
            }),
        }));
      case 'income':
        return [
          { key: 'same', label: t('keepCheckin.ans.incomeSame'), on: () => choose('keepCheckin.ans.incomeSame', askBreaking) },
          { key: 'up', label: t('keepCheckin.ans.incomeUp'), on: () => choose('keepCheckin.ans.incomeUp', () => { setAmount(Math.round(p.takeHome) || null); bot((t) => t('keepCheckin.bot.takeHome')); setStage('incomeAmount'); }) },
          { key: 'down', label: t('keepCheckin.ans.incomeDown'), on: () => choose('keepCheckin.ans.incomeDown', () => { setAmount(Math.round(p.takeHome) || null); bot((t) => t('keepCheckin.bot.takeHome')); setStage('incomeAmount'); }) },
        ];
      case 'breaking':
        return [
          { key: 'none', label: t('keepCheckin.ans.nothing'), on: () => choose('keepCheckin.ans.nothing', finish) },
          ...(['water_heater', 'roof', 'hvac', 'appliances'] as SystemKind[]).map((k) => ({
            key: k,
            label: t(`keepHome.kind.${k}`),
            on: () =>
              choose(`keepHome.kind.${k}`, () => {
                record.current.breaking = k;
                apply({ q: 'breaking', kind: k });
                bot({ text: (t) => t('keepCheckin.bot.breakingNext'), link: { href: '/keep/home', label: 'keepCheckin.toHome' } });
                finish();
              }),
          })),
        ];
      default:
        return [];
    }
  })();

  const submitAmount = () => {
    const n = Math.max(0, Math.round(amount ?? 0));
    if (stage === 'billAmount') {
      const k = billKind;
      me((t, l) => t(`keepCheckin.me.amount.${k}`, { amount: money(n, l) }));
      apply({ q: 'bills', kind: k, amount: n });
      askIncome();
    } else {
      const before = Math.round(p.takeHome);
      record.current.incomeChange = n - before;
      me((t, l) => t('keepCheckin.me.amount.takeHome', { amount: money(n, l) }));
      apply({ q: 'income', takeHome: n });
      askBreaking();
    }
    setAmount(null);
  };

  const last = state.checkins[state.checkins.length - 1];
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-12">
      <section aria-label={t('keepCheckin.threadLabel')} className="panel flex min-h-[520px] flex-col !p-0" data-testid="checkin-thread">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pine text-[13px] font-semibold text-on-pine" aria-hidden>
            HS
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink">HomeStretch</p>
            <p className="t-helper text-ink-2">{last && stage === 'start' ? t('keepCheckin.last', { date: new Date(last.date).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric' }) }) : t('keepCheckin.byText')}</p>
          </div>
        </header>
        <ol className="flex flex-1 flex-col gap-2 px-4 py-5" aria-live="polite" aria-relevant="additions">
          {msgs.map((m) => (
            <Bubble key={m.id} from={m.from}>
              {m.text(t, lang)}
              {m.link && (
                <Link href={m.link.href} className="mt-1 block font-medium text-pine underline underline-offset-4">
                  {t(m.link.label)}
                </Link>
              )}
            </Bubble>
          ))}
          <AnimatePresence>{typing && <Typing key="typing" />}</AnimatePresence>
        </ol>
        <div className="border-t border-line px-4 py-4">
          <AnimatePresence mode="wait" initial={false}>
            {!busy && (stage === 'billAmount' || stage === 'incomeAmount') ? (
              <motion.form
                key={`amount-${stage}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: exitT }}
                transition={spring.snappy}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAmount();
                }}
                className="flex items-end gap-2"
              >
                <div className="flex-1">
                  <label htmlFor="checkin-amount" className="t-helper mb-1.5 block text-ink-2">
                    {stage === 'billAmount' ? t(`keepCheckin.unit.${billKind}`) : t('keepCheckin.unit.takeHome')}
                  </label>
                  <CurrencyInput id="checkin-amount" value={amount} onChange={setAmount} />
                </div>
                <Button type="submit" disabled={amount === null} data-testid="checkin-send">
                  {t('keepCheckin.send')}
                </Button>
              </motion.form>
            ) : !busy && choices.length ? (
              <motion.div key={`choices-${stage}`} role="group" aria-label={t('keepCheckin.reply')} className="flex flex-wrap justify-end gap-2" data-testid="checkin-choices">
                {choices.map((c, i) => (
                  <motion.button
                    key={c.key}
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: exitT }}
                    transition={{ ...spring.snappy, delay: Math.min(i, 5) * stagger }}
                    whileTap={{ scale: 0.97 }}
                    onClick={c.on}
                    className="min-h-[44px] rounded-full border border-pine px-4 text-[15px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft"
                  >
                    {c.label}
                  </motion.button>
                ))}
              </motion.div>
            ) : stage === 'done' && !busy ? (
              <motion.div key="again" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] text-ink-2" data-testid="checkin-saved">
                  {t('keepCheckin.saved')}
                </p>
                <Button variant="quiet" onClick={() => { sent.current = false; begin(); }}>
                  {t('keepCheckin.again')}
                </Button>
              </motion.div>
            ) : (
              <div key="wait" className="min-h-[44px]" aria-hidden />
            )}
          </AnimatePresence>
          <div ref={bottom} />
        </div>
      </section>
      <LiveForecast profile={p} $={$} />
    </div>
  );
}

function Bubble({ from, children }: { from: 'bot' | 'me'; children: React.ReactNode }) {
  const mine = from === 'me';
  return (
    <motion.li
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.snappy}
      style={{ transformOrigin: mine ? '100% 100%' : '0% 100%' }}
      className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[16px] leading-[22px] ${mine ? 'self-end rounded-br-[6px] bg-pine text-on-pine' : 'self-start rounded-bl-[6px] bg-paper text-ink'}`}
      data-from={from}
      data-testid="checkin-msg"
    >
      {children}
    </motion.li>
  );
}

function Typing() {
  const { t } = useLang();
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: exitT }} transition={spring.snappy} className="flex self-start rounded-[18px] rounded-bl-[6px] bg-paper px-4 py-3" data-testid="typing">
      <span className="sr-only">{t('keepCheckin.typing')}</span>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="mx-[2px] h-[7px] w-[7px] rounded-full bg-ink-2" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }} aria-hidden />
      ))}
    </motion.li>
  );
}

/** What the answers move, live (wide screens; on phones each answer's sentence says it). */
function LiveForecast({ profile, $ }: { profile: KeepProfile; $: (n: number) => string }) {
  const { t, lang } = useLang();
  const snap = useMemo(() => snapshot(profile), [profile]);
  const rows = [
    { k: 'now', v: snap.now, help: t('keepCheckin.live.nowHelp') },
    { k: 'peak', v: snap.peak, help: snap.peakMonth ? new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${snap.peakMonth}-01T00:00:00Z`)) : '' },
    { k: 'tightest', v: snap.tightest, help: t('keepCheckin.live.tightestHelp') },
    { k: 'repair', v: snap.repair, help: t('keepCheckin.live.repairHelp') },
  ];
  return (
    <aside className="hidden lg:block" aria-labelledby="live-title">
      <div className="sticky top-24">
        <h2 id="live-title" className="t-section text-ink">
          {t('keepCheckin.live.title')}
        </h2>
        <p className="mt-1 text-[15px] text-ink-2">{t('keepCheckin.live.sub')}</p>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.k} className="flex items-baseline justify-between gap-4 py-4">
              <dt>
                <span className="block text-[15px] text-ink">{t(`keepCheckin.live.${r.k}`)}</span>
                <span className="t-helper mt-1 block text-ink-2">{r.help}</span>
              </dt>
              <dd className={`text-[20px] font-semibold ${r.k === 'tightest' && r.v < 0 ? 'text-signal-red' : 'text-ink'}`} data-testid={`live-${r.k}`}>
                <AnimatedNumber value={r.v} format={(n) => (r.k === 'tightest' && n < 0 ? `−${$(-n)}` : $(n))} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
