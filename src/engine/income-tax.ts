/**
 * Income tax on NET taxable income (new & old regime, FY2025-26).
 *
 * CRITICAL (TAX-04): the §87A rebate is assessed on NET taxable income. For a
 * presumptive filer that net figure IS the §44ADA/§44AD presumptive income
 * (e.g. 50% of gross), NOT gross receipts. Testing the rebate against gross
 * over-taxes the user — the #1 trust-killer this product exists to avoid.
 * Therefore callers must pass already-net taxable income here.
 */
import type { Regime, IncomeTaxResult } from "./types.ts";
import type { Slab, TaxRuleSet } from "./tax-rules/2025-26.ts";
import { FY_2025_26 } from "./tax-rules/2025-26.ts";

/** Marginal slab tax over a band-based schedule. */
export function slabTax(taxable: number, slabs: readonly Slab[]): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of slabs) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upTo) - lower) * rate;
    lower = upTo;
  }
  return Math.round(tax);
}

export function incomeTax(
  taxableIncome: number,
  regime: Regime = "new",
  rules: TaxRuleSet = FY_2025_26,
): IncomeTaxResult {
  const taxable = Math.max(0, Math.round(taxableIncome));
  const cfg = regime === "new" ? rules.newRegime : rules.oldRegime;

  const taxBeforeRebate = slabTax(taxable, cfg.slabs);
  let taxBeforeCess = taxBeforeRebate;

  if (taxable <= cfg.rebateIncomeLimit) {
    // Full §87A rebate — zero tax up to the limit.
    taxBeforeCess = 0;
  } else if (regime === "new") {
    // Marginal relief just above ₹12L: tax can't exceed income over the limit.
    taxBeforeCess = Math.min(taxBeforeCess, taxable - cfg.rebateIncomeLimit);
  }

  const rebateApplied = taxBeforeRebate - taxBeforeCess;
  const cess = Math.round(taxBeforeCess * rules.cess);

  return {
    rulesetVersion: rules.version,
    regime,
    taxableIncome: taxable,
    taxBeforeRebate,
    rebateApplied,
    taxBeforeCess,
    cess,
    total: taxBeforeCess + cess,
  };
}
