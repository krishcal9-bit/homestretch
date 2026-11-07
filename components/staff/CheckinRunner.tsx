'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { dur, ease, spring, stagger } from '@/lib/motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toast';
import type { Change } from '@/lib/checkin';

type Item = { familyId: string; name: string; language: 'en' | 'es'; change: Change[]; digest: string[]; nudge: string; enter: number | null };

// Rows rise in as they stream: opacity and 8px, 200ms ease-out, at least 40ms apart when several arrive at
// once. The first six of a run animate; later ones (below the fold by then) appear at once. Reduced motion:
// MotionConfig drops the rise, and the fade is all that's left.
const RISE = 8;
const RISE_CAP = 6;

/** D7: runs the Monday check-in, streaming families in as the server finishes each one. */
export function CheckinRunner() {
  const toast = useToast();
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [queued, setQueued] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState(0);
  const started = useRef(false);
  // Entrance schedule for this run: how many rows have risen, and when the next may start (ms).
  const rise = useRef({ count: 0, next: 0 });

  const run = async () => {
    setRunId((n) => n + 1); // a fresh progress line per run, starting from the left
    setItems([]);
    setDone(0);
    setStatus('running');
    rise.current = { count: 0, next: 0 };
    try {
      const res = await fetch('/api/checkin', { method: 'POST' });
      if (!res.body) throw new Error();
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
          else if (ev.type === 'family') {
            const r = rise.current;
            const now = performance.now();
            let enter: number | null = null;
            if (r.count < RISE_CAP) {
              const at = Math.max(now, r.next);
              enter = (at - now) / 1000;
              r.next = at + stagger * 1000;
            }
            r.count++;
            setItems((xs) => [...xs, { ...ev, enter }]);
          }
          else if (ev.type === 'error') setStatus('error');
          else if (ev.type === 'done') setStatus('done');
        }
      }
      setStatus((s) => (s === 'running' ? 'done' : s));
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, []);

  return (
    <div>
      <Link href="/staff/ready" className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-[8px] px-2 text-[15px] font-medium text-pine hover:bg-pine-soft">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        Ready pipeline
      </Link>
      <div className="mt-2 flex items-end justify-between gap-6">
        <div>
          <h1 className="t-title">Monday check-in</h1>
          <p className="tnum mt-1 text-[15px] text-ink-2" aria-live="polite">
            {status === 'running' ? (
              <>
                Checked <AnimatedNumber speed="snappy" value={done} format={(n) => String(Math.round(n))} /> of {total || '…'} families ·{' '}
              </>
            ) : null}
            <AnimatedNumber speed="snappy" value={items.length} format={(n) => String(Math.round(n))} /> {items.length === 1 ? 'family' : 'families'} changed this week
          </p>
        </div>
        <Button variant="secondary" onClick={run} loading={status === 'running'} data-testid="rerun">
          Run again
        </Button>
      </div>
      {/* A thin pine line that runs across with the progress, then fades once the run has finished. */}
      <div className="relative mt-4 h-[2px] w-full" aria-hidden>
        <motion.div
          key={runId}
          className="absolute inset-0 origin-left bg-pine"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: total ? done / total : 0, opacity: status === 'running' ? 1 : 0 }}
          transition={{ scaleX: spring.smooth, opacity: { duration: dur.short, ease: ease.out, delay: status === 'running' ? 0 : dur.short } }}
        />
      </div>

      {status === 'done' && items.length === 0 && (
        <p className="panel mt-8 text-[15px] text-ink-2" data-testid="no-changes">
          No changes since the last check-in. Every family is where they were.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-8 border-l-2 border-signal-red pl-3 text-[15px] text-signal-red">
          The check-in stopped partway. Run it again; families already checked won&apos;t repeat.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-4" data-testid="checkin-list">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.familyId}
              initial={it.enter === null ? false : { opacity: 0, y: RISE }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.short, ease: ease.out, delay: it.enter ?? 0 }}
              className="panel grid grid-cols-1 gap-6 !p-5 lg:grid-cols-[1fr_1.2fr]"
              data-testid="checkin-item"
            >
              <div>
                <p className="text-[16px] font-semibold text-ink">
                  {it.name} <span className="t-helper tnum font-normal text-ink-2">· {it.familyId} · {it.language === 'es' ? 'Spanish' : 'English'}</span>
                </p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {it.digest.map((d, j) => (
                    <li key={j} className="tnum text-[15px] leading-[22px] text-ink">
                      {d}
                    </li>
                  ))}
                </ul>
                {it.change.some((c) => !it.digest.includes(c.text)) && <p className="t-helper mt-3 text-ink-2">{it.change.map((c) => c.text).join(' · ')}</p>}
              </div>
              <div>
                <label htmlFor={`nudge-${it.familyId}`} className="text-[13px] font-medium text-ink-2">
                  Draft nudge ({it.language === 'es' ? 'Spanish' : 'English'})
                </label>
                <textarea
                  id={`nudge-${it.familyId}`}
                  value={edits[it.familyId] ?? it.nudge}
                  onChange={(e) => setEdits((x) => ({ ...x, [it.familyId]: e.target.value }))}
                  rows={4}
                  className="field mt-2 block w-full resize-y py-3 text-[15px] leading-[22px]"
                />
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    variant={queued[it.familyId] ? 'secondary' : 'primary'}
                    onClick={() => {
                      setQueued((q) => ({ ...q, [it.familyId]: !q[it.familyId] }));
                      if (!queued[it.familyId]) toast(`Approved and queued for ${it.name}`);
                    }}
                  >
                    {queued[it.familyId] ? 'Queued' : 'Approve and queue'}
                  </Button>
                  <span className="t-helper text-ink-2">Nothing sends automatically.</span>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
