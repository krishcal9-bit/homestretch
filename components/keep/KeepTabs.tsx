'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';

const TABS = [
  { href: '/keep', key: 'forecast' },
  { href: '/keep/home', key: 'home' },
  { href: '/keep/relief', key: 'relief' },
  { href: '/keep/checkin', key: 'checkin' },
] as const;

/** Keep's sections. The active underline is one shared element that glides between tabs. */
export function KeepTabs() {
  const { t } = useLang();
  const path = usePathname();
  const active = (href: string) => (href === '/keep' ? path === '/keep' || path === '/keep/setup' : path.startsWith(href));
  return (
    <nav aria-label={t('keep.nav.label')} className="border-b border-line">
      <ul className="mx-auto flex max-w-[1120px] gap-1 overflow-x-auto px-3 [scrollbar-width:none] lg:px-6 [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const on = active(tab.href);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                className={`relative flex min-h-[44px] items-center whitespace-nowrap px-2 text-[15px] font-medium transition-colors duration-[120ms] ${on ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
                data-testid={`keep-tab-${tab.key}`}
              >
                {t(`keep.nav.${tab.key}`)}
                {on && <motion.span layoutId="keep-tab" transition={spring.snappy} className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-pine" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
