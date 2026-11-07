// Round 6: every page in both themes at 1440×900 and 390×844 → docs/screenshots/r6-theme-<page>-<theme>-<vp>.png
// Usage: npx tsx --env-file=.env scripts/shot-theme.ts [base=http://localhost:3152] [pages=comma,list] [themes=light,dark] [vps=desktop,mobile]
// Pages: landing, closing, step1–step4, result, letter, plan, plan-404, not-found, login, pipeline, drawer, homes, match, insights, checkin.
import { chromium, type Page } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3152');
const only = arg('pages', '').split(',').filter(Boolean);
const themes = arg('themes', 'light,dark').split(',') as ('light' | 'dark')[];
const vps = arg('vps', 'desktop,mobile').split(',');
const OUT = arg('out', 'docs/screenshots');
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));
const SIZES: Record<string, { width: number; height: number }> = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const want = (p: string) => only.length === 0 || only.includes(p);

async function settle(p: Page, ms = 1400) {
  await p.waitForTimeout(ms);
  await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(300);
}

(async () => {
  const b = await chromium.launch();
  for (const theme of themes) {
    for (const vp of vps) {
      const ctx = await b.newContext({ viewport: SIZES[vp], colorScheme: theme === 'dark' ? 'light' : 'dark' }); // stored choice must win over the system setting
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('hs.theme', t);
          sessionStorage.setItem('hs.nointro', '1');
          localStorage.setItem('hs.dragged', '1');
        } catch {}
      }, theme);
      const p = await ctx.newPage();
      const shot = async (name: string, full = true) => {
        const file = path.join(OUT, `r6-theme-${name}-${theme}-${vp}.png`);
        if (full) {
          // walk down the page so everything that waits to be scrolled into view has arrived, then back up
          const h = await p.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < h; y += 500) {
            await p.evaluate((yy) => window.scrollTo(0, yy), y);
            await p.waitForTimeout(250);
          }
          await p.waitForTimeout(1200);
          await p.evaluate(() => window.scrollTo(0, 0));
          await p.waitForTimeout(400);
        }
        await p.screenshot({ path: file, fullPage: full });
        console.log(file);
      };
      const family = async (step: number) => {
        await p.evaluate(([d, s]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(s)); }, [draft, step] as const);
        await p.goto(B + '/start');
      };
      if (want('landing') || want('closing')) {
        await p.goto(B + '/?nointro');
        await settle(p, 2500);
        if (want('landing')) await shot('landing', false);
        if (want('closing')) {
          await p.evaluate(() => document.getElementById('closing')?.scrollIntoView());
          await settle(p, 3500);
          await shot('closing', false);
        }
      }
      if ([1, 2, 3, 4, 5].some((s) => want(s === 5 ? 'result' : `step${s}`))) {
        await p.goto(B + '/start');
        for (const s of [1, 2, 3, 4, 5]) {
          const name = s === 5 ? 'result' : `step${s}`;
          if (!want(name)) continue;
          await family(s);
          await settle(p, s === 5 ? 3500 : 1600);
          await shot(name);
        }
      }
      if (want('letter')) {
        await p.goto(B + '/start');
        await p.evaluate(() => { localStorage.removeItem('hs.draft'); localStorage.removeItem('hs.step'); document.cookie = 'hs_lang=en; path=/'; });
        await p.goto(B + '/start');
        await p.getByTestId('find-my-date').click().catch(() => {});
        for (let i = 0; i < 3; i++) {
          if (i === 1) await p.fill('#gross', '5200');
          if (i === 2) await p.fill('#rent', '2350');
          await p.waitForFunction(() => document.querySelectorAll('form button[type=submit]').length === 1);
          await p.locator('form button[type=submit]').click();
          await p.waitForTimeout(400);
        }
        await p.locator('#file-statement').setInputFiles('fixtures/bank-statement.png');
        await p.getByTestId('upload-statement-done').waitFor({ timeout: 30_000 });
        await p.fill('#savings', '3100');
        await p.getByRole('radio', { name: 'Building' }).click();
        await p.locator('form button[type=submit]').click();
        const ue = p.getByTestId('underwriters-eye');
        await ue.waitFor({ timeout: 30_000 });
        await ue.getByTestId('write-letter').first().click();
        await p.waitForFunction(() => /Sincerely/.test((document.querySelector('[data-testid=letter-text]') as HTMLTextAreaElement | null)?.value ?? ''), null, { timeout: 30_000 });
        await settle(p, 9000); // the pen writes the letter line by line, then signs
        await ue.scrollIntoViewIfNeeded();
        await shot('letter', false);
      }
      if (want('plan')) { await p.goto(B + '/plan/NGU7P3'); await settle(p, 3000); await shot('plan'); }
      if (want('plan-404')) { await p.goto(B + '/plan/notarealcode'); await settle(p); await shot('plan-404'); }
      if (want('not-found')) { await p.goto(B + '/no-such-page'); await settle(p); await shot('not-found'); }
      const staff = ['login', 'pipeline', 'drawer', 'homes', 'match', 'insights', 'checkin'].filter(want);
      if (staff.length && vp === 'desktop') {
        // sign in only once the page is idle (hydrated): typing earlier submits the bare form natively
        await p.goto('about:blank');
        await p.goto(B + '/staff/login', { waitUntil: 'networkidle' });
        await settle(p);
        if (want('login')) await shot('login');
        for (let attempt = 0; attempt < 2; attempt++) {
          await p.fill('input[type=password]', process.env.STAFF_PASSWORD ?? '');
          await p.keyboard.press('Enter');
          const ok = await p.waitForSelector('[data-testid=family-row]', { timeout: 90_000 }).then(() => true, () => false);
          if (ok) break;
          await p.goto(B + '/staff/login');
          await settle(p);
        }
        await settle(p);
        if (want('pipeline')) await shot('pipeline');
        if (want('drawer')) { await p.getByTestId('family-row').first().click(); await settle(p, 2500); await shot('drawer', false); await p.keyboard.press('Escape'); }
        for (const r of ['homes', 'match', 'insights'] as const) {
          if (!want(r)) continue;
          await p.goto(`${B}/staff/${r === 'match' ? 'match?home=h1' : r}`);
          await settle(p, 2500);
          await shot(r);
        }
        if (want('checkin')) {
          // a fresh seed, so this theme's check-in has the same week of changes to show as the other's
          execSync('npx tsx prisma/seed.ts', { stdio: 'ignore' });
          await p.goto(B + '/staff');
          await p.getByTestId('run-checkin').click();
          await p.waitForSelector('[data-testid=checkin-item]', { timeout: 60_000 });
          await settle(p, 2500);
          await shot('checkin', false);
        }
      } else if (staff.length && vp === 'mobile') {
        // the staff console is desktop-only (min-width 1024px); the sign-in page still gets a phone shot
        if (want('login')) { await p.goto(B + '/staff/login'); await settle(p); await shot('login'); }
      }
      await ctx.close();
    }
  }
  await b.close();
})();
