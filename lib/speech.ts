// Rules-based parser for spoken intake answers (fallback + mock for /api/parse-speech).
// Handles English and Spanish number words ("cinco mil doscientos" → 5200).
import type { CreditBand } from './types';

export type SpeechFields = Partial<{
  householdSize: number;
  inOC: boolean;
  residentOrCitizen: boolean;
  grossMonthlyIncome: number;
  otherMonthlyIncome: number;
  rent: number;
  bedrooms: number;
  occupants: number;
  unsafeConditions: boolean;
  savings: number;
  creditBand: CreditBand;
  carPayment: number;
  cardPayment: number;
  studentPayment: number;
  collectionBalance: number;
}>;

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const HUNDRED = new Set(['hundred']);
const THOUSAND = new Set(['thousand', 'mil', 'k']);
const FILLER = new Set(['and', 'y', 'a']);

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Replace runs of number words with digits: "cinco mil doscientos" → "5200". */
export function wordsToDigits(text: string): string {
  const tokens = strip(text).replace(/\$/g, ' ').replace(/(\d),(\d{3})/g, '$1$2').split(/(\s+|[.,;:!?])/);
  const out: string[] = [];
  let total = 0;
  let cur = 0;
  let inNum = false;
  let pendingFiller: string[] = [];
  const flush = () => {
    if (inNum) out.push(String(total + cur));
    total = 0;
    cur = 0;
    inNum = false;
  };
  for (const tok of tokens) {
    const w = tok.trim();
    if (!w) {
      if (!inNum) out.push(tok);
      continue;
    }
    const digits = /^\d+(\.\d+)?$/.test(w) ? Number(w) : null;
    if (digits !== null) {
      cur += digits;
      inNum = true;
      pendingFiller = [];
      continue;
    }
    if (w in UNITS) {
      cur += UNITS[w];
      inNum = true;
      pendingFiller = [];
      continue;
    }
    if (inNum && HUNDRED.has(w)) {
      cur = (cur || 1) * 100;
      continue;
    }
    if (THOUSAND.has(w) && (inNum || w === 'mil')) {
      total += (cur || 1) * 1000;
      cur = 0;
      inNum = true;
      continue;
    }
    if (inNum && FILLER.has(w)) {
      pendingFiller.push(w);
      continue;
    }
    flush();
    for (const f of pendingFiller) out.push(` ${f} `);
    pendingFiller = [];
    out.push(tok);
  }
  flush();
  return out.join('').replace(/\s+/g, ' ').trim();
}

const OC_CITIES = ['santa ana', 'anaheim', 'garden grove', 'costa mesa', 'westminster', 'irvine', 'orange', 'fullerton', 'huntington beach', 'tustin', 'buena park', 'fountain valley', 'stanton', 'la habra', 'placentia', 'mission viejo', 'lake forest', 'newport beach', 'cypress', 'brea', 'yorba linda', 'laguna', 'san clemente', 'midway city'];

/** Number right after (or within a few words of) a keyword. */
function near(text: string, keywords: RegExp, window = 6): number | undefined {
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (keywords.test(words[i])) {
      for (let j = Math.max(0, i - window); j <= Math.min(words.length - 1, i + window); j++) {
        const n = Number(words[j].replace(/[^\d.]/g, ''));
        if (words[j].match(/\d/) && Number.isFinite(n)) {
          // prefer numbers after the keyword, then before
          const after = words.slice(i + 1, i + 1 + window).find((w) => /\d/.test(w));
          if (after) return Number(after.replace(/[^\d.]/g, ''));
          return n;
        }
      }
    }
  }
  return undefined;
}

export function parseSpeechRules(transcript: string): SpeechFields {
  const t = wordsToDigits(transcript);
  const f: SpeechFields = {};
  const people = t.match(/\b(?:somos|we are|we're|family of|familia de|there are|hay)\s+(\d+)/) ?? t.match(/(\d+)\s+(?:people|personas|of us|en la familia|in my family|in the family)/);
  if (people) f.householdSize = Math.min(8, Math.max(1, Number(people[1])));
  if (OC_CITIES.some((c) => t.includes(c)) || /orange county|condado de orange/.test(t)) f.inOC = true;
  if (/\b(citizen|ciudadan|residente permanente|permanent resident|green card)/.test(t)) f.residentOrCitizen = !/\b(not|no soy|no somos)\b/.test(t);
  const income = near(t, /^(gano|ganamos|earn|make|making|income|ingreso|ganando|salary|sueldo|cobro)$/);
  if (income !== undefined) f.grossMonthlyIncome = /a la semana|per week|a week|weekly|semanal/.test(t) ? Math.round((income * 52) / 12) : /al ano|a year|per year|annual/.test(t) ? Math.round(income / 12) : income;
  const rent = near(t, /^(renta|rent|alquiler|pagamos|pago|pay)$/);
  if (rent !== undefined && rent !== f.grossMonthlyIncome) f.rent = rent;
  const beds = t.match(/(\d+)\s+(?:bedroom|bedrooms|recamaras?|cuartos?|habitaciones?|dormitorios?)/);
  if (beds) f.bedrooms = Number(beds[1]);
  const savings = near(t, /^(ahorros?|ahorrado|savings|saved|ahorramos)$/);
  if (savings !== undefined) f.savings = savings;
  const collection = near(t, /^(collections?|cobranzas?|cobro)$/);
  if (collection !== undefined) f.collectionBalance = collection;
  const car = near(t, /^(car|carro|auto|coche)$/, 4);
  if (car !== undefined) f.carPayment = car;
  if (/\b(mold|moho|unsafe|insegur|plagas|pests|cucarachas)/.test(t)) f.unsafeConditions = true;
  if (/(credit|credito)/.test(t)) {
    if (/(good|bueno|buen)/.test(t)) f.creditBand = 'good';
    else if (/(bad|malo|mal |needs work|necesita)/.test(t)) f.creditBand = 'needs_work';
    else if (/(building|construyendo|regular)/.test(t)) f.creditBand = 'building';
    else if (/(not sure|no se|don't know)/.test(t)) f.creditBand = 'unknown';
  }
  return f;
}
