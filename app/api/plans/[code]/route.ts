import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, apiError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { PlanOutputSchema } from '@/lib/plan';

type Ctx = { params: Promise<{ code: string }> };

const Put = z.object({ plan: PlanOutputSchema, lang: z.enum(['en', 'es']) });

/** Store a plan generated on first view, only if none is stored yet (keeps checklist indices stable). */
export async function PUT(req: Request, { params }: Ctx) {
  const { code } = await params;
  const parsed = await parseBody(req, Put);
  if ('error' in parsed) return parsed.error;
  try {
    const res = await prisma.plan.updateMany({ where: { code: code.toUpperCase(), planJson: null }, data: { planJson: JSON.stringify(parsed.data.plan), language: parsed.data.lang } });
    const row = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } });
    if (!row) return apiError('not_found', "We couldn't find that plan.", 404);
    return NextResponse.json({ stored: res.count === 1, plan: row.planJson ? JSON.parse(row.planJson) : parsed.data.plan });
  } catch {
    return apiError('db_unavailable', 'We could not save that right now.', 503);
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const plan = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } }).catch(() => null);
  if (!plan) return apiError('not_found', "We couldn't find that plan.", 404);
  return NextResponse.json({ code: plan.code, language: plan.language, profile: JSON.parse(plan.profileJson), plan: plan.planJson ? JSON.parse(plan.planJson) : null, checklist: JSON.parse(plan.checklistJson) });
}

const Patch = z.object({ index: z.string().max(4), done: z.boolean() });

/** Tick/untick one checklist item. Merges into the stored map; last write per item wins. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const parsed = await parseBody(req, Patch);
  if ('error' in parsed) return parsed.error;
  try {
    // Compare-and-swap on updatedAt so two tabs ticking different items never lose one.
    for (let attempt = 0; attempt < 6; attempt++) {
      const plan = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } });
      if (!plan) return apiError('not_found', "We couldn't find that plan.", 404);
      const checklist = { ...(JSON.parse(plan.checklistJson) as Record<string, boolean>), [parsed.data.index]: parsed.data.done };
      const res = await prisma.plan.updateMany({ where: { id: plan.id, updatedAt: plan.updatedAt }, data: { checklistJson: JSON.stringify(checklist), lastActivity: new Date() } });
      if (res.count === 1) return NextResponse.json({ checklist });
    }
    return apiError('conflict', 'Someone else is editing this plan. Try again.', 409);
  } catch {
    return apiError('db_unavailable', 'We could not save that right now.', 503);
  }
}
