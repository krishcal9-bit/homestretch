'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { ease } from '@/lib/motion';
import { hasWebGL, HOUSE_STILL, HOUSE_STILL_NIGHT } from '@/components/three/HouseCanvas';
import { useNight } from '@/components/three/useNight';
import { COST_PARTS, costStages, type CostPart } from '@/components/three/CostHouse';
import { SectionArrow, useSectionPlay } from './SectionNav';
import { SplitHeading } from './Type';

const CostHouse = dynamic(() => import('@/components/three/CostHouse'), {
  ssr: false,
});

/**
 * "What it costs to keep a home": the section after the hero, pinned for about three screens of scroll (Apple
 * product-page style). The featured home turns a little and comes apart: foundation (mortgage), walls (property
 * tax), roof (insurance), the utility box (utilities) and the toolbox (repairs), each with a leader line and a
 * number that rolls up. Then the roof glows amber, "This is the part that moves.", and the house reassembles and
 * hands over to the payment forecast. Section navigation takes one press per stage (data-stages). Reduced motion:
 * the exploded diagram, still, unpinned.
 */
/** A monthly budget for a Habitat home in Orange County (the Keep sample family; insurance renews +29% on the FAIR Plan). */
const COST: Record<CostPart, number> = {
  mortgage: 1100,
  tax: 325,
  insurance: 237,
  utilities: 260,
  repairs: 150,
};
const STAGES = 5;

