import type { Metadata } from 'next';
import { KeepFrame } from '@/components/keep/KeepFrame';
import { ReliefFinder } from '@/components/keep/ReliefFinder';

export const metadata: Metadata = { title: 'Relief · HomeStretch' };

export default function Page() {
  return (
    <KeepFrame>
      <ReliefFinder />
    </KeepFrame>
  );
}
