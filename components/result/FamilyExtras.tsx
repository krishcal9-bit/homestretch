'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Copy, MessageSquare, Download } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useStored } from '@/lib/useStored';
import { spring } from '@/lib/motion';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import type { PlanOutput } from '@/lib/plan';
import type { Lang } from '@/lib/types';
import type { ResultExtrasProps } from './ResultScreen';
import { Section } from './Panels';
import { PlanChecklist, PlanSkeleton, UnderwritersEye } from './PlanChecklist';
import { LetterEditor } from './LetterEditor';
import { CounselorHandoff } from '@/components/CounselorHandoff';

type StoredPlan = { lang: Lang | null; plan: PlanOutput | null; source?: string; key?: string };

/** Answers that change the plan (levers excluded: sliders never refetch). */
const answersKey = (p: ResultExtrasProps['profile']) => JSON.stringify({ ...p, levers: undefined });

export function usePlan(profile: ResultExtrasProps['profile'], lang: Lang) {
  const [stored, setStored, ready] = useStored<StoredPlan>('hs.plan', { lang: null, plan: null });
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const inflight = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const fetchPlan = useCallback(
    async (regenerate = false) => {
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      const slowTimer = setTimeout(() => setSlow(true), 300);
      try {
        const ctrl = new AbortController();
        const kill = setTimeout(() => ctrl.abort(), 45_000);
        const res = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: profileRef.current, lang, regenerate }), signal: ctrl.signal });
        clearTimeout(kill);
        const data = await res.json();
        if (data.plan) setStored({ lang, plan: data.plan, source: data.source, key: answersKey(profileRef.current) });
      } catch {
        setStored((s) => ({ ...s, source: 'error' }));
      } finally {
        clearTimeout(slowTimer);
        inflight.current = false;
        setLoading(false);
        setSlow(false);
      }
    },
    [lang, setStored],
  );
  const key = answersKey(profile);
  useEffect(() => {
    if (ready && (!stored.plan || stored.lang !== lang || (stored.key && stored.key !== key))) fetchPlan();
  }, [ready, stored.plan, stored.lang, stored.key, key, lang, fetchPlan]);
  return { plan: stored.lang === lang ? stored.plan : null, source: stored.source, loading, slow, regenerate: () => fetchPlan(true), ready };
}

export function FamilyExtras({ profile }: ResultExtrasProps) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { plan, source, loading, slow, regenerate } = usePlan(profile, lang);
  const [checklist, setChecklist] = useStored<Record<string, boolean>>('hs.checklist', {});
  const [code, setCode] = useStored<string | null>('hs.code', null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');

  const toggle = (i: string, done: boolean) => {
    setChecklist((c) => ({ ...c, [i]: done })); // optimistic
    if (code) fetch(`/api/plans/${code}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ index: i, done }) }).catch(() => {});
  };

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch('/api/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, lang, plan, checklist, code: code ?? undefined }) });
      const data = await res.json();
      if (!res.ok || !data.code) throw new Error();
      setCode(data.code);
      toast(t('plan.saved'));
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/plan/${code}` : '';

  return (
    <>
      {profile.statement && plan?.underwritersEye && plan.underwritersEye.length > 0 && (
        <Section title={t('plan.ueTitle')} id="ue">
          <UnderwritersEye items={plan.underwritersEye} renderAction={(u) => (u.kind === 'unlisted_loan' ? null : <LetterEditor finding={u} />)} />
        </Section>
      )}
      <Section
        title={t('plan.title')}
        id="plan"
        action={
          plan && (
            <Button variant="quiet" onClick={regenerate} loading={loading} className="!min-h-[36px] !px-2 text-[13px]">
              <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
              {t('plan.regenerate')}
            </Button>
          )
        }
      >
        {source === 'fallback' && plan && <p className="t-helper mb-3 text-ink-2">{t('plan.error')}</p>}
        {!plan ? loading && !slow ? <div className="h-[320px]" /> : <PlanSkeleton /> : <PlanChecklist plan={plan} checklist={checklist} onToggle={toggle} />}
      </Section>

      <CounselorHandoff profile={profile} code={code ?? undefined} lang={lang} />

      <Section title={t('plan.saveTitle')} id="save">
        <div className="panel !p-5">
          <AnimatePresence mode="popLayout" initial={false}>
            {!code ? (
              <motion.div key="unsaved" exit={{ opacity: 0 }} transition={spring.smooth}>
                <p className="mb-4 text-[15px] text-ink-2">{t('plan.saveHelp')}</p>
                <Button onClick={save} loading={saving} full size="lg">
                  {t('plan.save')}
                </Button>
                {saveError && (
                  <p role="alert" className="t-helper mt-3 text-signal-red">
                    {t('plan.saveError')}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div key="saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
                <p className="text-[15px] text-ink-2">{t('plan.yourCode')}</p>
                <p className="tnum mt-1 text-[28px] font-semibold leading-[34px] tracking-[0.12em] text-ink" data-testid="plan-code">
                  {code}
                </p>
                <p className="mt-4 text-[15px] text-ink-2">{t('plan.link')}</p>
                <a href={`/plan/${code}`} className="mt-1 block break-all text-[15px] font-medium text-pine underline-offset-4 hover:underline" data-testid="plan-link">
                  {link}
                </a>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(link).catch(() => {});
                      toast(t('plan.copied'));
                    }}
                  >
                    <Copy size={18} strokeWidth={1.75} aria-hidden />
                    {t('plan.copyLink')}
                  </Button>
                  <Button variant="secondary" onClick={() => setPhoneOpen((v) => !v)} aria-expanded={phoneOpen}>
                    <MessageSquare size={18} strokeWidth={1.75} aria-hidden />
                    {t('plan.textMe')}
                  </Button>
                  <Button variant="secondary" onClick={() => window.open(`/api/pdf/plan/${code}?lang=${lang}`, '_blank')} data-testid="download-pdf">
                    <Download size={18} strokeWidth={1.75} aria-hidden />
                    {t('plan.downloadPdf')}
                  </Button>
                </div>
                <AnimatePresence initial={false}>
                  {phoneOpen && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring.smooth}
                      className="overflow-hidden"
                      onSubmit={(e) => {
                        e.preventDefault();
                        // Mock send: no SMS provider in the demo.
                        console.log(`[sms:mock] to ${phone}: Your Homestretch plan: ${link}`);
                        toast(t('plan.texted'));
                        setPhoneOpen(false);
                      }}
                    >
                      <div className="flex items-end gap-2 pt-4">
                        <label className="flex-1">
                          <span className="mb-2 block text-[15px] font-medium text-ink">{t('plan.phone')}</span>
                          <input className="field tnum" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </label>
                        <Button type="submit">{t('plan.send')}</Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="t-helper mt-4 text-ink-2">{t('plan.consent')}</p>
      </Section>
    </>
  );
}
