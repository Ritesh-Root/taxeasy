/**
 * GST on an invoice + registration-threshold check.
 *
 * Export of services is zero-rated (0% IGST) ONLY with a valid LUT (Form RFD-11),
 * which expires every 31 March — no valid LUT means 18% IGST. (TAX-10)
 */
import type { GstResult } from "./types.ts";
import type { TaxRuleSet } from "./tax-rules/2025-26.ts";
import { FY_2025_26 } from "./tax-rules/2025-26.ts";

export interface GstInvoiceInput {
  amount: number;
  intraState: boolean;
  isExport?: boolean;
  hasLut?: boolean;
}

export function gstOnInvoice(
  input: GstInvoiceInput,
  rules: TaxRuleSet = FY_2025_26,
): GstResult {
  const { amount, intraState, isExport = false, hasLut = false } = input;
  const rate = rules.gst.rateServices;

  if (isExport) {
    if (hasLut) {
      return { type: "EXPORT_LUT", totalGst: 0, note: "Zero-rated (LUT active)." };
    }
    const igst = Math.round(amount * rate);
    return {
      type: "EXPORT_NO_LUT",
      igst,
      totalGst: igst,
      note: "18% IGST — file LUT (Form RFD-11) to make this 0%.",
    };
  }

  if (intraState) {
    const half = Math.round((amount * rate) / 2);
    return { type: "CGST+SGST", cgst: half, sgst: half, totalGst: 2 * half };
  }

  const igst = Math.round(amount * rate);
  return { type: "IGST", igst, totalGst: igst };
}

export interface GstLiabilityInput {
  /** Output GST collected on sales this period. */
  outputGst: number;
  /** Input GST on ELIGIBLE business purchases (caller filters §17(5) via itcStatus). */
  inputGstEligible: number;
}

export interface GstLiabilityResult {
  outputGst: number;
  inputCredit: number;
  /** Net GST to pay (output − input), floored at 0. */
  netPayable: number;
  /** Credit carried forward when input exceeds output. */
  carryForward: number;
}

/** Output−input GST netting — the real monthly tax for a registered trader. */
export function gstLiability(input: GstLiabilityInput): GstLiabilityResult {
  const outputGst = Math.round(input.outputGst);
  const inputCredit = Math.round(input.inputGstEligible);
  const net = outputGst - inputCredit;
  return { outputGst, inputCredit, netPayable: Math.max(0, net), carryForward: net < 0 ? -net : 0 };
}

export interface GstRegistrationResult {
  required: boolean;
  threshold: number;
  note: string;
}

/** Is GST registration required, given turnover and whether dealing in goods. */
export function gstRegistrationRequired(
  turnover: number,
  dealsInGoods: boolean,
  lowerThresholdState = false,
  rules: TaxRuleSet = FY_2025_26,
): GstRegistrationResult {
  const threshold = dealsInGoods
    ? rules.gst.thresholdGoods
    : lowerThresholdState
      ? rules.gst.thresholdLowerStatesServices
      : rules.gst.thresholdServices;

  const required = turnover > threshold;
  const kind = dealsInGoods ? "goods" : "services";
  return {
    required,
    threshold,
    note: required
      ? `Turnover ₹${turnover.toLocaleString("en-IN")} exceeds the ₹${threshold.toLocaleString("en-IN")} ${kind} threshold — registration required.`
      : `Turnover below the ₹${threshold.toLocaleString("en-IN")} ${kind} threshold — registration optional.`,
  };
}
