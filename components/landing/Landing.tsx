'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { Mic } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, isEligible } from '@/lib/engine';
import { homeFits } from '@/lib/homes';
import { monthName, money } from '@/lib/format';
import { ease, spring } from '@/lib/motion';
import { useVTRouter } from '@/lib/vt';
import { SEED_FAMILIES, SEED_HOMES } from '@/lib/seedData';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { AnimatedMonth } from '@/components/ui/AnimatedMonth';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Road } from '@/components/result/Road';
import { StaffLink, Wordmark } from '@/components/FamilyHeader';
import type { MilestoneKey, Profile } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Load sequence (seconds from first paint). One movement, ~1.4s.      */
/* ------------------------------------------------------------------ */
const SEQ = {
  line: 0.45, // each headline line slides up from 100%
  lineStagger: 0.08,
  sub: 0.35, // subline + buttons fade up 12px
  roadAt: 0.5, // track draws 0.5 → 1.3s, markers pop as the line reaches them
  roadDraw: 0.8,
  dateAt: 0.9, // date odometer 0.9 → 1.4s
  date: 0.5,
  nudgeAt: 1.4, // slider thumb nudge
};

type Phase = 'pending' | 'play' | 'static' | 'reduced';

/** Decides once per visit whether the intro plays. Before hydration everything holds its final layout, invisibly. */
function useIntroPhase(): Phase {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('pending');
  useEffect(() => {
    if (reduce) return setPhase('reduced');
    let played = false;
    try {
      played = !!sessionStorage.getItem('hs.landingPlayed');
      sessionStorage.setItem('hs.landingPlayed', '1');
    } catch {}
    setPhase(played ? 'static' : 'play');
  }, [reduce]);
  return phase;
}

/* ------------------------------------------------------------------ */
/* Sample families                                                      */
/* ------------------------------------------------------------------ */
const FAMILIES: Record<'reyes' | 'nguyen', Profile> = {
  reyes: {
    householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherMonthlyIncome: 0,
    rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
    debts: [{ kind: 'card', balance: 2100, minPayment: 65 }, { kind: 'collection', balance: 1900, minPayment: 0 }],
    savings: 3100, creditBand: 'needs_work', openCollections: 1, levers: { extraDebt: 150, monthlySavings: 150, coApplicantIncome: 0 },
  },
  nguyen: {
    householdSize: 3, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 6400, otherMonthlyIncome: 0,
    rent: 2200, bedrooms: 2, occupants: 3, unsafeConditions: false,
    debts: [{ kind: 'car', balance: 6000, minPayment: 290 }, { kind: 'card', balance: 1800, minPayment: 55 }],
    savings: 2400, creditBand: 'building', levers: { extraDebt: 100, monthlySavings: 300, coApplicantIncome: 0 },
  },
};

