import { Suspense } from 'react';
import { Pipeline } from '@/components/staff/Pipeline';
import { loadFamilies, loadHomes } from '@/lib/staffData';

export default async function ReadyPipelinePage() {
  const [families, homes] = await Promise.all([loadFamilies(), loadHomes()]);
  return (
    <Suspense>
      <Pipeline families={families} homes={homes} />
    </Suspense>
  );
}
