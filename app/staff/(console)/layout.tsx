import type { Metadata } from 'next';
import { ConsoleTransition } from '@/components/staff/ConsoleTransition';
import { StaffNav } from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Staff · Keystone' };
export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="staff-paper min-h-screen min-w-[1024px]">
      <StaffNav />
      <main id="main" className="max-w-[1280px] px-8 pb-24 pt-8">
        <ConsoleTransition>{children}</ConsoleTransition>
      </main>
    </div>
  );
}
