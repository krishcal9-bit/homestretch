// KEEP extras: Home health, Relief, Check-in and the Ready "first year of owning", in both themes at 390×844 and
// 1440×900 → docs/screenshots/keep/<page>-<theme>-<vp>.png (the sample Ramirez family, MOCK_CLAUDE=1 server).
// Usage: npx tsx scripts/shot-keep.ts [base=http://localhost:3182] [pages=home,relief,checkin,ready] [themes=light,dark] [vps=mobile,desktop] [out=docs/screenshots/keep]
import { chromium, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3182');
const pages = arg('pages', 'home,relief,checkin,ready').split(',');
const themes = arg('themes', 'light,dark').split(',');
const vps = arg('vps', 'mobile,desktop').split(',');
const OUT = arg('out', 'docs/screenshots/keep');
const lang = arg('lang', 'en');
const SIZES: Record<string, { width: number; height: number }> = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));

async function settle(p: Page, ms = 900) {
  await p.waitForTimeout(ms);
  await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 6000 }).catch(() => {});
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const theme of themes) {
    for (const vp of vps) {
      const ctx = await b.newContext({ viewport: SIZES[vp], deviceScaleFactor: vp === 'mobile' ? 2 : 1 });
      await ctx.addInitScript(([t, l]) => {
        try {
          localStorage.setItem('hs.theme', t);
          sessionStorage.setItem('hs.nointro', '1');
          localStorage.setItem('hs.dragged', '1');
          document.cookie = `hs_lang=${l}; path=/`;
        } catch {}
      }, [theme, lang]);
      const p = await ctx.newPage();
      const shot = async (name: string) => {
        const file = path.join(OUT, `${name}${lang === 'es' ? '-es' : ''}-${theme}-${vp}.png`);
        await p.evaluate(() => window.scrollTo(0, 0));
        await settle(p, 300);
        await p.screenshot({ path: file, fullPage: true });
        console.log(file);
      };
      const sample = async () => {
        await p.goto(B + '/keep/relief');
        await p.evaluate(() => localStorage.removeItem('hs.keep'));
        await p.reload();
        await p.getByTestId('use-sample-family').click();
      };
      if (pages.includes('home')) {
        await sample();
        await p.goto(B + '/keep/home');
        await p.getByTestId('use-sample-photo').click();
        await p.getByTestId('read-result').waitFor();
        await p.getByTestId('save-system').click();
        await p.getByTestId('leak-water-heater').click();
        await p.getByTestId('leak-steps').waitFor();
        await settle(p, 1500);
        await shot('home');
      }
      if (pages.includes('relief')) {
        await sample();
        await p.getByTestId('relief-list').waitFor();
        await p.locator('label[for=relief-exemption]').first().click();
        await settle(p, 1500);
        await shot('relief');
      }
      if (pages.includes('checkin')) {
        await sample();
        await p.goto(B + '/keep/checkin');
        const tap = async (name: string) => {
          await p.getByTestId('checkin-choices').getByRole('button', { name }).click();
        };
        await tap(lang === 'es' ? 'Sí, una cuenta subió' : 'Yes, a bill went up');
        await tap(lang === 'es' ? 'Prima del seguro' : 'Insurance premium');
        await p.locator('#checkin-amount').fill('1980');
        await p.getByTestId('checkin-send').click();
        await tap(lang === 'es' ? 'Sin cambio' : 'No change');
        await tap(lang === 'es' ? 'Calentador de agua' : 'Water heater');
        await p.getByTestId('checkin-saved').waitFor({ timeout: 20000 });
        await settle(p, 800);
        await shot('checkin');
      }
      if (pages.includes('ready')) {
        await p.goto(B + '/start');
        await p.evaluate((d) => {
          localStorage.setItem('hs.draft', JSON.stringify(d));
          localStorage.setItem('hs.step', '5');
          sessionStorage.setItem('hs.roadPlayed', '1');
        }, draft);
        await p.goto(B + '/start');
        await p.getByTestId('first-year').waitFor({ timeout: 30000 });
        await p.getByTestId('first-year').scrollIntoViewIfNeeded();
        await settle(p, 1200);
        const file = path.join(OUT, `ready-first-year${lang === 'es' ? '-es' : ''}-${theme}-${vp}.png`);
        await p.screenshot({ path: file });
        console.log(file);
      }
      await ctx.close();
    }
  }
  await b.close();
})();
