import { Suspense } from 'react';
import { Pipeline } from '@/components/staff/Pipeline';
import { loadFamilies } from '@/lib/staffData';

export default async function PipelinePage() {
  const families = await loadFamilies();
  return (
    <Suspense>
      <Pipeline families={families} />
    </Suspense>
  );
}
