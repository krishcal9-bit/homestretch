'use client';
import { useKeep } from '@/lib/keepStore';
import { KeepForecast } from '@/components/keep/KeepForecast';
import { KeepSetup } from '@/components/keep/KeepSetup';
import { useHydrated } from '@/components/keep/useHydrated';

/** /keep: the Payment Forecast once the home is set up; the 2-minute setup before that. */
export default function KeepPage() {
  const hydrated = useHydrated();
  const [state] = useKeep();
  return (
    <main id="main">
      {!hydrated ? <div className="min-h-[70vh]" aria-busy /> : state.ready ? <KeepForecast /> : <KeepSetup onDone={() => window.scrollTo({ top: 0 })} />}
    </main>
  );
}
