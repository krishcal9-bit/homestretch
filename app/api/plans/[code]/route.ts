import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, apiError } from '@/lib/api';
import { prisma } from '@/lib/db';

type Ctx = { params: Promise<{ code: string }> };

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
    const plan = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } });
    if (!plan) return apiError('not_found', "We couldn't find that plan.", 404);
    const checklist = { ...(JSON.parse(plan.checklistJson) as Record<string, boolean>), [parsed.data.index]: parsed.data.done };
    await prisma.plan.update({ where: { code: plan.code }, data: { checklistJson: JSON.stringify(checklist), lastActivity: new Date() } });
    return NextResponse.json({ checklist });
  } catch {
    return apiError('db_unavailable', 'We could not save that right now.', 503);
  }
}