function Roll({ value, on, lang }: { value: number; on: boolean; lang: 'en' | 'es' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => money(Math.round(v), lang));
  const reduce = !!useReducedMotion();
  useEffect(() => {
    if (!on) return;
    if (reduce) return void mv.set(value);
    const a = animate(mv, value, { duration: 0.7, ease: ease.out });
    return () => a.stop();
  }, [on, value, mv, reduce]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

export function CostScene({ index }: { index: number }) {
  const { t, lang } = useLang();
  const reduce = !!useReducedMotion();
  const night = useNight();
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '50% 0px 50% 0px' });
  const play = useSectionPlay(index);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  // progress through the pinned run: 0 when the section reaches the header, 1 when its end reaches the bottom
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 64px', 'end end'],
  });
  const fixed = useMotionValue(0.62); // reduced motion: the exploded diagram, labels out, the roof lit
  const p = reduce ? fixed : scrollYProgress;
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const refs = useRef({ labels, lines, dots }).current;

  // which labels are out (they roll their numbers up when they first appear in a visit)
  const [shown, setShown] = useState({ main: false, tools: false });
  useEffect(() => {
    if (reduce) setShown({ main: true, tools: true });
  }, [reduce]);
  useMotionValueEvent(p, 'change', (v) => {
    const s = costStages(v);
    const main = s.explode > 0.55;
    const tools = s.tools > 0.55;
    setShown((o) => (o.main === main && o.tools === tools ? o : { main, tools }));
  });
  const titleO = useTransform(p, [0, 0.08, 0.16], [1, 1, 0]);
  const titleY = useTransform(p, [0, 0.16], [0, -24]);
  const movesO = useTransform(p, [0.58, 0.66, 0.8, 0.86], [0, 1, 1, 0]);
  const movesY = useTransform(p, [0.58, 0.66], [12, 0]);
  const endO = useTransform(p, [0.88, 0.96], [0, 1]);
  // while the roof glows, the other parts step back so the one that moves leads
  const restO = useTransform(p, [0.56, 0.62, 0.8, 0.86], [1, 0, 0, 1]);
  const labelO = (part: CostPart) => (part === 'utilities' || part === 'repairs' ? shown.tools : shown.main);

  const partLabel: Record<CostPart, string> = {
    mortgage: t('landing.costMortgage'),
    tax: t('landing.costTax'),
    insurance: t('landing.costInsurance'),
    utilities: t('landing.costUtilities'),
    repairs: t('landing.costRepairs'),
  };

  return (
    <section
      ref={ref}
      id="scene-cost"
      data-testid="scene-cost"
      data-stages={reduce ? undefined : STAGES}
      aria-label={t('landing.navCost')}
      className={`relative ${reduce ? 'min-h-[calc(100svh-64px)]' : 'h-[calc(400svh-256px)]'}`}
    >
      <div ref={stage} className={`${reduce ? 'relative' : 'sticky top-16'} h-[calc(100svh-64px)] overflow-hidden bg-paper`}>
        {/* the stage: a soft studio floor and backdrop, lit from the top-left like the house */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background: 'radial-gradient(90% 70% at 62% 78%, var(--il-sky-top), transparent 70%), linear-gradient(180deg, var(--paper), var(--il-sky-bottom))',
          }}
        />
        <div className="absolute inset-0" aria-hidden>
          {gl && near && <CostHouse p={p} refs={refs} night={night} active={near} reduce={reduce} />}
          {gl === false && (
            <div className="absolute inset-x-[10%] bottom-[8%] top-[18%]">
              <Image src={HOUSE_STILL} alt="" fill sizes="80vw" className="still-day object-contain" />
              <Image src={HOUSE_STILL_NIGHT} alt="" fill sizes="80vw" className="still-night object-contain" />
            </div>
          )}
        </div>
        {/* leader lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {COST_PARTS.map((k, i) => (
            <motion.g key={k} style={{ opacity: k === 'insurance' ? 1 : restO }}>
              <g
                style={{
                  opacity: labelO(k) ? 1 : 0,
                  transition: 'opacity 240ms ease',
                }}
              >
                <line ref={(el) => void (lines.current[i] = el)} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 3" />
                <circle ref={(el) => void (dots.current[i] = el)} r="3.5" fill={k === 'insurance' ? 'var(--signal-amber)' : 'var(--ink)'} />
              </g>
            </motion.g>
          ))}
        </svg>
        {/* the labels: what each part is, what it costs a month */}
        {COST_PARTS.map((k, i) => (
          <motion.div key={k} className="pointer-events-none absolute inset-0" style={{ opacity: k === 'insurance' ? 1 : restO }}>
            <div
              ref={(el) => void (labels.current[i] = el)}
              className={`absolute left-0 top-0 rounded-[8px] border bg-surface px-3 py-2 sm:px-4 sm:py-3 ${k === 'insurance' ? 'border-l-2 border-line border-l-signal-amber' : 'border-line'}`}
              style={{
                opacity: labelO(k) ? 1 : 0,
                transition: 'opacity 240ms ease',
                visibility: gl === false ? 'hidden' : undefined,
              }}
              data-testid={`cost-${k}`}
            >
              <span className="block text-[13px] font-medium leading-[16px] text-ink-2 sm:text-[14px]">{partLabel[k]}</span>
              <span className="t-display mt-1 block text-[24px] leading-[1] text-ink sm:text-[34px]">
                <Roll value={COST[k]} on={labelO(k)} lang={lang} />
                <span className="ml-1 font-sans text-[13px] font-normal text-ink-2 sm:text-[15px]">{t('landing.costPer')}</span>
              </span>
            </div>
          </motion.div>
        ))}
        {/* the copy */}
        <div className="pointer-events-none absolute inset-0 mx-auto max-w-[1440px] px-5 pt-8 sm:px-8 lg:px-20 lg:pt-16">
          <motion.div style={{ opacity: titleO, y: titleY }} className="max-w-[620px]">
            <SplitHeading text={t('landing.costTitle')} play={play} animate={play > 0} className="text-[40px] text-ink sm:text-[56px] lg:text-[72px] xl:text-[84px]" />
            <p className="mt-5 max-w-[36ch] text-[18px] leading-[28px] text-ink-2 lg:text-[20px] lg:leading-[31px]">{t('landing.costBody')}</p>
          </motion.div>
        </div>
        <motion.div style={{ opacity: movesO, y: movesY }} className="pointer-events-none absolute inset-x-0 bottom-[10%] mx-auto max-w-[1440px] px-5 sm:px-8 lg:bottom-auto lg:top-[40%] lg:px-20" aria-live="polite">
          <p className="t-display max-w-[11ch] text-[34px] text-ink sm:text-[48px] lg:text-[60px]">{t('landing.costMoves')}</p>
          <p className="mt-4 max-w-[30ch] border-l-2 border-signal-amber pl-3 text-[16px] leading-[24px] text-ink-2 lg:text-[18px] lg:leading-[27px]">{t('landing.costMovesSub')}</p>
        </motion.div>
        <motion.div style={{ opacity: endO }} className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-[1440px] px-5 pt-8 sm:px-8 lg:px-20 lg:pt-16">
          <p className="t-display max-w-[16ch] text-[34px] text-ink sm:text-[48px] lg:text-[60px]">{t('landing.costEnd')}</p>
          <p className="mt-4 max-w-[38ch] text-[18px] leading-[28px] text-ink-2 lg:text-[20px] lg:leading-[31px]">
            {t('landing.costEndSub', {
              total: money(
                Object.values(COST).reduce((a, b) => a + b, 0),
                lang,
              ),
            })}
          </p>
        </motion.div>
        <SectionArrow index={index} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} />
      </div>
    </section>
  );
}
