'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { money, monthName } from '@/lib/format';
import { dur, ease, exit as exitT } from '@/lib/motion';
import { forecast, thisMonth, type Forecast, type Shock } from '@/lib/forecast';
import { patchProfile, resetKeep, useKeep } from '@/lib/keepStore';
import { applyMoves } from '@/lib/shield';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toast';
import { ForecastChart, forecastDomain } from './ForecastChart';
import { FlattenSlider } from './FlattenSlider';
import { ShockShield } from './ShockShield';
import type { Lang } from '@/lib/types';

/** "March" within the next 12 months, "March 2028" after. */
export function shockMonth(s: Shock, lang: Lang) {
  const full = monthName(s.month, lang);
  return s.i <= 11 ? full.replace(/\s*(de\s+)?\d{4}$/, '') : full;
}

type Headline = { kind: 'rise' | 'covered' | 'tight' | 'solid'; shock: Shock | null };
/**
 * The headline, from the engine: "covered" once the set-aside reaches the engine's recommendation (every rise in the
 * next 12 months under $5); otherwise the first rise the family will feel: a shock month, or, while a partial
 * set-aside spreads it out, the month the jar runs dry.
 */
function headlineOf(f: Forecast, setAside: number, rec: number): Headline {
  const first = f.shocks[0] ?? null;
  if (first && rec > 0 && setAside >= rec) return { kind: 'covered', shock: first };
  const felt = f.shocks.find((s) => s.felt > 0 && s.i <= 12) ?? null;
  if (felt) return { kind: 'rise', shock: felt };
  for (let k = 1; k <= 12 && k < f.months.length; k++) {
    const jump = Math.round(f.months[k].effective - f.months[k - 1].effective);
    if (jump >= 5 && first) return { kind: 'rise', shock: { ...first, i: k, month: f.months[k].month, felt: jump } };
  }
  const later = f.shocks.find((s) => s.felt > 0) ?? null;
  if (later) return { kind: 'rise', shock: later };
  if (f.minBreathing < 0) return { kind: 'tight', shock: null };
  return { kind: 'solid', shock: null };
}

/** Puts a React node where `{amount}` sits in a translated sentence. */
function withAmount(s: string, node: React.ReactNode) {
  const [a, b] = s.split('{amount}');
  return (
    <>
      {a}
      {b !== undefined && node}
      {b}
    </>
  );
}

const sliderMax = (rec: number, cur: number) => Math.max(100, Math.ceil((Math.max(rec * 2, cur * 1.25) || 0) / 25) * 25);

