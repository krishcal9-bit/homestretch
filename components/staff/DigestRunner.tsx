'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import type { DigestLine } from '@/lib/earlyWarning';
import { dur, ease, spring, stagger } from '@/lib/motion';
import { RiskLevel } from './RiskLevel';

// Households rise in as the server finishes each one: opacity and 8px, 200ms ease-out, at least 40ms apart.
// The first six of a run animate; later ones appear at once. Nothing runs until staff press the button.
const RISE = 8;
const RISE_CAP = 6;
const whole = (n: number) => String(Math.round(n));

type Item = DigestLine & { enter: number | null };
type Status = 'idle' | 'running' | 'done' | 'error';

const KIND_LABEL: Record<string, string> = { shock: 'New shock within 90 days', breathing: 'Breathing room dropped', checkin: 'Check-in missed', milestone: 'Milestone reached' };

export function DigestRunner() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [runId, setRunId] = useState(0);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const rise = useRef({ count: 0, next: 0 });

  const run = async () => {
    setRunId((n) => n + 1);
    setItems([]);
    setDone(0);
    setTotal(0);
    setApproved({});
    setEditing({});
    setEdits({});
    setStatus('running');
    rise.current = { count: 0, next: 0 };
    try {
      const res = await fetch('/api/digest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'start') setTotal(ev.total);
          else if (ev.type === 'progress') setDone(ev.done);
          else if (ev.type === 'household') {
            const r = rise.current;
            const now = performance.now();
            let enter: number | null = null;
            if (r.count < RISE_CAP) {
              const at = Math.max(now, r.next);
              enter = (at - now) / 1000;
              r.next = at + stagger * 1000;
            }
            r.count++;
            const { type: _t, ...rest } = ev;
            void _t;
            setItems((xs) => [...xs, { ...(rest as DigestLine), enter }]);
          } else if (ev.type === 'error') setStatus('error');
          else if (ev.type === 'done') setStatus('done');
        }
      }
      setStatus((s) => (s === 'running' ? 'done' : s));
    } catch {
      setStatus('error');
    }
  };

  const key = (id: string, lang: 'es' | 'en') => `${id}:${lang}`;
  const text = (it: Item, lang: 'es' | 'en') => edits[key(it.id, lang)] ?? it.draft[lang] ?? '';

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="t-title">Weekly digest</h1>
          <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">
            Every Monday: which homeowners’ payment picture changed since last week (a new shock within 90 days, less breathing room, a missed check-in, a milestone), with a short note to approve. Nothing sends automatically.
          </p>
        </div>
        <Button onClick={run} loading={status === 'running'} variant={status === 'idle' ? 'primary' : 'secondary'} data-testid="run-digest" className="shrink-0">
          {status === 'idle' ? 'Run weekly digest' : 'Run again'}
        </Button>
      </div>

      <p className="tnum mt-6 min-h-[22px] text-[15px] text-ink-2" aria-live="polite" data-testid="digest-status">
        {status === 'idle' && 'Not run yet this week.'}
        {status !== 'idle' && (
          <>
            {status === 'running' && (
              <>
                Checked <AnimatedNumber speed="snappy" value={done} format={whole} /> of {total || '…'} homeowners ·{' '}
              </>
            )}
            <AnimatedNumber speed="snappy" value={items.length} format={whole} /> {items.length === 1 ? 'household' : 'households'} changed since last week
          </>
        )}
      </p>
      <div className="relative mt-3 h-[2px] w-full" aria-hidden>
        {status !== 'idle' && (
          <motion.div
            key={runId}
            className="absolute inset-0 origin-left bg-pine"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: total ? done / total : 0, opacity: status === 'running' ? 1 : 0 }}
            transition={{ scaleX: spring.smooth, opacity: { duration: dur.short, ease: ease.out, delay: status === 'running' ? 0 : dur.short } }}
          />
        )}
      </div>

      {status === 'idle' && <p className="panel mt-8 text-[15px] text-ink-2">Run the digest to see this week’s changes, one household at a time as each is checked.</p>}
      {status === 'done' && items.length === 0 && (
        <p className="panel mt-8 text-[15px] text-ink-2" data-testid="digest-empty">
          No changes since last week. Every homeowner is where they were.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-8 border-l-2 border-signal-red pl-3 text-[15px] text-signal-red">
          The digest stopped partway. Run it again.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-4" data-testid="digest-list">
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const langs: ('es' | 'en')[] = it.draft.es ? ['es', 'en'] : ['en'];
            const isEditing = !!editing[it.id];
            const ok = !!approved[it.id];
            return (
              <motion.li
                key={`${runId}:${it.id}`}
                initial={it.enter === null ? false : { opacity: 0, y: RISE }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.short, ease: ease.out, delay: it.enter ?? 0 }}
                className="panel grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-8 !p-5"
                data-testid="digest-item"
                data-id={it.id}
                data-lang={it.language}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[16px] font-semibold text-ink">
                      {it.household}
                      <span className="tnum ml-2 text-[13px] font-normal text-ink-2">{it.language === 'es' ? 'Spanish' : 'English'}</span>
                    </p>
                    <RiskLevel level={it.level} className="text-[13px]" />
                  </div>
                  <p className="mt-2 text-[15px] leading-[22px] text-ink" data-testid="digest-summary">
                    {it.summary}
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {it.changes.map((c, j) => (
                      <li key={j} className="tnum text-[13px] leading-[18px] text-ink-2" data-kind={c.kind}>
                        <span className="font-medium text-ink">{KIND_LABEL[c.kind]}</span>
                        {it.summary.includes(c.text) ? null : <> · {c.text}</>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  {langs.map((lang) => (
                    <div key={lang} className={lang === 'en' && langs.length > 1 ? 'mt-3' : ''}>
                      <label htmlFor={`dg-${it.id}-${lang}`} className="text-[13px] font-medium text-ink-2">
                        {lang === 'es' ? 'Draft (Spanish)' : langs.length > 1 ? 'English translation, for staff' : 'Draft (English)'}
                      </label>
                      {isEditing ? (
                        <textarea
                          id={`dg-${it.id}-${lang}`}
                          value={text(it, lang)}
                          onChange={(e) => setEdits((x) => ({ ...x, [key(it.id, lang)]: e.target.value }))}
                          rows={4}
                          lang={lang}
                          className="field mt-1 block w-full resize-y py-3 text-[15px] leading-[22px]"
                        />
                      ) : (
                        <p id={`dg-${it.id}-${lang}`} lang={lang} className={`mt-1 whitespace-pre-line text-[15px] leading-[22px] ${lang === 'en' && langs.length > 1 ? 'text-[13px] leading-[19px] text-ink-2' : 'text-ink'}`} data-testid={`digest-draft-${lang}`}>
                          {text(it, lang)}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      variant={ok ? 'secondary' : 'primary'}
                      disabled={ok}
                      onClick={() => {
                        setApproved((a) => ({ ...a, [it.id]: true }));
                        setEditing((e) => ({ ...e, [it.id]: false }));
                        console.info('[digest:sample-send]', { id: it.id, to: it.household, es: text(it, 'es') || undefined, en: text(it, 'en') });
                        toast(`Approved. Sample send to the ${it.surname} family logged; nothing left Keystone.`);
                      }}
                      data-testid="digest-approve"
                    >
                      {ok ? 'Approved' : 'Approve'}
                    </Button>
                    <Button variant="secondary" disabled={ok} onClick={() => setEditing((e) => ({ ...e, [it.id]: !isEditing }))} data-testid="digest-edit">
                      {isEditing ? 'Done editing' : 'Edit'}
                    </Button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
