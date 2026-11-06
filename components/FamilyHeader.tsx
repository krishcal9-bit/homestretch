'use client';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
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

export function FamilyHeader() {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('app.skipToContent')}
      </a>
      <div className="mx-auto flex h-14 max-w-[560px] items-center justify-between px-5">
        <Link href="/" className="-ml-1 rounded px-1" aria-label="Homestretch">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/staff/login" className="hit inline-flex min-h-[36px] items-center text-[13px] font-medium text-ink-2 underline-offset-4 transition-colors duration-[120ms] hover:text-pine hover:underline" data-testid="staff-link">
            {t('welcome.staff')}
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
