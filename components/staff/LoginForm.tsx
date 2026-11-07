'use client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Wordmark } from '@/components/FamilyHeader';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { dur, ease } from '@/lib/motion';
import { BuildStreet } from './BuildStreet';
import { markConsoleArrival } from './handoff';

// Wrong password: the field shakes 6px twice (~360ms) and the error stays. Reduced motion: no shake.
const SHAKE_X = [0, -6, 6, -6, 6, 0];
const SHAKE = { duration: dur.short * 1.8, ease: ease.inOut };
// Signed in: the panel leaves 12px to the left while it fades (200ms); the console arrives from the right.
const LEAVE = { duration: dur.short, ease: ease.out };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [field, animateField] = useAnimate<HTMLDivElement>();
  const input = useRef<HTMLInputElement>(null);

  function rejected(message: string) {
    setError(message);
    setBusy(false);
    // Keep the caret in the field with the old attempt selected, so typing replaces it.
    requestAnimationFrame(() => input.current?.select());
    if (!reduce && field.current) animateField(field.current, { x: SHAKE_X }, SHAKE);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || leaving) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) {
        const next = params.get('next');
        markConsoleArrival();
        setLeaving(true);
        // Navigate while the panel leaves: the console replaces it as soon as it is ready.
        router.replace(next && next.startsWith('/staff') ? next : '/staff');
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      rejected(body?.error?.message ?? "That password didn't work. Try again.");
    } catch {
      rejected('Could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <motion.form
      onSubmit={submit}
      className="mx-auto w-full max-w-[360px]"
      noValidate
      initial={false}
      animate={leaving ? { opacity: 0, x: reduce ? 0 : -12 } : { opacity: 1, x: 0 }}
      transition={LEAVE}
      aria-busy={leaving || undefined}
    >
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-1">
        <Link href="/" className="hit inline-flex min-h-[36px] items-center gap-1 rounded-[8px] px-2 text-[13px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft">
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          Family site
        </Link>
        <ThemeToggle className="-mr-2" />
        </div>
      </div>
      <BuildStreet className="mt-12" />
      <h1 className="t-title mt-8">Staff console</h1>
      <p className="mt-2 text-[15px] text-ink-2">Habitat OC family services. Sign in to see the plans families have shared.</p>
      <label htmlFor="staff-pw" className="mt-8 block text-[15px] font-medium">
        Password
      </label>
      <div ref={field} className="mt-2">
        <input
          ref={input}
          id="staff-pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="staff-pw-error"
        />
      </div>
      <p id="staff-pw-error" role="alert" className="mt-2 min-h-[20px] text-[13px] leading-[20px] text-signal-red">
        {error}
      </p>
      <Button type="submit" full loading={busy} className="mt-2">
        Sign in
      </Button>
    </motion.form>
  );
}
