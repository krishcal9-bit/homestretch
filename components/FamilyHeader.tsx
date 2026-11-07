'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { useVTRouter } from '@/lib/vt';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { Wordmark as BrandWordmark } from './brand/Wordmark';
import { useBrand } from '@/lib/brand';

/** The Keystone wordmark (static): footer, staff console, login. */
export function Wordmark({ height = 24 }: { height?: number }) {
  return <BrandWordmark height={height} />;
}

/** The header wordmark (28px). On the landing page it is the slot the title card flies onto. */
function HeaderWordmark({ height = 28 }: { height?: number }) {
  const b = useBrand();
  return <BrandWordmark height={height} svgClassName="h-[24px] w-auto sm:h-[28px]" slot className={b.stage === 'title' ? 'invisible' : undefined} />;
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
      className={`hit inline-flex min-h-[36px] items-center whitespace-nowrap text-[13px] font-medium text-ink-2 underline-offset-4 transition-colors duration-[120ms] hover:text-pine hover:underline ${className}`}
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
export function FamilyHeader({ variant = 'app', wide = false }: { variant?: 'landing' | 'app'; /** app pages with a desktop layout (Keep) */ wide?: boolean }) {
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
  // During the landing intro the header sits above the overlay so the wordmark can fly into it;
  // its controls fade in once the wordmark has landed.
  const b = useBrand();
  const onStage = b.stage === 'title' || b.fly;
  return (
    <header className={`vt-header sticky top-0 ${onStage ? 'z-[75]' : 'z-30'}`}>
      <div
        aria-hidden
        className={`absolute inset-0 border-b transition-opacity duration-200 ${landing ? 'border-line bg-surface' : 'border-line bg-paper'}`}
        style={{ opacity: scrolled ? 1 : 0, transitionTimingFunction: 'ease' }}
      />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('app.skipToContent')}
      </a>
      <div className={`relative mx-auto flex h-16 items-center justify-between px-5 ${landing ? 'max-w-[1280px] lg:px-8' : wide ? 'max-w-[1120px] lg:px-8' : 'max-w-[560px]'}`}>
        <Link href="/" className="-ml-1 flex items-center rounded px-1" aria-label="Keystone">
          <HeaderWordmark />
        </Link>
        <div className="flex items-center gap-3 transition-opacity duration-300 sm:gap-4" style={{ opacity: b.stage === 'title' ? 0 : 1, pointerEvents: b.stage === 'title' ? 'none' : undefined, transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)', transitionDuration: b.stage === 'title' ? '0ms' : '300ms', transitionDelay: b.fly ? '250ms' : '0ms' }}>
          {/* the staff console is desktop-only (≥1024px); on phones the header keeps room for language and theme */}
          <StaffLink className="max-sm:hidden" />
          <LanguageToggle />
          <ThemeToggle className="-ml-1 -mr-2 sm:-ml-2" />
        </div>
      </div>
    </header>
  );
}
