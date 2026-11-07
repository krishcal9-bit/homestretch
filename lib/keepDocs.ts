// KEEP: turn what /api/extract/document read into profile fields, and the facts /api/explain may cite.
import { forecast } from './forecast';
import type { KeepProfile } from './keep';
import type { DocumentExtract } from './keepSchemas';
import type { ExplainFacts } from './shield';

const pos = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const monthOf = (date: string | null) => {
  const m = date?.match(/^\d{4}-(\d{2})/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
};

/** Profile fields a document fills in (only what was read; nothing is guessed). */
export function docToPatch(d: DocumentExtract): Partial<KeepProfile> {
  const p: Partial<KeepProfile> = {};
  if (d.documentType === 'insurance_renewal' || d.documentType === 'insurance_declarations') {
    if (d.insurer) p.insurer = d.insurer.replace(/\s+Association$/i, '');
    if (d.fairPlan !== null) p.fairPlan = d.fairPlan;
    else if (d.insurer && /fair plan/i.test(d.insurer)) p.fairPlan = true;
    const cur = pos(d.currentPremium) ? d.currentPremium : null;
    const next = pos(d.renewalPremium) ? d.renewalPremium : null;
    if (cur) p.premium = Math.round(cur);
    else if (next) p.premium = Math.round(next);
    // the notice states the renewal premium: the forecast uses that exact increase instead of a projection
    if (cur && next) p.insuranceIncrease = Math.round((next / cur - 1) * 10000) / 10000;
    const m = monthOf(d.effectiveDate);
    if (m) p.renewalMonth = m;
  }
  if (d.documentType === 'escrow_analysis') {
    if (pos(d.currentEscrow)) p.escrow = Math.round(d.currentEscrow);
    else if (pos(d.newEscrow)) p.escrow = Math.round(d.newEscrow);
    if (pos(d.mortgagePrincipal)) p.mortgage = Math.round(d.mortgagePrincipal);
  }
  if (pos(d.propertyTaxAnnual)) p.propertyTax = Math.round(d.propertyTaxAnnual);
  if (d.documentType === 'hoa_notice') {
    if (pos(d.hoaCurrent)) p.hoa = Math.round(d.hoaCurrent);
    else if (pos(d.hoaNew)) p.hoa = Math.round(d.hoaNew);
    if (pos(d.hoaCurrent) && pos(d.hoaNew) && d.hoaNew > d.hoaCurrent) p.hoaGrowth = Math.round((d.hoaNew / d.hoaCurrent - 1) * 1000) / 1000;
  }
  return p;
}

/** The facts an explanation of this document may use: the document's own numbers plus the engine's rise. */
export function docFacts(d: DocumentExtract, profile: KeepProfile, start?: string): ExplainFacts | null {
  const f = forecast(profile, { start, setAside: 0 });
  const rise = (cause: string) => f.shocks.find((s) => s.cause === cause) ?? null;
  switch (d.documentType) {
    case 'insurance_renewal':
    case 'insurance_declarations': {
      const s = rise('insurance');
      const facts: ExplainFacts = { documentType: 'insurance' };
      if (pos(d.currentPremium)) facts.premiumOld = Math.round(d.currentPremium);
      if (pos(d.renewalPremium)) facts.premiumNew = Math.round(d.renewalPremium);
      if (s) {
        facts.monthlyChange = s.delta;
        facts.month = s.month;
      } else {
        const m = d.effectiveDate?.match(/^(\d{4})-(\d{2})/);
        if (m) facts.month = `${m[1]}-${m[2]}`;
      }
      return facts;
    }
    case 'escrow_analysis':
      return { documentType: 'escrow', ...(pos(d.currentEscrow) ? { escrowOld: Math.round(d.currentEscrow) } : {}), ...(pos(d.newEscrow) ? { escrowNew: Math.round(d.newEscrow) } : {}) };
    case 'property_tax':
      return pos(d.propertyTaxAnnual) ? { documentType: 'tax', propertyTax: Math.round(d.propertyTaxAnnual) } : null;
    case 'hoa_notice':
      return { documentType: 'hoa', ...(pos(d.hoaCurrent) ? { hoaOld: Math.round(d.hoaCurrent) } : {}), ...(pos(d.hoaNew) ? { hoaNew: Math.round(d.hoaNew) } : {}) };
    default:
      return null;
  }
}
