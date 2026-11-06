'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { useVTRouter } from '@/lib/vt';
import { LanguageToggle } from './LanguageToggle';

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em] text-ink">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M3 9.5 10 3l7 6.5V17H3z" fill="none" stroke="var(--pine)" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M3 14h14" stroke="var(--pine)" strokeWidth="1.75" />
      </svg>
      Homestretch
    </span>
  );
}

/** Quiet "Staff sign in" link; navigates with the crisp staff fade. */
export function StaffLink({ className = '' }: { className?: string }) {
  const { t } = useLang();
  const router = useVTRouter();
  return (
    <Link
      href="/staff/login"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push('/staff/login', 'fade');
      }}
      className={`hit inline-flex min-h-[36px] items-center text-[13px] font-medium text-ink-2 underline-offset-4 transition-colors duration-[120ms] hover:text-pine hover:underline ${className}`}
      data-testid="staff-link"
    >
      {t('welcome.staff')}
    </Link>
  );
}

/**
 * 64px sticky header. On the landing page it is wide and transparent at the top, gaining a surface
 * background and hairline after 24px of scroll. Inside the app it is the narrow, solid version.
 */
export function FamilyHeader({ variant = 'app' }: { variant?: 'landing' | 'app' }) {
  const { t } = useLang();
  const landing = variant === 'landing';
  const [scrolled, setScrolled] = useState(!landing);
  useEffect(() => {
    if (!landing) return;
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [landing]);
  return (
    <header className="vt-header sticky top-0 z-30">
      <div
        aria-hidden
        className={`absolute inset-0 border-b transition-opacity duration-200 ${landing ? 'border-line bg-surface' : 'border-line bg-paper'}`}
        style={{ opacity: scrolled ? 1 : 0, transitionTimingFunction: 'ease' }}
      />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('app.skipToContent')}
      </a>
      <div className={`relative mx-auto flex h-16 items-center justify-between px-5 ${landing ? 'max-w-[1280px] lg:px-8' : 'max-w-[560px]'}`}>
        <Link href="/" className="-ml-1 rounded px-1" aria-label="Homestretch">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4">
          <StaffLink />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
