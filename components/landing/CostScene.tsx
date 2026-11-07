'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { ease } from '@/lib/motion';
import { hasWebGL, HOUSE_STILL, HOUSE_STILL_NIGHT } from '@/components/three/HouseCanvas';
import { useNight } from '@/components/three/useNight';
import { COST_END, COST_PARTS, COST_SIDE, costAt, type CostFrame, type CostPart } from '@/components/three/CostHouse';
import { useSectionNav, useSectionPlay } from './SectionNav';
import { SplitHeading } from './Type';

const CostHouse = dynamic(() => import('@/components/three/CostHouse'), { ssr: false });

/**
 * "What it costs to keep a home": one full-screen section after the hero. The first time it becomes the section in
 * view (Down, wheel, a dot, or scrolling into it) the whole sequence plays by itself, about 4.6s: the house turns
 * to three-quarters, its layers separate one at a time (foundation = mortgage, walls = property tax, roof =
 * insurance, the utility box = utilities, the toolbox = repairs), each with a leader line and a label whose number
 * rolls up; then the roof glows amber and "This is the part that moves." rises in. Then it holds, exploded, with
 * every label, and nothing advances: a "Next" arrow fades in. A press of Down while it plays finishes it instead
 * of leaving; coming back shows it finished, with "Replay". Reduced motion: finished from the start. Phones: the
 * labels stack in a list under a smaller exploded house.
 */
/** A monthly budget for a Habitat home in Orange County (the Keep sample family; insurance renews +29% on the FAIR Plan). */
const COST: Record<CostPart, number> = { mortgage: 1100, tax: 325, insurance: 237, utilities: 260, repairs: 150 };
type Phase = 'idle' | 'playing' | 'done';

