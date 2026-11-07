'use client';
// The frame for the Keep pages built here (Home health, Relief, Check-in): header, width, the "set up first"
// gate and the page heading. Standalone it brings the family header; once app/keep/layout.tsx provides the Keep
// header and tabs, pass `bare` (or drop the header line) so it isn't drawn twice.
import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { FamilyHeader } from '@/components/FamilyHeader';
import { Button } from '@/components/ui/Button';
import { useLang } from '@/lib/i18n';
import { demoState, useKeep, type KeepState } from '@/lib/keepStore';
import { dur, ease } from '@/lib/motion';

const noop = () => () => {};
/** true once the page has hydrated (the Keep store lives in localStorage, so the server can't know it). */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function KeepFrame({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  return (
    <>
      {!bare && <FamilyHeader />}
      <main id="main" className="mx-auto max-w-[560px] px-5 pb-24 pt-6 lg:max-w-[1040px] lg:px-8 lg:pt-10">
        {children}
      </main>
    </>
  );
}

/** Title and one line under it. The title takes focus on arrival so screen readers announce the page. */
export function KeepHead({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.medium, ease: ease.out }} className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-10">
      <div className="max-w-[620px]">
        <h1 data-screen-title tabIndex={-1} className="t-title text-ink lg:text-[32px] lg:leading-[38px]">
          {title}
        </h1>
        <p className="mt-2 text-[16px] leading-[24px] text-ink-2">{sub}</p>
      </div>
      {action}
    </motion.div>
  );
}

/**
 * Renders children once the family's Keep profile exists. Before setup: a calm empty state that says what to do
 * next (set up Keep, or look around with the sample family).
 */
export function KeepGate({ children }: { children: (state: KeepState, update: ReturnType<typeof useKeep>[1]) => ReactNode }) {
  const { t } = useLang();
  const hydrated = useHydrated();
  const [state, update] = useKeep();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy />;
  if (!state.ready) {
    return (
      <section className="max-w-[520px] py-6" data-testid="keep-empty">
        <h1 data-screen-title tabIndex={-1} className="t-title text-ink">
          {t('keepCommon.emptyTitle')}
        </h1>
        <p className="mt-3 text-ink-2">{t('keepCommon.emptyBody')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/keep" className="press inline-flex min-h-[44px] items-center rounded-[8px] bg-pine px-4 text-[15px] font-medium text-on-pine hover:bg-pine-hover">
            {t('keepCommon.setUp')}
          </Link>
          <Button variant="secondary" onClick={() => update(demoState())} data-testid="use-sample-family">
            {t('keepCommon.useSample')}
          </Button>
        </div>
      </section>
    );
  }
  return <>{children(state, update)}</>;
}
