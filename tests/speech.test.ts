import { describe, expect, it } from 'vitest';
import { parseSpeechRules, wordsToDigits } from '@/lib/speech';

describe('speech rules parser', () => {
  it('converts Spanish and English number words', () => {
    expect(wordsToDigits('cinco mil doscientos')).toBe('5200');
    expect(wordsToDigits('dos mil trescientos cincuenta')).toBe('2350');
    expect(wordsToDigits('two thousand four hundred')).toBe('2400');
    expect(wordsToDigits('$2,400 a month')).toBe('2400 a month');
  });
  it('parses the demo sentence', () => {
    const f = parseSpeechRules('somos cuatro, vivimos en Santa Ana, gano como cinco mil doscientos al mes, pagamos dos mil trescientos cincuenta de renta');
    expect(f).toMatchObject({ householdSize: 4, inOC: true, grossMonthlyIncome: 5200, rent: 2350 });
  });
  it('parses English', () => {
    const f = parseSpeechRules("we're a family of five in Anaheim, I make 4,800 a month and rent is 2100");
    expect(f).toMatchObject({ householdSize: 5, inOC: true, grossMonthlyIncome: 4800, rent: 2100 });
  });
});
