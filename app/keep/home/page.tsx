import type { Metadata } from 'next';
import { KeepFrame } from '@/components/keep/KeepFrame';
import { HomeHealth } from '@/components/keep/HomeHealth';

export const metadata: Metadata = { title: 'Home health · Keystone' };

export default function Page() {
  return (
    <KeepFrame bare>
      <HomeHealth />
    </KeepFrame>
  );
}
