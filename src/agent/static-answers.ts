/**
 * Static, deterministic answers — the 429/cost killer.
 *
 * Deadlines, slab rates, GST thresholds, late fees never change between two
 * messages, so they are answered from the ruleset with ZERO AI calls. Only
 * genuinely conversational queries reach Gemini (see router.ts).
 */
import { FY_2025_26 } from "../engine/tax-rules/2025-26.ts";

const r = FY_2025_26;

export const STATIC_ANSWERS: Record<string, string> = {
  gst_due_dates:
    "GST due dates: GSTR-1 by the 11th, GSTR-3B by the 20th (monthly) of the next month. " +
    "QRMP filers: GSTR-3B on 22nd–24th quarterly.",
  gst_threshold:
    `GST registration thresholds (FY${r.financialYear}): services ₹20L ` +
    "(₹10L lower-threshold states); goods ₹40L.",
  advance_tax_dates:
    "Advance tax: 15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%). " +
    "Presumptive (44ADA/44AD) filers may pay 100% by 15 March. Only if tax payable ≥ ₹10,000.",
  itr_deadlines:
    `ITR deadlines (FY${r.financialYear}): ITR-1/2 (salaried) 31 Jul 2026; ` +
    "ITR-3/4 (business/presumptive, no audit) 31 Aug 2026; with audit 31 Oct 2026.",
  new_regime_slabs:
    "New-regime slabs FY2025-26: 0–4L 0% · 4–8L 5% · 8–12L 10% · 12–16L 15% · " +
    "16–20L 20% · 20–24L 25% · above 24L 30%. §87A rebate → ₹0 tax up to ₹12L taxable.",
  lut_renewal:
    "Export of services is 0% IGST only with a valid LUT (Form RFD-11). It expires every " +
    "31 March — renew before 1 April or exports attract 18% IGST.",
};

/** Keyword → static-answer key. Cheap intent match before any AI. */
const STATIC_PATTERNS: { key: keyof typeof STATIC_ANSWERS | string; rx: RegExp }[] = [
  { key: "gst_due_dates", rx: /\b(gstr|gst return|3b|gstr-?1)\b.*\b(due|date|when|file)\b|\bwhen.*gst.*(due|file)\b/i },
  { key: "gst_threshold", rx: /\b(gst).*(threshold|register|registration|limit|need)\b|\bdo i need gst\b/i },
  { key: "advance_tax_dates", rx: /\badvance tax\b.*\b(date|when|due|schedule)\b|\bwhen.*advance tax\b/i },
  { key: "itr_deadlines", rx: /\b(itr|income tax return)\b.*\b(deadline|date|when|due|last)\b/i },
  { key: "new_regime_slabs", rx: /\b(slab|tax rate|new regime|rates)\b/i },
  { key: "lut_renewal", rx: /\b(lut|export).*\b(gst|igst|renew|expire)\b/i },
];

export function matchStaticAnswer(text: string): string | null {
  for (const { key, rx } of STATIC_PATTERNS) {
    if (rx.test(text)) return STATIC_ANSWERS[key] ?? null;
  }
  return null;
}
