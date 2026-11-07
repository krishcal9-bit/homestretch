import { Suspense } from 'react';
import { EarlyWarning } from '@/components/staff/EarlyWarning';
import { homeownerRows } from '@/lib/earlyWarning';

export default function EarlyWarningPage() {
  const today = new Date();
  return (
    <Suspense>
      <EarlyWarning rows={homeownerRows(today)} today={today.toISOString()} />
    </Suspense>
  );
}
