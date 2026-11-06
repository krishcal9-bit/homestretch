'use client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from '@/components/FamilyHeader';
import { Button } from '@/components/ui/Button';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) {
        const next = params.get('next');
        router.replace(next && next.startsWith('/staff') ? next : '/staff');
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "That password didn't work. Try again.");
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[360px]" noValidate>
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/" className="hit inline-flex min-h-[36px] items-center gap-1 rounded-[8px] px-2 text-[13px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft">
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          Family site
        </Link>
      </div>
      <h1 className="t-title mt-10">Staff console</h1>
      <p className="mt-2 text-[15px] text-ink-2">Habitat OC family services. Sign in to see the plans families have shared.</p>
      <label htmlFor="staff-pw" className="mt-8 block text-[15px] font-medium">
        Password
      </label>
      <input
        id="staff-pw"
        type="password"
        autoComplete="current-password"
        autoFocus
        className="field mt-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={!!error}
        aria-describedby="staff-pw-error"
      />
      <p id="staff-pw-error" role="alert" className="mt-2 min-h-[20px] text-[13px] leading-[20px] text-signal-red">
        {error}
      </p>
      <Button type="submit" full loading={busy} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
