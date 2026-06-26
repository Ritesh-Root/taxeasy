/**
 * TaxEasy deterministic tax engine — public API.
 *
 * GOLDEN RULE: this engine does ALL tax math. The AI layer never computes a
 * number — it only parses, categorizes, explains, and drafts. That is what makes
 * a hallucinated tax figure structurally impossible.
 */
export * from "./types.ts";
export { FY_2025_26 } from "./tax-rules/2025-26.ts";
export type { TaxRuleSet, Slab } from "./tax-rules/2025-26.ts";
export { incomeTax, slabTax } from "./income-tax.ts";
export { detectScheme, presumptiveIncome } from "./presumptive.ts";
export { gstOnInvoice, gstRegistrationRequired } from "./gst.ts";
export { itcStatus } from "./itc.ts";
export { advanceTaxDue } from "./advance-tax.ts";

import type { Regime, IncomeType, PresumptiveResult, IncomeTaxResult } from "./types.ts";
import type { TaxRuleSet } from "./tax-rules/2025-26.ts";
import { FY_2025_26 } from "./tax-rules/2025-26.ts";
import { incomeTax } from "./income-tax.ts";
import { detectScheme, presumptiveIncome } from "./presumptive.ts";

export interface EstimateInput {
  /** Free-text profession/business description — used to auto-detect the scheme. */
  profession: string;
  /** Gross receipts / turnover for the year. */
  grossReceipts: number;
  incomeType: IncomeType;
  /** ≥95% digital receipts → lower 44AD rate / higher turnover limit. */
  mostlyDigital?: boolean;
  regime?: Regime;
}

export interface TaxEstimate {
  readonly presumptive: PresumptiveResult;
  readonly tax: IncomeTaxResult;
  readonly auditWarning: string | null;
}

/**
 * End-to-end estimate: gross → detect scheme → presumptive net income → income
 * tax with the §87A rebate assessed on that NET figure (the TAX-04 fix).
 *
 * Standard deduction is salaried-only, so a presumptive professional/business
 * gets ₹0 standard deduction here (TAX-13) — the presumptive income IS the net.
 */
export function estimateTax(
  input: EstimateInput,
  rules: TaxRuleSet = FY_2025_26,
): TaxEstimate {
  const { profession, grossReceipts, mostlyDigital = true, regime = "new" } = input;

  const scheme = detectScheme(profession);
  const presumptive = presumptiveIncome(grossReceipts, scheme, mostlyDigital, rules);
  const tax = incomeTax(presumptive.presumptiveIncome, regime, rules);

  const auditWarning = !presumptive.withinLimit
    ? `Turnover ₹${grossReceipts.toLocaleString("en-IN")} exceeds the ${scheme} presumptive limit of ₹${presumptive.limit.toLocaleString("en-IN")} — presumptive scheme unavailable; books + audit likely required.`
    : null;

  return { presumptive, tax, auditWarning };
}