function Roll({ value, on, instant, lang }: { value: number; on: boolean; instant: boolean; lang: 'en' | 'es' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => money(Math.round(v), lang));
  useEffect(() => {
    if (!on) return void mv.set(0);
    if (instant) return void mv.set(value);
    const a = animate(mv, value, { duration: 0.75, ease: ease.out });
    return () => a.stop();
  }, [on, instant, value, mv]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

/** A phone row: slides in as its layer separates. */
function Row({ t, k, label, children }: { t: MotionValue<number>; k: CostPart; label: string; children: React.ReactNode }) {
  const o = useTransform(t, (v) => costAt(v).label(k));
  const x = useTransform(o, (a) => (1 - a) * 12);
  return (
    <motion.li style={{ opacity: o, x }} className={`flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0 ${k === 'insurance' ? 'border-l-2 border-l-signal-amber pl-3' : ''}`} data-testid={`cost-row-${k}`}>
      <span className="text-[18px] leading-[24px] text-ink-2">{label}</span>
      <span className="t-display text-[32px] leading-[1] text-ink">{children}</span>
    </motion.li>
  );
}

/** Without WebGL (the house is a still image): the same labels in two calm columns beside it, arriving on the same clock. */
function StaticLabels({ t, parts, per, out, instant, lang }: { t: MotionValue<number>; parts: Record<CostPart, string>; per: string; out: Record<CostPart, boolean>; instant: boolean; lang: 'en' | 'es' }) {
  const col = (side: -1 | 1) => (
    <div className={`pointer-events-none absolute top-1/2 flex w-[clamp(200px,17vw,260px)] -translate-y-1/2 flex-col gap-3.5 ${side < 0 ? 'left-[clamp(24px,5.5vw,80px)]' : 'right-[clamp(24px,5.5vw,80px)]'}`}>
      {(side < 0 ? (['repairs', 'mortgage'] as CostPart[]) : (['insurance', 'tax', 'utilities'] as CostPart[])).map((k) => (
        <StaticCard key={k} t={t} k={k}>
          <span className="block text-[18px] leading-[24px] text-ink-2">{parts[k]}</span>
          <span className="t-display mt-1 block text-[34px] leading-[1.05] text-ink lg:text-[38px]">
            <Roll value={COST[k]} on={out[k]} instant={instant} lang={lang} />
            <span className="ml-1 font-sans text-[16px] font-normal text-ink-2">{per}</span>
          </span>
        </StaticCard>
      ))}
    </div>
  );
  return (
    <>
      {col(-1)}
      {col(1)}
    </>
  );
}
function StaticCard({ t, k, children }: { t: MotionValue<number>; k: CostPart; children: React.ReactNode }) {
  const o = useTransform(t, (v) => costAt(v).label(k));
  const x = useTransform(o, (a) => (1 - a) * 14 * COST_SIDE[k]);
  return (
    <motion.div style={{ opacity: o, x }} className={`rounded-[8px] border bg-surface px-4 py-3 ${k === 'insurance' ? 'border-line border-l-2 border-l-signal-amber' : 'border-line'}`} data-testid={`cost-${k}`}>
      {children}
    </motion.div>
  );
}

export function CostScene({ index }: { index: number }) {
  const { t: tr, lang } = useLang();
  const reduce = !!useReducedMotion();
  const night = useNight();
  const nav = useSectionNav();
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '50% 0px 50% 0px' });
  const onScreen = useInView(ref, { amount: 0.3 });
  // the canvas mounts the first time the section comes near and stays (WebGL teardown is a long task)
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (near) setSeen(true);
  }, [near]);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  const [list, setList] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setList(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ---- the sequence ----
  const t = useMotionValue(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const [instant, setInstant] = useState(false);
  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  const finish = useCallback(() => {
    anim.current?.stop();
    setInstant(true);
    t.set(COST_END);
    go('done');
  }, [t, go]);
  const run = useCallback(() => {
    anim.current?.stop();
    setInstant(false);
    t.set(0);
    go('playing');
    anim.current = animate(t, COST_END, { duration: COST_END, ease: 'linear', onComplete: () => go('done') });
  }, [t, go]);
  // it plays the first time the section becomes the one in view; afterwards it is simply finished
  const play = useSectionPlay(index);
  useEffect(() => {
    if (play === 0 || phaseRef.current !== 'idle') return;
    if (reduce) finish();
    else run();
  }, [play, reduce, run, finish]);
  useEffect(() => {
    if (reduce && phaseRef.current !== 'done') finish();
  }, [reduce, finish]);
  // a press of Down while it plays finishes it instead of leaving
  useEffect(() => {
    nav.setHold(index, () => {
      if (phaseRef.current !== 'playing') return false;
      finish();
      return true;
    });
    return () => nav.setHold(index, null);
  }, [nav, index, finish]);
  useEffect(() => () => anim.current?.stop(), []);

  // which labels are out (their numbers roll up as they arrive)
  const [out, setOut] = useState<Record<CostPart, boolean>>({ mortgage: false, tax: false, insurance: false, utilities: false, repairs: false });
  useMotionValueEvent(t, 'change', (v) => {
    const s = costAt(v);
    setOut((o) => {
      let changed = false;
      const n = { ...o };
      for (const k of COST_PARTS) {
        const on = s.label(k) > 0.2;
        if (n[k] !== on) {
          n[k] = on;
          changed = true;
        }
      }
      return changed ? n : o;
    });
  });
  const captionO = useTransform(t, (v) => costAt(v).caption);
  const captionY = useTransform(captionO, (c) => (1 - c) * 16);

  // the reading layout: the house sits in the band the copy leaves free; the canvas reads it every frame
  const frame = useRef<CostFrame>({ top: 160, bottom: 200, col: 240, margin: 80, list: false });
  useLayoutEffect(() => {
    const measure = () => {
      const st = stage.current?.getBoundingClientRect();
      const tb = top.current?.getBoundingClientRect();
      const bb = bottom.current?.getBoundingClientRect();
      if (!st) return;
      const W = st.width;
      frame.current = {
        list,
        // phones: the canvas is its own box under the title, so the house simply fills it
        top: list ? 6 : tb ? tb.bottom - st.top + 20 : 160,
        bottom: list ? 8 : bb ? st.bottom - bb.top + 16 : 200,
        col: Math.min(260, Math.max(200, W * 0.17)),
        margin: Math.max(24, Math.min(80, W * 0.055)),
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (top.current) ro.observe(top.current);
    if (bottom.current) ro.observe(bottom.current);
    return () => ro.disconnect();
  }, [list]);

  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const refs = useRef({ labels, slides, lines, dots }).current;
  const partLabel: Record<CostPart, string> = { mortgage: tr('landing.costMortgage'), tax: tr('landing.costTax'), insurance: tr('landing.costInsurance'), utilities: tr('landing.costUtilities'), repairs: tr('landing.costRepairs') };
  const per = tr('landing.costPer');
  const done = phase === 'done';

  const house = (
    <>
      {gl && seen && <CostHouse t={t} refs={refs} frame={frame} night={night} active={near} floating={done && onScreen} reduce={reduce} />}
      {gl === false && (
        <div className="absolute inset-x-[24%] bottom-[34%] top-[26%] sm:bottom-[32%] sm:top-[24%]">
          <Image src={HOUSE_STILL} alt="" fill sizes="60vw" className="still-day object-contain" />
          <Image src={HOUSE_STILL_NIGHT} alt="" fill sizes="60vw" className="still-night object-contain" />
        </div>
      )}
    </>
  );

  return (
    <section ref={ref} id="scene-cost" data-testid="scene-cost" data-phase={phase} aria-label={tr('landing.navCost')} className="relative min-h-[calc(100svh-64px)]">
      <div ref={stage} className="relative flex min-h-[calc(100svh-64px)] flex-col overflow-hidden bg-paper sm:block">
        {/* the stage: a soft studio floor and backdrop, lit from the top-left like the house */}
        <div className="absolute inset-0" aria-hidden style={{ background: 'radial-gradient(80% 62% at 50% 62%, var(--il-sky-top), transparent 70%), linear-gradient(180deg, var(--paper), var(--il-sky-bottom))' }} />

        {/* the title */}
        <div ref={top} className="relative z-[1] mx-auto w-full max-w-[1440px] px-5 pt-6 sm:px-8 sm:pt-8 sm:text-center lg:px-20 lg:pt-10">
          <SplitHeading text={tr('landing.costTitle')} play={play} animate={play > 0} className="mx-auto max-w-[22ch] text-[36px] text-ink sm:text-[44px] lg:text-[52px] xl:text-[56px]" />
          <p className="mt-2 text-[16px] leading-[24px] text-ink-2 sm:mt-3 sm:text-[18px] sm:leading-[27px] lg:text-[20px]">{tr('landing.costBody')}</p>
        </div>

        {/* the house: full stage on desktop; a box under the title on phones */}
        <div className="relative h-[31svh] min-h-[230px] sm:absolute sm:inset-0 sm:h-auto" aria-hidden>
          {house}
        </div>

        {/* desktop: leader lines and the label columns (placed every frame from the 3D anchors) */}
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" aria-hidden>
          {COST_PARTS.map((k, i) => (
            <g key={k}>
              <line ref={(el) => void (lines.current[i] = el)} stroke="var(--ink-2)" strokeWidth="1.25" style={{ opacity: 0 }} />
              <circle ref={(el) => void (dots.current[i] = el)} r="4" fill={k === 'insurance' ? 'var(--signal-amber)' : 'var(--ink)'} style={{ opacity: 0 }} />
            </g>
          ))}
        </svg>
        {gl === false && !list && <StaticLabels t={t} parts={partLabel} per={per} out={out} instant={instant} lang={lang} />}
        <div className="pointer-events-none absolute inset-0 hidden sm:block" style={{ display: gl === false ? 'none' : undefined }}>
          {COST_PARTS.map((k, i) => (
            <div key={k} ref={(el) => void (labels.current[i] = el)} className="absolute left-0 top-0" style={{ opacity: 0, width: frame.current.col }} data-testid={`cost-${k}`}>
              <div ref={(el) => void (slides.current[i] = el)} className={`rounded-[8px] border bg-surface px-4 py-3 ${k === 'insurance' ? 'border-line border-l-2 border-l-signal-amber' : 'border-line'} ${COST_SIDE[k] > 0 ? 'text-left' : 'text-left'}`}>
                <span className="block text-[18px] leading-[24px] text-ink-2">{partLabel[k]}</span>
                <span className="t-display mt-1 block text-[34px] leading-[1.05] text-ink lg:text-[38px]">
                  <Roll value={COST[k]} on={out[k]} instant={instant} lang={lang} />
                  <span className="ml-1 font-sans text-[16px] font-normal text-ink-2">{per}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* below the house: the line that matters, Replay, then (phones) the list */}
        <div ref={bottom} className="relative z-[1] mx-auto w-full max-w-[1440px] px-5 pb-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:px-8 sm:pb-[88px] sm:text-center lg:px-20">
          {/* phones: the caption and Replay share a line */}
          <div className="flex items-center justify-between gap-3 sm:block">
          <motion.div style={{ opacity: captionO, y: captionY }} aria-live="polite">
            <p className="t-display text-[28px] leading-[1.1] text-ink sm:text-[36px] lg:text-[40px]">{tr('landing.costMoves')}</p>
            <p className="mx-auto mt-2 hidden max-w-[56ch] text-[18px] leading-[27px] text-ink-2 sm:block">{tr('landing.costMovesSub')}</p>
          </motion.div>
          {done && !reduce && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: ease.out, delay: 0.2 }}
              onClick={run}
              className="press shrink-0 inline-flex sm:mt-2 min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 text-[15px] font-medium text-pine hover:bg-pine-soft"
              data-testid="cost-replay"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 3v2.6h2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {tr('landing.costReplay')}
            </motion.button>
          )}
          </div>
          {list && (
            <ul className="mt-4 rounded-[14px] border border-line bg-surface px-4 py-1" aria-label={tr('landing.costTitle')}>
              {COST_PARTS.map((k) => (
                <Row key={k} t={t} k={k} label={partLabel[k]}>
                  <Roll value={COST[k]} on={out[k]} instant={instant} lang={lang} />
                  <span className="ml-1 font-sans text-[15px] font-normal text-ink-2">{per}</span>
                </Row>
              ))}
            </ul>
          )}
        </div>

        {/* the way on: fades in with a soft pulse once the sequence has finished */}
        <div className="relative z-[2] flex justify-center pb-6 sm:absolute sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:pb-0">
          <button
            type="button"
            onClick={() => nav.goTo(index + 1)}
            tabIndex={done ? 0 : -1}
            aria-hidden={done ? undefined : true}
            className={`cost-next press relative flex h-[44px] items-center gap-2 rounded-full border border-pine bg-paper/90 pl-4 pr-3 text-[15px] font-medium text-pine transition-opacity duration-300 hover:bg-pine-soft ${done ? 'cost-next-in opacity-100' : 'pointer-events-none opacity-0'}`}
            data-testid={`section-arrow-${index}`}
          >
            {tr('landing.costNext')}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M9 3v11M4 9.5 9 14.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
