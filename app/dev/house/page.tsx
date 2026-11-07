import { notFound } from 'next/navigation';
import { DevHouse } from '@/components/three/DevHouse';

/**
 * Development only (404 in production): the 3D house alone in a fixed box, for calibrating framings and
 * rendering stills (scripts/render-house.ts). ?variant=0-3 &night=1 &ground=0 &frame=street &w=600
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  return <DevHouse variant={Number(q.variant ?? 0)} night={Number(q.night ?? 0)} ground={Number(q.ground ?? 1)} frame={q.frame === 'street' ? 'street' : 'slot'} width={Number(q.w ?? 600)} lit={Number(q.lit ?? 1)} />;
}
