'use client';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/FamilyHeader';
import { spring } from '@/lib/motion';

const TABS = [
  { href: '/staff', label: 'Pipeline' },
  { href: '/staff/homes', label: 'Homes' },
  { href: '/staff/match', label: 'Match' },
  { href: '/staff/insights', label: 'Insights' },
];

export function StaffNav() {
  const path = usePathname();
  const active = TABS.slice().reverse().find((t) => (t.href === '/staff' ? path === '/staff' : path.startsWith(t.href)))?.href;
  return (
    <header className="border-b border-line bg-paper">
      <div className="flex h-14 max-w-[1280px] items-center gap-8 px-8">
        <Link href="/staff" className="-ml-1 rounded px-1" aria-label="Homestretch staff, pipeline">
          <Wordmark />
        </Link>
        <nav aria-label="Staff" className="flex items-center gap-1">
          {TABS.map((t) => {
            const on = t.href === active;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`hit relative inline-flex min-h-[36px] items-center rounded-[8px] px-3 text-[15px] font-medium transition-colors duration-[120ms] ${on ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                {on && <motion.span layoutId="staff-tab" transition={spring.snappy} className="absolute inset-0 rounded-[8px] bg-pine-soft" aria-hidden />}
                <span className="relative">{t.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/api/staff/logout" method="post" className="ml-auto">
          <button type="submit" className="min-h-[44px] rounded-[8px] px-3 text-[15px] text-ink-2 transition-colors duration-[120ms] hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
