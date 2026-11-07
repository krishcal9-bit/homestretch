'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { money, monthName } from '@/lib/format';
import { reveal, spring, stagger } from '@/lib/motion';
import type { Shock } from '@/lib/forecast';
import { patchProfile, useKeep } from '@/lib/keepStore';
import { shieldFacts, shieldRules, type Move } from '@/lib/shield';
import { demoFamily } from '@/lib/seedHomeowners';
import { Button } from '@/components/ui/Button';
import { CheckMark } from '@/components/ui/Checkbox';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/Toast';

type Result = { moves: Move[]; setAside: number; source: string };
const WILDFIRE = ['roof', 'vents', 'zone0', 'eaves', 'base', 'windows'] as const;

/** K3: for each upcoming shock, up to four ranked moves; each says what it adds and can be applied or marked done. */
export const ShockShield = memo(function ShockShield({ shocks, start, onSetAside }: { shocks: Shock[]; start: string; onSetAside: (v: number) => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const [state, update] = useKeep();
  const [sel, setSel] = useState(shocks[0]?.i ?? 0);
  useEffect(() => {
    if (!shocks.some((s) => s.i === sel) && shocks[0]) setSel(shocks[0].i);
  }, [shocks, sel]);
  const shock = shocks.find((s) => s.i === sel) ?? shocks[0];

  // the base profile, without the set-aside (each move's effect is measured from no set-aside, so the list holds still)
  const base = useMemo(() => ({ ...state.profile, setAside: 0 }), [state.profile]);
  const family = state.demo ? demoFamily().surname : undefined;
  const key = `${lang}|${sel}|${JSON.stringify(base)}`;
  const cache = useRef(new Map<string, Result>());
  const [result, setResult] = useState<Result | null>(() => cache.current.get(key) ?? null);
  useEffect(() => {
    const hit = cache.current.get(key);
    if (hit) {
      setResult(hit);
      return;
    }
    setResult(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let cancelled = false;
    const local = (): Result => ({ moves: shieldRules(base, sel, lang, { start, family }), setAside: shieldFacts(base, sel, start)?.setAside ?? 0, source: 'local' });
    fetch('/api/shield', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, profile: base, shockIndex: sel, start, family }), signal: ctrl.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as Result) : local()))
      .catch(() => local())
      .then((r) => {
        if (cancelled) return;
        cache.current.set(key, r);
        setResult(r);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const done = (k: string) => state.movesDone.includes(k);
  const toggle = (k: string, on = !done(k)) => update((s) => ({ ...s, movesDone: on ? [...new Set([...s.movesDone, k])] : s.movesDone.filter((x) => x !== k) }));
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const habitat = result?.moves.find((m) => m.key === 'habitat');
  useEffect(() => setMessage(habitat?.message ?? null), [habitat?.message]);

  const setAsideNow = (amount: number) => {
    onSetAside(amount);
    update((s) => ({ ...patchProfile(s, { setAside: amount }, 'typed'), savingsGoal: { monthly: amount, created: new Date().toISOString() }, movesDone: [...new Set([...s.movesDone, 'setAside'])] }));
    toast(t('keep.shield.goalCreated', { amount: money(amount, lang) }));
  };

  if (!shock) return null;
  return (
    <section className="mt-14" aria-labelledby="shield-title" data-testid="shock-shield">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[640px]">
          <h2 id="shield-title" className="t-section text-ink">
            {t('keep.shield.title')}
          </h2>
          <p className="tnum mt-1 text-[16px] leading-[24px] text-ink-2">{t('keep.shield.lede', { month: monthName(shock.month, lang), amount: money(shock.delta, lang), cause: t(`keep.cause.${shock.cause}`) })}</p>
        </div>
        {shocks.length > 1 && (
          <div className="w-full sm:w-auto sm:min-w-[300px]">
            <Segmented<string>
              size="sm"
              label={t('keep.shield.pick')}
              value={String(sel)}
              onChange={(v) => setSel(Number(v))}
              options={shocks.slice(0, 3).map((s) => ({ value: String(s.i), label: monthName(s.month, lang, true) }))}
            />
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-[14px] border border-line bg-surface">
        {!result ? (
          <ul aria-busy className="divide-y divide-line" aria-label={t('keep.shield.loading')}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-4 p-5">
                <div className="skeleton h-[22px] w-[22px] shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-[18px] w-1/2" />
                  <div className="skeleton mt-3 h-[14px] w-full" />
                  <div className="skeleton mt-2 h-[14px] w-3/4" />
                  <div className="skeleton mt-4 h-[44px] w-[180px]" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ol className="divide-y divide-line lg:grid lg:grid-cols-2 lg:divide-y-0" data-testid="shield-moves">
            {result.moves.map((m, i) => {
              const isDone = done(m.key) || (m.key === 'setAside' && result.setAside > 0 && (state.profile.setAside || 0) >= result.setAside);
              return (
                <motion.li
                  key={`${sel}-${m.key}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.smooth, delay: i * stagger }}
                  className={`flex gap-4 p-5 lg:border-line ${i % 2 === 0 ? 'lg:border-r' : ''} ${i >= 2 ? 'lg:border-t' : ''}`}
                  data-testid={`move-${m.key}`}
                  data-done={isDone || undefined}
                >
                  <span className="mt-[1px]">
                    <CheckMark checked={isDone} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-[16px] font-medium leading-[22px] transition-colors duration-200 ${isDone ? 'text-ink-2' : 'text-ink'}`}>{m.title}</h3>
                    <p className="tnum mt-1 flex flex-wrap items-baseline gap-x-3 text-[13px] leading-[20px] text-ink-2">
                      {m.monthlyEffect > 0 && (
                        <span className="text-[15px] font-medium text-pine" data-testid="move-effect">
                          {t('keep.shield.effect', { amount: money(m.monthlyEffect, lang) })}
                        </span>
                      )}
                      <span>{t(`keep.shield.effort.${m.effort}`)}</span>
                    </p>
                    <p className="tnum mt-2 text-[15px] leading-[22px] text-ink-2">{m.detail}</p>
                    {m.resource && (
                      <a href={m.resource.url} target="_blank" rel="noreferrer" className="mt-2 inline-block py-1 text-[15px] font-medium leading-[22px] text-pine underline-offset-4 hover:underline">
                        {m.resource.name}
                        <ExternalLink size={14} strokeWidth={1.75} aria-hidden className="ml-1 inline-block align-[-1px]" />
                        <span className="sr-only">{t('keep.shield.newTab')}</span>
                      </a>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {m.key === 'setAside' &&
                        (isDone ? (
                          <p className="tnum min-h-[44px] content-center text-[15px] text-ink" data-testid="goal-set">
                            {t('keep.shield.goalSet', { amount: money(Math.max(state.profile.setAside || 0, result.setAside), lang) })}
                          </p>
                        ) : (
                          <Button onClick={() => setAsideNow(result.setAside)} data-testid="move-setaside">
                            {t('keep.shield.setAsideCta', { amount: money(result.setAside, lang) })}
                          </Button>
                        ))}
                      {m.key === 'insurance' && (
                        <>
                          <Button variant={isDone ? 'quiet' : 'secondary'} onClick={() => toggle('insurance')} aria-pressed={isDone} data-testid="move-insurance-apply">
                            {isDone ? t('keep.shield.appliedUndo') : t('keep.shield.apply')}
                          </Button>
                          <Button variant="quiet" aria-expanded={open === 'wildfire'} aria-controls="wildfire-list" onClick={() => setOpen(open === 'wildfire' ? null : 'wildfire')}>
                            {open === 'wildfire' ? t('keep.shield.hideUpgrades') : t('keep.shield.showUpgrades')}
                          </Button>
                        </>
                      )}
                      {m.key === 'claim' && (
                        <Button variant={isDone ? 'quiet' : 'secondary'} onClick={() => toggle('claim')} aria-pressed={isDone} data-testid="move-claim-apply">
                          {isDone ? t('keep.shield.filedUndo') : t('keep.shield.markFiled')}
                        </Button>
                      )}
                      {m.key === 'habitat' &&
                        (isDone ? (
                          <p className="min-h-[44px] content-center text-[15px] text-ink">{t('keep.shield.sentNote')}</p>
                        ) : (
                          <Button variant="secondary" aria-expanded={open === 'habitat'} aria-controls="habitat-message" onClick={() => setOpen(open === 'habitat' ? null : 'habitat')} data-testid="move-habitat-write">
                            {t('keep.shield.write')}
                          </Button>
                        ))}
                    </div>

                    <AnimatePresence initial={false}>
                      {m.key === 'insurance' && open === 'wildfire' && (
                        <motion.div key="wf" id="wildfire-list" {...reveal} className="mt-4 border-l-2 border-pine pl-4">
                          <p className="text-[15px] font-medium text-ink">{t('keep.shield.upgradesTitle')}</p>
                          <ul className="mt-2 flex flex-col gap-1.5">
                            {WILDFIRE.map((w) => (
                              <li key={w} className="flex gap-2 text-[15px] leading-[22px] text-ink-2">
                                <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-pine" aria-hidden />
                                {t(`keep.shield.upgrade.${w}`)}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                      {m.key === 'habitat' && open === 'habitat' && !isDone && (
                        <motion.div key="hb" id="habitat-message" {...reveal} className="mt-4">
                          <label htmlFor="habitat-text" className="text-[15px] font-medium text-ink">
                            {t('keep.shield.messageLabel')}
                          </label>
                          <textarea
                            id="habitat-text"
                            className="field mt-2 min-h-[150px] py-3 leading-[22px]"
                            value={message ?? ''}
                            onChange={(e) => setMessage(e.target.value)}
                            data-testid="habitat-text"
                          />
                          <div className="mt-3 flex gap-2">
                            <Button
                              disabled={!message?.trim()}
                              onClick={() => {
                                console.log('[keep] message to Habitat homeowner services:', message);
                                toggle('habitat', true);
                                setOpen(null);
                                toast(t('keep.shield.sent'));
                              }}
                              data-testid="move-habitat-send"
                            >
                              {t('keep.shield.send')}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
});
