import { test, expect, type Page } from '@playwright/test';
import { freshStart } from './helpers';

/**
 * The intake's voice input ("Say your answers"). Browsers' speech services can't run in CI, so each test
 * installs a fake SpeechRecognition that behaves like a real one in a given way.
 */
type Mode = 'speak' | 'interim-only' | 'network' | 'not-allowed' | 'silent' | 'never-starts';
async function fakeRecognizer(page: Page, mode: Mode) {
  await page.addInitScript((m: Mode) => {
    class FakeRec {
      lang = 'en-US';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      private live = false;
      private said = { text: '', final: false };
      start() {
        if (m === 'never-starts') return;
        this.live = true;
        setTimeout(() => {
          if (m === 'network' || m === 'not-allowed') {
            this.onerror?.({ error: m });
            this.live = false;
            this.onend?.();
            return;
          }
          this.onstart?.();
          if (m === 'silent') {
            setTimeout(() => {
              this.onerror?.({ error: 'no-speech' });
              this.live = false;
              this.onend?.();
            }, 300);
            return;
          }
          // speech arrives as interim words, then (unless interim-only) a final result
          const words = 'We are four and we live in Santa Ana'.split(' ');
          words.forEach((_, i) =>
            setTimeout(() => {
              if (!this.live) return;
              this.said = { text: words.slice(0, i + 1).join(' '), final: false };
              this.emit();
            }, 60 * (i + 1)),
          );
        }, 50);
      }
      private emit() {
        const r = Object.assign([{ transcript: this.said.text }], { isFinal: this.said.final });
        this.onresult?.({ results: [r] });
      }
      stop() {
        if (!this.live) return;
        this.live = false;
        setTimeout(() => {
          if (m === 'speak') {
            this.said.final = true;
            this.emit();
          }
          this.onend?.();
        }, 30);
      }
      abort() {
        this.live = false;
        setTimeout(() => this.onend?.(), 10);
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec;
  }, mode);
}

test('speaking fills the household answers', async ({ page }) => {
  await fakeRecognizer(page, 'speak');
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-text')).toHaveValue(/Santa Ana/);
  await page.getByTestId('voice-done').click();
  await expect(page.getByTestId('voice-msg')).toContainText('Filled in');
});

test('what was heard is used even when the browser never marks it final', async ({ page }) => {
  await fakeRecognizer(page, 'interim-only');
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-text')).toHaveValue(/Santa Ana/);
  await page.getByTestId('voice-done').click();
  await expect(page.getByTestId('voice-msg')).toContainText('Filled in');
});

test('a browser without a speech service falls back to typing and hides the mic', async ({ page }) => {
  await fakeRecognizer(page, 'network');
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-msg')).toContainText("isn't available");
  await expect(page.getByTestId('mic')).toHaveCount(0);
  await expect(page.getByTestId('voice-text')).toBeFocused();
  // typing still works
  await page.getByTestId('voice-text').fill('We are four and we live in Santa Ana');
  await page.getByTestId('voice-fill').click();
  await expect(page.getByTestId('voice-msg')).toContainText('Filled in');
});

test('a recognizer that never starts is treated as unavailable', async ({ page }) => {
  await fakeRecognizer(page, 'never-starts');
  await page.context().grantPermissions(['microphone']);
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-msg')).toContainText("isn't available", { timeout: 9000 });
});

test('a blocked microphone and silence each say what to do', async ({ page }) => {
  await fakeRecognizer(page, 'not-allowed');
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-msg')).toContainText('microphone is blocked');
  await expect(page.getByTestId('mic')).toHaveCount(1);
});

test('nothing heard asks to try again', async ({ page }) => {
  await fakeRecognizer(page, 'silent');
  await freshStart(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('voice-msg')).toContainText("didn't hear anything");
});
