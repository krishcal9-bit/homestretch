import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, apiError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { newCode } from '@/lib/code';
import { LangSchema, ProfileSchema } from '@/lib/schemas';
import { PlanOutputSchema } from '@/lib/plan';

const Body = z.object({
  profile: ProfileSchema,
  lang: LangSchema,
  plan: PlanOutputSchema.nullable().optional(),
  checklist: z.record(z.string(), z.boolean()).optional(),
  code: z.string().optional(),
});

/** Save (or update, when the family already has a code) a plan. Private by default. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { profile, lang, plan, checklist, code } = parsed.data;
  const data = {
    language: lang,
    profileJson: JSON.stringify(profile),
    planJson: plan ? JSON.stringify(plan) : null,
    checklistJson: JSON.stringify(checklist ?? {}),
    lastActivity: new Date(),
  };
  try {
    if (code) {
      const existing = await prisma.plan.findUnique({ where: { code } });
      if (existing) {
        await prisma.plan.update({ where: { code }, data });
        return NextResponse.json({ code });
      }
    }
    for (let i = 0; i < 5; i++) {
      const c = newCode();
      try {
        await prisma.plan.create({ data: { ...data, code: c } });
        return NextResponse.json({ code: c });
      } catch {}
    }
    return apiError('code_collision', 'Could not create a plan code. Try again.', 500);
  } catch {
    return apiError('db_unavailable', 'We could not save your plan right now. Try again in a minute.', 503);
  }
}
