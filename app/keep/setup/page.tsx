'use client';
import { KeepSetup } from '@/components/keep/KeepSetup';
import { useHydrated } from '@/components/keep/useHydrated';

/** /keep/setup: set up (or edit) the home the forecast is built on. */
export default function KeepSetupPage() {
  const hydrated = useHydrated();
  return <main id="main">{hydrated ? <KeepSetup /> : <div className="min-h-[70vh]" aria-busy />}</main>;
}
