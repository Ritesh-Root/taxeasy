/**
 * Advance-tax schedule.
 *
 * Threshold: only if tax payable ≥ ₹10,000. §44ADA/§44AD presumptive filers may
 * pay 100% in a single 15-March instalment (TAX-07); everyone else follows the
 * 15%/45%/75%/100% calendar. Shortfall (<90%) → §234B/§234C interest ≈ 1%/mo.
 */
import type { AdvanceTaxResult } from "./types.ts";
import type { TaxRuleSet } from "./tax-rules/2025-26.ts";
import { FY_2025_26 } from "./tax-rules/2025-26.ts";

export function advanceTaxDue(
  totalTax: number,
  isPresumptive: boolean,
  rules: TaxRuleSet = FY_2025_26,
): AdvanceTaxResult {
  if (totalTax < rules.advanceTaxThreshold) {
    return {
      required: false,
      schedule: [],
      note: "No advance tax (liability under ₹10,000).",
    };
  }

  if (isPresumptive) {
    return {
      required: true,
      schedule: [{ dueDate: "15 Mar", cumulativeAmount: totalTax }],
      note: "44ADA/44AD: pay 100% by 15 March.",
    };
  }

  return {
    required: true,
    schedule: [
      { dueDate: "15 Jun", cumulativeAmount: Math.round(totalTax * 0.15) },
      { dueDate: "15 Sep", cumulativeAmount: Math.round(totalTax * 0.45) },
      { dueDate: "15 Dec", cumulativeAmount: Math.round(totalTax * 0.75) },
      { dueDate: "15 Mar", cumulativeAmount: totalTax },
    ],
    note: "Pay per the 15%/45%/75%/100% calendar; shortfall below 90% triggers §234B/§234C interest.",
  };
}