const shiftMonth = (iso: string, k: number) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Headline: measured line by line, each line slides up through a mask  */
/* ------------------------------------------------------------------ */
function Headline({ text, phase }: { text: string; phase: Phase }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const words = text.split(' ');
  useLayoutEffect(() => {
    setLines(null);
  }, [text]);
  useLayoutEffect(() => {
    if (lines || !ref.current) return;
    const spans = Array.from(ref.current.querySelectorAll<HTMLSpanElement>('[data-w]'));
    const out: string[][] = [];
    let top = -1;
    for (const s of spans) {
      if (Math.abs(s.offsetTop - top) > 4) {
        out.push([]);
        top = s.offsetTop;
      }
      out[out.length - 1].push(s.textContent ?? '');
    }
    setLines(out.map((l) => l.join(' ')));
  }, [lines, text]);
  const cls = 'text-[40px] font-semibold leading-[44px] tracking-[-0.02em] text-ink sm:text-[52px] sm:leading-[56px] xl:mr-[-32px] xl:text-[64px] xl:leading-[68px]';
  if (!lines || phase === 'pending')
    return (
      <h1 ref={ref} className={cls} style={{ visibility: 'hidden', textWrap: 'wrap' }} data-intro>
        {words.map((w, i) => (
          <span key={i} data-w>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
    );
  const play = phase === 'play';
  return (
    <h1 className={cls} aria-label={text} style={{ textWrap: 'wrap' }}>
      {lines.map((line, i) => (
        <span key={`${line}-${i}`} className="block overflow-hidden" aria-hidden>
          <motion.span
            className="block whitespace-nowrap"
            initial={play ? { y: '100%' } : phase === 'reduced' ? { opacity: 0 } : false}
            animate={{ y: '0%', opacity: 1 }}
            transition={play ? { duration: SEQ.line, ease: ease.out, delay: i * SEQ.lineStagger } : { duration: 0.15 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

/** Ready date that counts in like an odometer through earlier months, then swaps vertically on change. */
function OdometerDate({ iso, phase, lang }: { iso: string; phase: Phase; lang: 'en' | 'es' }) {
  // Unsettled only while the intro plays; decided when the phase is known (not during the pre-hydration render).
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    setSettled(phase !== 'play');
  }, [phase]);
  const final = monthName(iso, lang);
  const lineH = 1.05; // em
  if (!settled) {
    const strip = [-3, -2, -1, 0].map((k) => monthName(shiftMonth(iso, k), lang));
    return (
      <span className="relative block overflow-hidden" style={{ height: `${lineH}em` }}>
        <motion.span
          className="block"
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: `-${(strip.length - 1) * lineH}em`, opacity: 1 }}
          transition={{ y: { duration: SEQ.date, ease: ease.out, delay: SEQ.dateAt }, opacity: { duration: 0.12, delay: SEQ.dateAt } }}
          onAnimationComplete={() => setSettled(true)}
        >
          {strip.map((s, i) => (
            <span key={i} className="block whitespace-nowrap" style={{ height: `${lineH}em`, lineHeight: `${lineH}em` }}>
              {s}
            </span>
          ))}
        </motion.span>
      </span>
    );
  }
  return (
    <motion.span className="block" style={{ height: `${lineH}em`, lineHeight: `${lineH}em` }} initial={phase === 'reduced' ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <AnimatedMonth text={final} testId="sample-date" />
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero demo                                                            */
/* ------------------------------------------------------------------ */
function HeroDemo({ phase }: { phase: Phase }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [family, setFamily] = useState<'reyes' | 'nguyen'>('reyes');
  const [extra, setExtra] = useState<Record<string, number>>({ reyes: FAMILIES.reyes.levers.extraDebt, nguyen: FAMILIES.nguyen.levers.extraDebt });
  const profile = FAMILIES[family];
  const result = useMemo(() => computeReadiness({ ...profile, levers: { ...profile.levers, extraDebt: extra[family] } }), [profile, extra, family]);
  const play = phase === 'play';

  // Cursor-aware depth (desktop pointers only): the Road tilts up to 2° toward the cursor.
  const rx = useSpring(0, { stiffness: 120, damping: 20 });
  const ry = useSpring(0, { stiffness: 120, damping: 20 });
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce), [reduce]);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!fine) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    ry.set(nx * 2);
    rx.set(-ny * 2);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  const fade = (delay: number) =>
    play ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: ease.out, delay } } : { initial: phase === 'reduced' ? { opacity: 0 } : false, animate: { opacity: 1 }, transition: { duration: 0.15 } };

  return (
    <div className="relative [perspective:1200px]" onPointerMove={onMove} onPointerLeave={reset} data-testid="sample-road" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
      <motion.div {...fade(SEQ.sub)} className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-[280px]">
          <Segmented<'reyes' | 'nguyen'>
            size="sm"
            label={t('landing.families')}
            value={family}
            onChange={setFamily}
            options={[
              { value: 'reyes', label: t('landing.reyes') },
              { value: 'nguyen', label: t('landing.nguyen') },
            ]}
          />
        </div>
        <p className="t-helper min-h-[15px] text-ink-2">
          <AnimatedMonth wrap text={t(family === 'reyes' ? 'landing.reyesWho' : 'landing.nguyenWho')} />
        </p>
      </motion.div>

      <div className="relative mt-8 [container-type:inline-size]">
        {/* The only decoration: a faint pine glow behind the date. */}
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-[260px] w-[520px] max-w-full" style={{ background: 'radial-gradient(closest-side, rgba(30,92,71,0.08), transparent)' }} />
        <motion.p {...fade(SEQ.dateAt - 0.1)} className="relative text-[15px] text-ink-2">
          {t('landing.readyBy')}
        </motion.p>
        <p className="tnum relative mt-1 text-[min(80px,13cqw)] font-semibold tracking-[-0.02em] text-brass" aria-live="polite">
          <OdometerDate iso={result.readyDate} phase={phase} lang={lang} />
        </p>
      </div>

      <motion.div className="mt-6 origin-center" style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>
        {phase !== 'pending' && <Road result={result} size="lg" entrance={play ? 'always' : 'none'} entranceDelay={SEQ.roadAt} drawDuration={SEQ.roadDraw} drawEase="inOut" />}
        {phase === 'pending' && <div className="h-[92px]" />}
      </motion.div>

      <motion.div {...fade(SEQ.roadAt + 0.3)} className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="sample-extra" className="text-[16px] font-medium text-ink">
            {t('landing.lever')}
          </label>
          <span className="tnum text-[16px] font-medium text-ink">
            <AnimatedNumber value={extra[family]} format={(n) => t('result.perMonth', { amount: money(n, lang) })} />
          </span>
        </div>
        <Slider
          id="sample-extra"
          size="lg"
          value={extra[family]}
          min={0}
          max={400}
          step={10}
          onChange={(v) => setExtra((x) => ({ ...x, [family]: v }))}
          label={t('landing.lever')}
          valueText={money(extra[family], lang)}
          nudgeAt={play ? SEQ.nudgeAt : undefined}
        />
      </motion.div>
    </div>
  );
}

function Hero({ phase }: { phase: Phase }) {
  const { t } = useLang();
  const router = useVTRouter();
  const reduce = useReducedMotion();
  const play = phase === 'play';
  const fadeUp = play
    ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: ease.out, delay: SEQ.sub } }
    : { initial: phase === 'reduced' ? { opacity: 0 } : false, animate: { opacity: 1 }, transition: { duration: 0.15 } };
  return (
    <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-x-8 gap-y-14 px-5 pb-16 pt-10 lg:min-h-[calc(100svh-64px)] lg:grid-cols-12 lg:px-8 lg:py-12">
      <div className="lg:col-span-6 xl:col-span-5">
        <motion.p {...fadeUp} transition={play ? { duration: 0.3, ease: ease.out } : fadeUp.transition} className="mb-5 text-[15px] text-ink-2">
          {t('app.partner')}
        </motion.p>
        <Headline text={t('landing.headline')} phase={phase} />
        <motion.p {...fadeUp} className="mt-6 max-w-[44ch] text-[18px] leading-[28px] text-ink-2 lg:text-[20px] lg:leading-[30px]" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
          {t('landing.sub')}
        </motion.p>
        <motion.div {...fadeUp} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
          <motion.a
            href="/start"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              router.push('/start', 'start');
            }}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            className="inline-flex min-h-[56px] items-center rounded-[8px] bg-pine px-8 text-[20px] font-medium text-white transition-colors duration-[120ms] hover:bg-pine-hover"
            style={{ viewTransitionName: 'cta' }}
            data-testid="find-my-date"
          >
            {t('landing.cta')}
          </motion.a>
          <a
            href="#story"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('story')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            }}
            className="hit inline-flex min-h-[44px] items-center text-[17px] font-medium text-pine underline-offset-4 hover:underline"
          >
            {t('landing.how')}
          </a>
        </motion.div>
      </div>
      <div className="lg:col-span-6 xl:col-span-7 xl:pl-8">
        <HeroDemo phase={phase} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll story                                                         */
