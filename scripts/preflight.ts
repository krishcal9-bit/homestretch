// npm run preflight: reset + reseed, all checks, e2e with mocks, one real Claude call, then READY.
import { execSync } from 'child_process';
import { claudeJson } from '../lib/claude';
import { computeReadiness } from '../lib/engine';
import { fallbackPlan, PLAN_SYSTEM, PlanOutputSchema } from '../lib/plan';
import { SEED_FAMILIES } from '../lib/seedData';

const run = (cmd: string) => {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
};

(async () => {
  run('npx prisma db push --force-reset --skip-generate');
  run('npx tsx prisma/seed.ts');
  run('npm run check');
  run('npx playwright test');
  run('npx tsx prisma/seed.ts'); // e2e changes data (check-in snapshots, saved plans); start the demo clean
  console.log('\n▸ one real Claude call (/api/plan logic)');
  delete process.env.MOCK_CLAUDE;
  const f = SEED_FAMILIES[0];
  const r = computeReadiness(f.profile);
  const out = await claudeJson({ purpose: 'preflight plan', system: PLAN_SYSTEM, content: JSON.stringify({ profile: f.profile, engine: r }), schema: PlanOutputSchema, fallback: () => fallbackPlan(f.profile, r, 'en'), maxTokens: 4000 });
  if (out.source !== 'claude') {
    console.error('✗ Claude call fell back. Check APP_ANTHROPIC_API_KEY and network.');
    process.exit(1);
  }
  console.log(`  tokens: in ${out.tokens?.input} · out ${out.tokens?.output}`);
  console.log(`\nREADY  http://localhost:3000   staff password: ${process.env.STAFF_PASSWORD ?? '(set STAFF_PASSWORD)'}\n  start it with: npm run dev`);
})();
