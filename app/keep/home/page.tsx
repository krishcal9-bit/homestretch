import type { Metadata } from 'next';
import { KeepFrame } from '@/components/keep/KeepFrame';
import { HomeHealth } from '@/components/keep/HomeHealth';

export const metadata: Metadata = { title: 'Home health · HomeStretch' };

export default function Page() {
  return (
    <KeepFrame>
      <HomeHealth />
    </KeepFrame>
  );
}