/* ------------------------------------------------------------------ */
const Caption = ({ children }: { children: React.ReactNode }) => <h2 className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em] text-ink lg:text-[40px] lg:leading-[44px]">{children}</h2>;

/** Scene 1: a phone running the intake; fields fill one at a time as if spoken. */
function PhoneScene() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const [filled, setFilled] = useState(0);
  const [heard, setHeard] = useState(false);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (p > 0.22) setHeard(true);
    setFilled(Math.max(0, Math.min(4, Math.floor((p - 0.26) / 0.05) + 1)));
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const fields: [string, string][] = [
    [t('landing.phonePeople'), '4'],
    [t('landing.phoneOC'), t('landing.phoneYes')],
    [t('landing.phoneIncome'), '$5,200'],
    [t('landing.phoneRent'), '$2,350'],
  ];
  return (
    <section ref={ref} className="mx-auto grid min-h-[80vh] max-w-[1280px] grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-12 lg:px-8" data-testid="scene-intake">
      <div className="lg:col-span-5">
        <Caption>{t('landing.s1')}</Caption>
        <p className="mt-4 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">{t('landing.s1b')}</p>
      </div>
      <motion.div style={{ y }} className="flex justify-center lg:col-span-7">
        {/* Phone: pure CSS frame */}
        <div className="w-[300px] rounded-[44px] border-[10px] border-ink bg-paper p-4 pt-3" aria-hidden>
          <div className="mx-auto mb-3 h-[22px] w-[96px] rounded-full bg-ink" />
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="scale-90 origin-left">
              <Wordmark />
            </span>
          </div>
          <div className="mt-2 h-[3px] w-full bg-line">
            <div className="h-full w-1/4 bg-pine" />
          </div>
          <div className="mt-4 flex items-start justify-between gap-2">
            <p className="text-[19px] font-semibold leading-[24px] text-ink">{t('landing.phoneTitle')}</p>
            <motion.span
              className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-pine"
              animate={heard ? { scale: [1, 1.18, 1] } : undefined}
              transition={{ duration: 0.6, ease: ease.inOut }}
            >
              <motion.span className="absolute inset-0 rounded-full bg-pine-soft" initial={{ opacity: 0 }} animate={heard ? { opacity: [0, 1, 0] } : undefined} transition={{ duration: 0.6 }} />
              <Mic size={16} strokeWidth={1.75} className="relative" />
            </motion.span>
          </div>
          <motion.p className="mt-2 text-[12px] italic leading-[16px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: heard ? 1 : 0 }} transition={{ duration: 0.3 }}>
            {t('landing.phoneSaid')}
          </motion.p>
          <div className="mt-3 flex flex-col gap-3 pb-4">
            {fields.map(([label, value], i) => (
              <div key={label}>
                <p className="mb-1 text-[11px] font-medium text-ink">{label}</p>
                <div className="tnum relative flex h-[34px] items-center overflow-hidden rounded-[6px] border border-line bg-surface px-2 text-[14px] text-ink">
                  {/* the just-filled pulse: an opacity-only overlay */}
                  <motion.span className="absolute inset-0 bg-pine-soft" initial={false} animate={{ opacity: i < filled ? [1, 0] : 0 }} transition={{ duration: 0.6 }} />
                  <motion.span className="relative" initial={false} animate={{ opacity: i < filled ? 1 : 0, y: i < filled ? 0 : 4 }} transition={{ duration: 0.2, ease: ease.out }}>
                    {value}
                  </motion.span>
                </div>
              </div>
            ))}
            <div className="mt-1 flex h-[38px] items-center justify-center rounded-[6px] bg-pine text-[13px] font-medium text-white">{t('app.continue')}</div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/** One caption in the pinned-road scene; reports when it's the one in view. */
function StoryCaption({ title, body, onActive }: { title: string; body: string; onActive: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);
  return (
    <div ref={ref} className="flex min-h-[70vh] items-center">
      <div>
        {/* Inactive captions dim only the large title (still ≥ 3:1); body text keeps full contrast. */}
        <motion.div animate={{ opacity: inView ? 1 : 0.6 }} transition={{ duration: 0.25, ease: ease.out }}>
          <Caption>{title}</Caption>
        </motion.div>
        <p className="mt-3 max-w-[36ch] text-[18px] leading-[28px] text-ink-2">{body}</p>
      </div>
    </div>
  );
}

/** Scene 2: the Road pinned while captions scroll past, each lighting up its milestone. */
function RoadScene() {
  const { t } = useLang();
  const [active, setActive] = useState<MilestoneKey>('collections');
  const result = useMemo(() => computeReadiness(FAMILIES.reyes), []);
  const caps: { key: MilestoneKey; title: string; body: string }[] = [
    { key: 'collections', title: t('landing.c1'), body: t('landing.c1b') },
    { key: 'savings', title: t('landing.c2'), body: t('landing.c2b') },
    { key: 'keys', title: t('landing.c3'), body: t('landing.c3b') },
  ];
  return (
    <section className="mx-auto max-w-[1280px] px-5 lg:px-8" data-testid="scene-road">
      <div className="pt-20">
        <Caption>{t('landing.s2')}</Caption>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="sticky top-16 z-10 order-first bg-paper py-6 lg:order-last lg:col-span-7 lg:flex lg:h-[calc(100svh-64px)] lg:items-center lg:bg-transparent lg:py-0">
          <div className="w-full">
            <Road result={result} size="lg" entrance="none" highlight={[active]} />
          </div>
        </div>
        <div className="lg:col-span-5">
          {caps.map((c) => (
            <StoryCaption key={c.key} title={c.title} body={c.body} onActive={() => setActive(c.key)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Scene 3: the staff Homes view in a browser frame; counts climb from 0 as it scrolls in. */
function HomesScene() {
  const { t, lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const rows = useMemo(() => {
    const fams = SEED_FAMILIES.map((f) => ({ f, r: computeReadiness(f.profile) })).filter((x) => isEligible(x.r));
    return SEED_HOMES.slice(0, 6).map((h) => ({
      h,
      ready: fams.filter((x) => homeFits(x.f.profile.householdSize, h.bedrooms) && x.r.monthsToReady <= monthsUntil(h.completion)).length,
    }));
  }, []);
  return (
    <section className="mx-auto grid min-h-[80vh] max-w-[1280px] grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-12 lg:px-8" data-testid="scene-homes">
      <div className="lg:col-span-4">
        <Caption>{t('landing.s3')}</Caption>
        <p className="mt-4 max-w-[36ch] text-[18px] leading-[28px] text-ink-2">{t('landing.s3b')}</p>
      </div>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, ease: ease.out }}
        className="overflow-hidden rounded-[14px] border border-line bg-surface lg:col-span-8"
        aria-hidden
      >
        {/* Browser frame */}
        <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="ml-4 rounded-[6px] bg-surface px-3 py-1 text-[12px] text-ink-2">homestretch · staff · homes</span>
        </div>
        <div className="p-6">
          <p className="text-[20px] font-semibold text-ink">{t('landing.browserTitle')}</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-8 border-b border-line pb-2 text-[13px] text-ink-2">
            <span>{t('landing.colHome')}</span>
            <span>{t('landing.colDone')}</span>
            <span className="text-right">{t('landing.colReady')}</span>
          </div>
          {rows.map(({ h, ready }) => (
            <div key={h.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-8 border-b border-line py-3 text-[15px]">
              <span className="text-ink">
                {h.city} · {h.bedrooms}BR <span className="text-ink-2">{h.address}</span>
              </span>
              <span className="tnum text-ink-2">{monthName(h.completion, lang, true)}</span>
              <span className="tnum w-[96px] text-right text-[20px] font-semibold text-ink">
                <AnimatedNumber value={inView ? ready : 0} format={(n) => String(Math.round(n))} />
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function Closing() {
  const { t } = useLang();
  const router = useVTRouter();
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-28 lg:px-8">
      <p className="max-w-[22ch] text-[36px] font-semibold leading-[42px] tracking-[-0.02em] text-ink lg:text-[56px] lg:leading-[60px]">{t('landing.closing')}</p>
      <motion.a
        href="/start"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          router.push('/start', 'start');
        }}
        whileTap={{ scale: 0.97 }}
        transition={spring.snappy}
        className="mt-10 inline-flex min-h-[56px] items-center rounded-[8px] bg-pine px-8 text-[20px] font-medium text-white transition-colors duration-[120ms] hover:bg-pine-hover"
      >
        {t('landing.cta')}
      </motion.a>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  const router = useVTRouter();
  const [code, setCode] = useState('');
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <Wordmark />
          <p className="t-helper mt-3 text-ink-2">{t('landing.footerPartner')}</p>
        </div>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/plan/${code.trim().toUpperCase()}`, 'forward');
          }}
        >
          <label>
            <span className="mb-2 block text-[13px] font-medium text-ink-2">{t('welcome.haveCode')}</span>
            <input className="field w-[160px] uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label={t('welcome.codeLabel')} placeholder={t('welcome.codeLabel')} />
          </label>
          <button type="submit" className="press min-h-[48px] rounded-[8px] border border-line bg-surface px-4 text-[15px] font-medium text-ink hover:bg-paper">
            {t('welcome.openPlan')}
          </button>
        </form>
        <StaffLink />
      </div>
    </footer>
  );
}

export function Landing() {
  const phase = useIntroPhase();
  return (
    <>
      {/* Without JavaScript the intro never runs: show everything. */}
      <noscript>
        <style>{`[data-intro]{visibility:visible!important}`}</style>
      </noscript>
      <Hero phase={phase} />
      <div id="story" className="scroll-mt-16">
        <PhoneScene />
        <RoadScene />
        <HomesScene />
      </div>
      <Closing />
      <Footer />
    </>
  );
}
