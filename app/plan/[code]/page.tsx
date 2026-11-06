import { FamilyHeader } from '@/components/FamilyHeader';
import { PlanView, PlanNotFound } from '@/components/plan/PlanView';
import { prisma } from '@/lib/db';
import type { Profile } from '@/lib/types';
import type { PlanOutput } from '@/lib/plan';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } }).catch(() => null);
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
