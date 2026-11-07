'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Slider } from '@/components/ui/Slider';
import { stressHeadline } from '@/lib/earlyWarning';
import { money } from '@/lib/format';
import { stressTest, thisMonth, type StressControls, type StressHome } from '@/lib/forecast';
import { StressChart } from './StressChart';

const whole = (n: number) => String(Math.round(n));

export function StressTest({ homes, today }: { homes: StressHome[]; today: string }) {
  const [inc, setInc] = useState(29);
  const [supp, setSupp] = useState(false);
  const [hardship, setHardship] = useState(0);
  const [repair, setRepair] = useState(150);
  const opts = useMemo(() => ({ start: thisMonth(new Date(today)), today: new Date(today) }), [today]);
  const controls: StressControls = { insuranceIncrease: inc / 100, supplemental: supp, hardshipFund: hardship, matchedRepair: repair };
  // The engine is fast (40 homes, < 5ms); deferring keeps the slider thumb at 60fps on slow machines anyway.
  const c = useDeferredValue(controls);
  const r = useMemo(() => stressTest(homes, c, opts), [homes, c.insuranceIncrease, c.supplemental, c.hardshipFund, c.matchedRepair, opts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Who the shock itself pushes out of Stable: compared with premiums and taxes holding flat.
  const calm = useMemo(() => stressTest(homes, { insuranceIncrease: 0, supplemental: false, hardshipFund: 0, matchedRepair: 0 }, opts), [homes, opts]);
  const calmLevel = useMemo(() => new Map(calm.levels.map((l) => [l.id, l.before])), [calm]);
  const pushed = r.levels.filter((l) => calmLevel.get(l.id) === 'stable' && l.before !== 'stable').length;
  const total = homes.length;
  const head = stressHeadline(c, r, total);

  return (
    <>
      <h1 className="t-title">Portfolio stress test</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">What one shock across every Habitat home does to homeowners’ payments, and what support keeps them paying. Homeowner payments fund the next homes.</p>

      {/* The headline rolls with the numbers; screen readers get the settled sentence once. */}
      <p className="sr-only" aria-live="polite">
        {head.shock} {head.support}
      </p>
      <p className="mt-6 max-w-[62ch] text-balance text-[28px] leading-[36px] tracking-[-0.01em]" aria-hidden data-testid="stress-headline">
        {head.shock} <span className="text-ink-2">{head.support}</span>
      </p>

      <div className="mt-8 grid grid-cols-[380px_minmax(0,1fr)] gap-10">
        <section aria-labelledby="controls-title" className="rounded-[14px] border border-line bg-surface p-5">
          <h2 id="controls-title" className="text-[15px] font-semibold">
            Scenario
          </h2>
          <Control id="st-ins" label="Insurance increase across all homes" value={`${inc}%`}>
            <Slider id="st-ins" min={0} max={50} step={1} value={inc} onChange={setInc} label="Insurance increase across all homes" valueText={`${inc} percent`} />
            <p className="text-[13px] text-ink-2">The FAIR Plan raised rates 29.1% on October 15, 2026.</p>
          </Control>
          <div className="mt-5 border-t border-line pt-4">
            <button type="button" role="switch" aria-checked={supp} onClick={() => setSupp(!supp)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left" data-testid="st-supp">
              <span>
                <span className="block text-[15px] font-medium">Property tax supplemental bills</span>
                <span className="block text-[13px] text-ink-2">A reassessment bill (15% of the annual tax) through escrow</span>
              </span>
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[120ms] ${supp ? 'bg-pine' : 'bg-line'}`} aria-hidden>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-knob transition-transform duration-[120ms] ${supp ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
          <Control id="st-hard" label="Interest-free hardship fund" value={`${money(hardship)} per family`}>
            <Slider id="st-hard" min={0} max={2000} step={100} value={hardship} onChange={setHardship} label="Interest-free hardship fund per family" valueText={`${hardship} dollars per family`} />
          </Control>
          <Control id="st-rep" label="Matched repair savings" value={`${money(repair)} a month`}>
            <Slider id="st-rep" min={0} max={300} step={10} value={repair} onChange={setRepair} label="Matched repair savings per month" valueText={`${repair} dollars a month`} />
          </Control>
        </section>

        <section aria-labelledby="result-title">
          <h2 id="result-title" className="sr-only">
            Result
          </h2>
          <dl className="grid grid-cols-4 border-y border-line">
            <Stat label="At risk, no support" id="at-risk-before" value={r.atRiskBefore} suffix={`of ${total}`} />
            <Stat label="At risk, with support" id="at-risk-after" value={r.atRiskAfter} suffix={`of ${total}`} />
            <Stat label="Pushed out of Stable by the shock" id="pushed" value={pushed} />
            <Stat label="Missed payments avoided a year" id="missed-avoided" value={r.missedAvoided} />
          </dl>
          <p className="mt-4 text-[15px] text-ink-2">
            <span className="tnum font-semibold text-ink">
              <AnimatedNumber speed="snappy" value={r.dollarsProtected} format={(n) => money(n)} />
            </span>{' '}
            a year keeps flowing back into building new homes.
          </p>
          <div className="mt-8">
            <h3 className="text-[15px] font-semibold">Homeowners by risk level</h3>
            <div className="mt-3">
              <StressChart
                before={r.before}
                after={r.after}
                total={total}
                label={`Homeowners by risk level. With the shock and no support: ${r.before.stable} stable, ${r.before.watch} watch, ${r.before.act} act now. With support: ${r.after.stable} stable, ${r.after.watch} watch, ${r.after.act} act now.`}
              />
            </div>
          </div>
          <p className="mt-6 text-[13px] leading-[18px] text-ink-2">
            Planning assumption: a homeowner on Watch misses about one payment a year and one on Act now about three; each avoided miss keeps one mortgage payment in the fund that builds the next homes. Same forecast engine as the family app.
          </p>
        </section>
      </div>
    </>
  );
}

function Control({ id, label, value, children }: { id: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </label>
        <span className="tnum text-[15px] font-semibold" data-testid={`${id}-value`}>
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, id, value, suffix }: { label: string; id: string; value: number; suffix?: string }) {
  return (
    <div className="border-l border-line py-5 pl-5 first:border-l-0 first:pl-0">
      <dt className="text-[13px] leading-[18px] text-ink-2">{label}</dt>
      <dd className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]" data-testid={id} data-value={value}>
          <AnimatedNumber speed="snappy" value={value} format={whole} />
        </span>
        {suffix && <span className="tnum text-[13px] text-ink-2">{suffix}</span>}
      </dd>
    </div>
  );
}
