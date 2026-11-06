'use client';
import { useMemo } from 'react';
import { computeReadiness } from '@/lib/engine';
import { draftToProfile, type Draft } from '@/lib/draft';

export function ResultScreen({ draft }: { draft: Draft; setDraft: (d: Draft | ((p: Draft) => Draft)) => void; onEdit: () => void }) {
  const result = useMemo(() => computeReadiness(draftToProfile(draft)), [draft]);
  return (
    <section className="pt-4">
      <h1 data-screen-title tabIndex={-1} className="t-display text-brass">{result.readyDate}</h1>
    </section>
  );
}
