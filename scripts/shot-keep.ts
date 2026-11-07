// Keep screens in both themes at 1440×900 and 390×844 → docs/screenshots/keep/<screen>-<theme>-<vp>.png
// Usage: npx tsx scripts/shot-keep.ts [base=http://localhost:3161] [screens=setup,forecast,shield,doc] [themes=light,dark] [vps=desktop,mobile] [lang=en]
import { chromium, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3161');
const only = arg('screens', 'setup,forecast,shield,doc').split(',');
const themes = arg('themes', 'light,dark').split(',');
const vps = arg('vps', 'desktop,mobile').split(',');
const lang = arg('lang', 'en');
const OUT = arg('out', 'docs/screenshots/keep');
const SIZES: Record<string, { width: number; height: number }> = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

async function settle(p: Page, ms = 1600) {
  await p.waitForTimeout(ms);
  await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(200);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const theme of themes) {
    for (const vp of vps) {
      const ctx = await b.newContext({ viewport: SIZES[vp], deviceScaleFactor: vp === 'mobile' ? 2 : 1 });
      await ctx.addCookies([{ name: 'hs_lang', value: lang, url: B }]);
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('hs.theme', t);
        } catch {}
      }, theme);
      const p = await ctx.newPage();
      const name = (s: string) => path.join(OUT, `${s}${lang === 'es' ? '-es' : ''}-${theme}-${vp}.png`);
      await p.goto(`${B}/keep`);
      await p.evaluate(() => localStorage.removeItem('hs.keep'));
      await p.reload();
      await p.getByTestId('keep-setup').waitFor();
      if (only.includes('setup')) {
        await settle(p, 600);
        await p.screenshot({ path: name('setup') });
      }
      if (only.includes('doc')) {
        await p.getByTestId('use-sample-notice').click();
        await p.getByTestId('doc-explain').waitFor({ timeout: 20_000 });
        await settle(p, 900);
        await p.screenshot({ path: name('setup-document'), fullPage: true });
      }
      await p.getByTestId('keep-try-sample').click();
      await p.getByTestId('keep-forecast').waitFor();
      await settle(p, 2200);
      if (only.includes('forecast')) await p.screenshot({ path: name('forecast') });
      if (only.includes('shield')) {
        await p.getByTestId('shield-moves').waitFor({ timeout: 20_000 });
        await p.getByTestId('shock-shield').scrollIntoViewIfNeeded();
        await settle(p, 900);
        await p.screenshot({ path: name('shield-full'), fullPage: true });
        await p.getByTestId('shock-shield').screenshot({ path: name('shield') });
        await p.getByTestId('apply-recommended').click();
        await p.evaluate(() => window.scrollTo({ top: 0 }));
        await settle(p, 1800);
        await p.screenshot({ path: name('forecast-flattened') });
      }
      await ctx.close();
    }
  }
  await b.close();
})();