/** K2 + K3: the Payment Forecast, the flatten slider and the Shock Shield. */
export function KeepForecast() {
  const { t, lang } = useLang();
  const toast = useToast();
  const [state, update] = useKeep();
  const start = useMemo(() => thisMonth(), []);
  const applied = useMemo(() => applyMoves(state.profile, state.movesDone), [state.profile, state.movesDone]);
  const saved = Math.max(0, state.profile.setAside || 0);
  const [live, setLive] = useState(saved);
  useEffect(() => setLive(saved), [saved]);

  const none = useMemo(() => forecast(applied, { start, setAside: 0 }), [applied, start]);
  const rec = none.recommendedSetAside;
  const max = sliderMax(rec, saved);
  const top = useMemo(() => forecast(applied, { start, setAside: max }), [applied, start, max]);
  // one fixed domain for the whole slider range, from the plan with no moves applied: nothing rescales
  const domain = useMemo(() => {
    const raw = forecast(state.profile, { start, setAside: 0 });
    return forecastDomain([none, top, raw]);
  }, [none, top, state.profile, start]);
  const f = useMemo(() => forecast(applied, { start, setAside: live }), [applied, start, live]);
  const h = headlineOf(f, live, rec);
  const firstShock = none.shocks[0] ?? null;

  const commit = useCallback(
    (v: number) => {
      if (v === (state.profile.setAside || 0)) return;
      update((s) => patchProfile(s, { setAside: v }, 'typed'));
    },
    [state.profile.setAside, update],
  );
  const applyRec = () => {
    setLive(rec);
    update((s) => ({ ...patchProfile(s, { setAside: rec }, 'typed'), savingsGoal: { monthly: rec, created: new Date().toISOString() } }));
    toast(t('keep.slider.applied', { amount: money(rec, lang) }));
  };

  const amount = (n: number) => <AnimatedNumber value={n} format={(x) => money(x, lang)} className="tnum" />;
  // While a shock is ahead, the "rise" and "covered" headlines are stacked in one grid cell and crossfade: the cell
  // is as tall as the longer one, so dragging the slider never moves the page under the finger.
  const riseShock = h.kind === 'rise' ? h.shock : (f.shocks.find((s) => s.felt > 0) ?? firstShock);
  const coverShock = h.kind === 'covered' ? h.shock : firstShock;
  const variants: { kind: Headline['kind']; text: React.ReactNode }[] = firstShock
    ? [
        { kind: 'rise', text: riseShock ? withAmount(t('keep.headline.rise', { month: shockMonth(riseShock, lang) }), <span data-testid={h.kind === 'rise' ? 'headline-amount' : undefined}>{amount(riseShock.felt || riseShock.delta)}</span>) : null },
        { kind: 'covered', text: coverShock ? withAmount(t('keep.headline.covered', { month: shockMonth(coverShock, lang) }), amount(h.kind === 'covered' ? live : rec)) : null },
      ]
    : [{ kind: h.kind, text: t(`keep.headline.${h.kind}`) }];
  if (firstShock && h.kind !== 'rise' && h.kind !== 'covered') variants.push({ kind: h.kind, text: t(`keep.headline.${h.kind}`) });
  const afterI = firstShock ? firstShock.i : 23;
  const jarBefore = firstShock && firstShock.i > 0 ? f.months[firstShock.i - 1]?.jar ?? 0 : 0;

  return (
    <div className="mx-auto max-w-[1120px] px-5 pb-24 pt-6 sm:pt-10 lg:px-8" data-testid="keep-forecast">
      <div className="max-w-[860px]">
        <div className="grid">
          {variants.map((v) => {
            const on = v.kind === h.kind;
            return (
              <motion.div
                key={v.kind}
                role={on ? 'heading' : undefined}
                aria-level={on ? 1 : undefined}
                aria-hidden={on ? undefined : true}
                className={`t-title col-start-1 row-start-1 text-ink ${on ? '' : 'pointer-events-none'}`}
                initial={false}
                animate={{ opacity: on ? 1 : 0, y: on ? 0 : v.kind === 'covered' ? 8 : -8 }}
                transition={{ duration: on ? dur.short : exitT.duration, ease: ease.out }}
                data-testid={on ? 'keep-headline' : undefined}
                data-kind={v.kind}
              >
                <span className="tnum">{v.text}</span> <span className="text-ink-2">{t(`keep.headline.${v.kind}Sub`)}</span>
              </motion.div>
            );
          })}
        </div>
        {state.demo && <p className="mt-2 text-[15px] text-ink-2">{t('keep.demoNote')}</p>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <section className="panel !px-3 !pb-4 !pt-4 sm:!px-5 sm:!pt-5" aria-labelledby="chart-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <h2 id="chart-title" className="text-[16px] font-medium text-ink">
              {t('keep.chart.title')}
            </h2>
            <p className="flex items-center gap-4 text-[12px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2.5px] w-4 rounded-full bg-pine" aria-hidden />
                {t('keep.chart.legendPay')}
              </span>
              <motion.span className="flex items-center gap-1.5" initial={false} animate={{ opacity: live > 0 ? 1 : 0 }} transition={{ duration: dur.short }}>
                <span className="inline-block w-4 border-t-[1.5px] border-dashed border-[var(--chart-base)]" aria-hidden />
                {t('keep.chart.legendWithout')}
              </motion.span>
            </p>
          </div>
          <ForecastChart forecast={f} setAside={live} baseline={none} domain={domain} />
          <p className="t-helper mt-3 px-1 text-ink-2">{t('keep.chart.note')}</p>
        </section>

        <section className="flex flex-col gap-6" aria-label={t('keep.slider.label')}>
          <div className="panel !p-5">
            <FlattenSlider value={live} max={max} recommended={rec} onLive={setLive} onCommit={commit} />
            {rec > 0 && firstShock ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[15px] leading-[22px] text-ink" data-testid="recommendation">
                  {t('keep.slider.recommend', { amount: money(rec, lang), month: shockMonth(firstShock, lang) })}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant={live === rec ? 'secondary' : 'primary'} onClick={applyRec} disabled={live === rec} data-testid="apply-recommended">
                    {live === rec ? t('keep.slider.using', { amount: money(rec, lang) }) : t('keep.slider.use', { amount: money(rec, lang) })}
                  </Button>
                </div>
                {/* space reserved: the note appears without pushing anything */}
                <p className="tnum t-helper mt-3 min-h-[15px] text-ink-2" data-testid="jar-note">
                  {live > 0 && jarBefore > 0 ? t('keep.slider.jar', { amount: money(jarBefore, lang), month: monthName(f.months[firstShock.i - 1].month, lang) }) : ''}
                </p>
              </div>
            ) : (
              <p className="mt-4 border-t border-line pt-4 text-[15px] leading-[22px] text-ink-2">{t('keep.slider.noRise')}</p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-0 divide-x divide-line lg:grid-cols-1 lg:divide-x-0 lg:divide-y" data-testid="keep-stats">
            {[
              { k: t('keep.stats.now'), v: f.months[0]?.effective ?? 0, tone: 'text-ink' },
              { k: firstShock ? t('keep.stats.after', { month: shockMonth(firstShock, lang) }) : t('keep.stats.later'), v: f.months[afterI]?.effective ?? 0, tone: 'text-ink' },
              { k: t('keep.stats.lowest'), v: f.minBreathing, tone: f.minBreathing < 0 ? 'text-signal-red' : f.minBreathing < f.threshold ? 'text-signal-amber' : 'text-pine' },
            ].map((s, i) => (
              <div key={i} className="px-3 first:pl-0 lg:px-0 lg:py-3 lg:first:pt-0">
                <dt className="text-[13px] leading-[16px] text-ink-2">{s.k}</dt>
                <dd className={`mt-1 text-[20px] font-semibold leading-[28px] ${s.tone}`}>{amount(Number.isFinite(s.v) ? s.v : 0)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {none.shocks.length > 0 && <ShockShield shocks={none.shocks} start={start} onSetAside={setLive} />}

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-[15px]">
        <Link href="/keep/setup" className="hit font-medium text-pine underline-offset-4 hover:underline" data-testid="edit-home">
          {t('keep.editHome')}
        </Link>
        <button
          type="button"
          className="hit font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          onClick={() => {
            resetKeep();
            window.scrollTo({ top: 0 });
          }}
        >
          {t('keep.startOver')}
        </button>
        <p className="t-helper text-ink-2">{t('keep.privacy')}</p>
      </div>
    </div>
  );
}
