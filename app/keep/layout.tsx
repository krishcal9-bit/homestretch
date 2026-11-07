import type { Metadata } from 'next';
import { FamilyHeader } from '@/components/FamilyHeader';
import { KeepTabs } from '@/components/keep/KeepTabs';

export const metadata: Metadata = {
  title: 'Keep · HomeStretch',
  description: 'See payment changes coming and get ready for them.',
};

/** KEEP mode: for Habitat homeowners. The header, the section tabs, then the page. */
export default function KeepLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FamilyHeader wide />
      <KeepTabs />
      {children}
    </>
  );
}
