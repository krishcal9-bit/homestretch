import { Suspense } from 'react';
import { Match } from '@/components/staff/Match';
import { loadFamilies, loadHomes } from '@/lib/staffData';

export default async function MatchPage() {
  const [homes, families] = await Promise.all([loadHomes(), loadFamilies()]);
  return (
    <Suspense>
      <Match homes={homes} families={families} />
    </Suspense>
  );
}
