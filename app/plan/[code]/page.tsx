import { FamilyHeader } from '@/components/FamilyHeader';
import { PlanView, PlanNotFound } from '@/components/plan/PlanView';
import { prisma } from '@/lib/db';
import type { Profile } from '@/lib/types';
import { fallbackPlan, type PlanOutput } from '@/lib/plan';
import { computeReadiness } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let row = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } }).catch(() => null);
  // No stored plan yet (seeded families, or saved before the plan loaded): store the engine's rules-based
  // plan once so every tab and reload ticks the same items. Staff or the family can regenerate later.
  if (row && !row.planJson) {
    const profile = JSON.parse(row.profileJson) as Profile;
    const lang = row.language === 'es' ? 'es' : 'en';
    const plan = fallbackPlan(profile, computeReadiness(profile), lang);
    await prisma.plan.updateMany({ where: { id: row.id, planJson: null }, data: { planJson: JSON.stringify(plan) } }).catch(() => null);
    row = await prisma.plan.findUnique({ where: { id: row.id } }).catch(() => row);
  }
  return (
    <>
      <FamilyHeader />
      <main id="main" className="mx-auto max-w-[560px] px-5 pb-16">
        {row ? (
          <PlanView
            code={row.code}
            createdAt={row.createdAt.toISOString()}
            profile={JSON.parse(row.profileJson) as Profile}
            initialPlan={row.planJson ? (JSON.parse(row.planJson) as PlanOutput) : null}
            initialChecklist={JSON.parse(row.checklistJson) as Record<string, boolean>}
          />
        ) : (
          <PlanNotFound />
        )}
      </main>
    </>
  );
}
