'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { MessageSquareText, Route, ListChecks } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { computeReadiness } from '@/lib/engine';
import { monthName, money } from '@/lib/format';
import { ease } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { AnimatedMonth } from '@/components/ui/AnimatedMonth';
import { Road } from '@/components/result/Road';
import type { Profile } from '@/lib/types';

/**
 * The landing page is the one flagship surface. One orchestrated load sequence, ~1.2s total:
 * headline lines rise blur-to-sharp → the Road draws Today to Keys → markers pop in → the sample date rolls up.
 * Everything after that waits for the visitor.
 */
const SEQ = {
  line: 0.45, // each headline line
  lineGap: 0.08,
  sub: 0.2,
  card: 0.2,
  roadAt: 0.3,
  roadDraw: 0.5,
  markerStagger: 0.04,
  dateAt: 1.0,
  date: 0.2,
  cta: 0.45,
};

/** Fictional sample family for the interactive road. */
const SAMPLE: Profile = {
  householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherMonthlyIncome: 0,
  rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: [{ kind: 'card', balance: 2100, minPayment: 65 }, { kind: 'collection', balance: 1900, minPayment: 0 }],
  savings: 3100, creditBand: 'needs_work', openCollections: 1,
  levers: { extraDebt: 150, monthlySavings: 150, coApplicantIncome: 0 },
};

/** Split a headline into two lines at its comma, or at the space nearest the middle. */
function twoLines(text: string): string[] {
  const comma = text.indexOf(', ');
  if (comma > 0) return [text.slice(0, comma + 1), text.slice(comma + 2)];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

function Headline({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <h1 className="t-title text-[clamp(30px,8vw,40px)] leading-[1.12] text-ink" aria-label={text}>
      {twoLines(text).map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]" aria-hidden>
          <motion.span
            className="block"
            initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 0, filter: 'blur(8px)' }}
            animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: reduce ? 0.15 : SEQ.line, ease: ease.out, delay: reduce ? 0 : i * SEQ.lineGap }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function SampleRoad({ reduce }: { reduce: boolean }) {
  const { t, lang } = useLang();
  const [extra, setExtra] = useState(SAMPLE.levers.extraDebt);
  const result = useMemo(() => computeReadiness({ ...SAMPLE, levers: { ...SAMPLE.levers, extraDebt: extra } }), [extra]);
  return (
    <motion.section
      aria-labelledby="sample-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.15 : SEQ.card, ease: ease.out, delay: reduce ? 0 : SEQ.card }}
      className="panel mt-8 !p-5"
      data-testid="sample-road"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="sample-title" className="text-[16px] font-semibold leading-[22px] text-ink">
            {t('welcome.sampleTitle')}
          </h2>
          <p className="t-helper mt-1 leading-[18px] text-ink-2">{t('welcome.sampleWho')}</p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden">
        <p className="text-[13px] text-ink-2">{t('welcome.sampleReady')}</p>
        <motion.p
          initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          transition={{ duration: reduce ? 0.15 : SEQ.date, ease: ease.out, delay: reduce ? 0 : SEQ.dateAt }}
          className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-brass"
        >
          <AnimatedMonth text={monthName(result.readyDate, lang)} testId="sample-date" />
        </motion.p>
      </div>
      <div className="-mx-1 mt-1">
        <Road result={result} entrance={reduce ? 'none' : 'always'} entranceDelay={SEQ.roadAt} drawDuration={SEQ.roadDraw} markerStagger={SEQ.markerStagger} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <label htmlFor="sample-extra" className="text-[15px] font-medium text-ink">
          {t('welcome.sampleLever')}
        </label>
        <span className="tnum text-[15px] font-medium text-ink">{t('result.perMonth', { amount: money(extra, lang) })}</span>
      </div>
      <Slider id="sample-extra" value={extra} min={0} max={400} step={10} onChange={setExtra} label={t('welcome.sampleLever')} valueText={money(extra, lang)} />
      <p className="t-helper mt-1 text-ink-2">{t('welcome.sampleNote')}</p>
    </motion.section>
  );
}

const HOW = [
  { icon: MessageSquareText, title: 'welcome.how1', body: 'welcome.how1b' },
  { icon: Route, title: 'welcome.how2', body: 'welcome.how2b' },
  { icon: ListChecks, title: 'welcome.how3', body: 'welcome.how3b' },
];

export function Welcome({ onStart }: { onStart?: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const reduce = !!useReducedMotion();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const fade = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.15 : 0.35, ease: ease.out, delay: reduce ? 0 : delay },
  });
  return (
    <section className="pb-8 pt-8">
      <motion.p {...fade(0)} className="t-helper mb-3 text-ink-2">
        {t('app.partner')}
      </motion.p>
      <Headline text={t('welcome.title')} reduce={reduce} />
      <motion.p {...fade(SEQ.sub)} className="mt-3 text-ink-2">
        {t('welcome.sub')}
      </motion.p>

      <SampleRoad reduce={reduce} />

      <motion.div {...fade(SEQ.cta)} className="mt-6">
        <Button size="lg" full onClick={onStart}>
          {t('welcome.start')}
        </Button>
      </motion.div>

      <section aria-labelledby="how-title" className="mt-14">
        <h2 id="how-title" className="t-section text-ink">
          {t('welcome.howTitle')}
        </h2>
        <ul className="mt-5 flex flex-col gap-6">
          {HOW.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="mt-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[8px] bg-pine-soft text-pine">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-medium text-ink">{t(title)}</span>
                <span className="mt-1 block text-[15px] leading-[22px] text-ink-2">{t(body)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="t-helper mt-8 border-l-2 border-pine pl-3 text-ink-2">{t('welcome.privacy')}</p>
      </section>

      <div className="mt-10 border-t border-line pt-6 text-[15px] text-ink-2">
        {!showCode ? (
          <p>
            {t('welcome.haveCode')}{' '}
            <button type="button" className="min-h-[44px] font-medium text-pine underline-offset-4 hover:underline" onClick={() => setShowCode(true)}>
              {t('welcome.openWithCode')}
            </button>
          </p>
        ) : (
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) router.push(`/plan/${code.trim().toUpperCase()}`);
            }}
          >
            <label className="flex-1">
              <span className="mb-2 block text-[15px] font-medium text-ink">{t('welcome.codeLabel')}</span>
              <input autoFocus className="field uppercase tracking-[0.08em]" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            </label>
            <Button type="submit" variant="secondary">
              {t('welcome.openPlan')}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
