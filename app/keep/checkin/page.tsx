import type { Metadata } from 'next';
import { KeepFrame } from '@/components/keep/KeepFrame';
import { CheckinChat } from '@/components/keep/CheckinChat';

export const metadata: Metadata = { title: 'Monthly check-in · Keystone' };

export default function Page() {
  return (
    <KeepFrame bare>
      <CheckinChat />
    </KeepFrame>
  );
}
