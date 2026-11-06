'use client';
import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { addMonths } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { spring, stagger } from '@/lib/motion';
import { CheckMark } from '@/components/ui/Checkbox';
import type { PlanOutput } from '@/lib/plan';
import { ExternalLink } from 'lucide-react';

export function PlanSkeleton() {
  return (
    <div className="panel flex flex-col gap-4 !p-5" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton h-[22px] w-[22px] shrink-0" />
          <div className="flex-1">
            <div className="skeleton h-[18px] w-3/4" />
            <div className="skeleton mt-2 h-[14px] w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanChecklist({ plan, checklist, onToggle, today = new Date() }: { plan: PlanOutput; checklist: Record<string, boolean>; onToggle: (i: string, done: boolean) => void; today?: Date }) {
  const { t, lang } = useLang();
  const done = plan.actions.filter((_, i) => checklist[String(i)]).length;
  return (
    <motion.div layout transition={spring.smooth} className="panel !p-0" data-testid="checklist">
      <p className="t-helper tnum border-b border-line px-5 py-3 text-ink-2">{t('plan.progress', { done, total: plan.actions.length })}</p>
      <ul className="divide-y divide-line">
        <AnimatePresence initial={true}>
          {plan.actions.map((a, i) => {
            const checked = !!checklist[String(i)];
            const id = `action-${i}`;
            return (
              <motion.li key={a.title + i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: i * stagger }}>
                <div className="flex gap-3 px-5 py-4">
                  <label htmlFor={id} className="flex min-h-[44px] min-w-[44px] -translate-x-[11px] -translate-y-[11px] cursor-pointer items-center justify-center self-start">
                    <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onToggle(String(i), e.target.checked)} />
                    <span className="rounded-[6px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine">
                      <CheckMark checked={checked} />
                    </span>
                  </label>
                  <div className="-ml-[22px] min-w-0 flex-1">
                    <label htmlFor={id} className={`block cursor-pointer text-[16px] font-medium leading-[22px] transition-colors duration-200 ${checked ? 'text-ink-2' : 'text-ink'}`}>
                      {a.title}
                    </label>
                    <p className={`mt-1 text-[15px] leading-[22px] transition-colors duration-200 ${checked ? 'text-ink-2/80' : 'text-ink-2'}`}>{a.detail}</p>
                    <p className="t-helper tnum mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
                      <span>{t(`plan.owner.${a.owner}`)}</span>
                      <span aria-hidden>·</span>
                      <span>{a.byMonth <= 0 ? t('plan.byNow') : t('plan.byMonth', { month: monthName(addMonths(today, a.byMonth), lang) })}</span>
                      {a.resource && (
                        <>
                          <span aria-hidden>·</span>
                          <a href={a.resource.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[24px] items-center gap-1 font-medium text-pine underline-offset-4 hover:underline">
                            {a.resource.name}
                            <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}

export function UnderwritersEye({ items, renderAction }: { items: NonNullable<PlanOutput['underwritersEye']>; renderAction?: (item: NonNullable<PlanOutput['underwritersEye']>[number], i: number) => React.ReactNode }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-4" data-testid="underwriters-eye">
      <p className="text-[15px] text-ink-2">{t('plan.ueHelp')}</p>
      {items.map((u, i) => (
        <div key={i} className="panel">
          <p className={`border-l-2 pl-3 text-[16px] font-medium leading-[22px] ${u.kind === 'overdraft' ? 'border-signal-red text-signal-red' : 'border-signal-amber text-signal-amber'}`}>{u.finding}</p>
          <p className="mt-3 text-[15px] leading-[22px] text-ink">
            <span className="font-medium">{t('plan.whatToDo')}: </span>
            {u.whatToDo}
          </p>
          {renderAction?.(u, i)}
        </div>
      ))}
    </div>
  );
}
