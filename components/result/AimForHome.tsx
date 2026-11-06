'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, solveForDate } from '@/lib/engine';
import { fittingHomes } from '@/lib/homes';
import { monthName, money } from '@/lib/format';
import { spring } from '@/lib/motion';
import type { Home, Levers, Profile } from '@/lib/types';
import { Section } from './Panels';

type Outcome = { homeId: string; text: string[]; ok: boolean };

export function AimForHome({ profile, onSolve }: { profile: Profile; onSolve: (l: Levers) => void }) {
  const { t, lang } = useLang();
  const [homes, setHomes] = useState<Home[] | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useEffect(() => {
    fetch('/api/homes')
      .then((r) => r.json())
      .then((d) => setHomes(d.homes))
      .catch(() => setHomes([]));
  }, []);
  const fits = homes ? fittingHomes(homes, profile.householdSize) : [];
  const describe = (h: Home) => ({ city: h.city, br: h.bedrooms, month: monthName(h.completion, lang) });

  const pick = (h: Home) => {
    const target = monthsUntil(h.completion);
    const now = computeReadiness(profile);
    if (now.monthsToReady <= target) {
      setOutcome({ homeId: h.id, ok: true, text: [t('result.aimAlready', describe(h))] });
      return;
    }
    const sol = solveForDate(profile, target);
    if (!sol) {
      const earliest = fits.find((x) => solveForDate(profile, monthsUntil(x.completion)) !== null);
      setOutcome({ homeId: h.id, ok: false, text: [t('result.aimImpossible', describe(h)), earliest ? t('result.aimEarliest', describe(earliest)) : t('result.aimNoneWorks')] });
      return;
    }
    const delta = sol.addedPerMonth;
    setOutcome({
      homeId: h.id,
      ok: true,
      text: [
        t('result.aimSolved', { ...describe(h), debt: money(sol.extraDebt, lang), save: money(sol.monthlySavings, lang) }),
        delta > 0 ? t('result.aimMore', { amount: money(delta, lang) }) : delta < 0 ? t('result.aimLess', { amount: money(-delta, lang) }) : t('result.aimSame'),
      ],
    });
    onSolve({ ...profile.levers, extraDebt: sol.extraDebt, monthlySavings: sol.monthlySavings });
  };

  return (
    <Section title={t('result.aimTitle')} id="aim">
      <p className="mb-4 text-[15px] text-ink-2">{t('result.aimHelp')}</p>
      {homes === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[60px]" />
          ))}
        </div>
      ) : fits.length === 0 ? (
        <p className="panel text-[15px] text-ink-2">{t('result.aimNone', { n: profile.householdSize })}</p>
      ) : (
        <ul className="panel flex flex-col divide-y divide-line !p-0" data-testid="homes">
          {fits.map((h) => {
            const selected = outcome?.homeId === h.id;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  aria-pressed={selected}
                  className={`relative flex min-h-[60px] w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-[120ms] first:rounded-t-[14px] last:rounded-b-[14px] ${selected ? 'bg-pine-soft' : 'hover:bg-paper'}`}
                >
                  <span>
                    <span className="block text-[16px] font-medium text-ink">
                      {h.city} · {t('result.bedrooms', { n: h.bedrooms })}
                    </span>
                    <span className="t-helper mt-1 block text-ink-2">{h.address}</span>
                  </span>
                  <span className="tnum shrink-0 text-[15px] text-ink-2">{t('result.done', { month: monthName(h.completion, lang, true) })}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AnimatePresence initial={false}>
        {outcome && (
          <motion.div
            key={outcome.homeId + outcome.text.join()}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <p data-testid="aim-sentence" className={`tnum mt-4 border-l-2 pl-3 text-[16px] leading-[24px] ${outcome.ok ? 'border-pine text-ink' : 'border-signal-amber text-ink'}`}>
              {outcome.text.join(' ')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
