import { prisma } from '@/lib/db';
import { claudeJson } from '@/lib/claude';
import { computeReadiness } from '@/lib/engine';
import { CHECKIN_SYSTEM, DigestSchema, diff, fallbackDigest, nextActionText, snapshotOf, type Snapshot } from '@/lib/checkin';
import { SEED_HOMES } from '@/lib/seedData';
import type { Home, Lang, Profile } from '@/lib/types';

export const maxDuration = 60;

/**
 * Streams NDJSON: {type:'start', total} then, per family, {type:'progress', done} and for families that
 * changed {type:'family', familyId, name, language, change, digest, nudge}; finally {type:'done', changed}.
 * Saves this week's snapshot so a second run reports no changes.
 */
export async function POST() {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const [plans, homesRaw] = await Promise.all([prisma.plan.findMany({ where: { sharedWithStaff: true }, orderBy: { surname: 'asc' } }), prisma.home.findMany()]);
        const homes: Home[] = homesRaw.length ? homesRaw : SEED_HOMES;
        send({ type: 'start', total: plans.length });
        let changed = 0;
        for (let i = 0; i < plans.length; i++) {
          const p = plans[i];
          const profile = JSON.parse(p.profileJson) as Profile;
          const checklist = JSON.parse(p.checklistJson) as Record<string, boolean>;
          const prev = p.checkinJson ? (JSON.parse(p.checkinJson) as Snapshot) : null;
          const cur = snapshotOf(profile, checklist, p.lastActivity, homes);
          const changes = diff(prev, cur, homes);
          if (changes.length) {
            changed++;
            const lang = (p.language === 'es' ? 'es' : 'en') as Lang;
            const name = p.surname ?? 'family';
            const r = computeReadiness(profile);
            const out = await claudeJson({
              purpose: `checkin/${p.code}`,
              system: CHECKIN_SYSTEM,
              content: JSON.stringify({ family: name, language: lang === 'es' ? 'Spanish' : 'English', changes: changes.map((c) => c.text), monthsToReady: r.monthsToReady, readyDate: r.readyDate, nextAction: nextActionText(profile, lang), topBlocker: r.blockers[0]?.text ?? null }),
              schema: DigestSchema,
              fallback: () => fallbackDigest(name, lang, changes, r.monthsToReady, nextActionText(profile, lang)),
              maxTokens: 500,
            });
            send({ type: 'family', familyId: p.code, name: `${p.givenName ?? ''} ${name}`.trim(), language: lang, change: changes, digest: out.data.digest, nudge: out.data.nudge });
          }
          await prisma.plan.update({ where: { id: p.id }, data: { checkinJson: JSON.stringify(cur) } });
          send({ type: 'progress', done: i + 1 });
        }
        send({ type: 'done', changed });
      } catch (e) {
        send({ type: 'error', error: { code: 'checkin_failed', message: (e as Error).message.slice(0, 200) } });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
