// One-time Turso setup: creates the tables from prisma/schema.prisma and seeds demo data.
// Usage: TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run turso:setup   (add --reset to drop and recreate)
import { execSync } from 'child_process';
import { createClient } from '@libsql/client';

(async () => {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.');
    process.exit(1);
  }
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.argv.includes('--reset')) {
    for (const t of ['Plan', 'Home', 'PlanCache']) await db.execute(`DROP TABLE IF EXISTS "${t}"`);
  }
  const existing = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Plan','Home','PlanCache')`);
  if (existing.rows.length === 0) {
    const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', { encoding: 'utf8' });
    const statements = sql.split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean);
    for (const s of statements) await db.execute(s);
    console.log(`Created ${statements.length} schema statements on Turso.`);
  } else {
    console.log('Tables already exist; keeping them (use --reset to recreate).');
  }
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
})();
