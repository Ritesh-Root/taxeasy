/**
 * Statutory tax rules — FY2025-26 / AY2026-27.
 *
 * Every value verified against CBDT/CBIC / ClearTax / incometax.gov.in (June 2026)
 * per TaxEasy-FINAL/02-CORRECTED-TAX-FACTS.md. Re-verify on 1 April after each Budget.
 *
 * Rules are stored per financial year and stamped onto every calculation
 * (see `version` / `effectiveFrom`) so a result can always be traced to its ruleset.
 */

export interface Slab {
  /** Upper bound of this slab (inclusive band top). Use Infinity for the top slab. */
  readonly upTo: number;
  readonly rate: number;
}

export interface TaxRuleSet {
  readonly version: string;
  readonly financialYear: string;
  readonly assessmentYear: string;
  readonly effectiveFrom: string;
  readonly sources: readonly string[];

  readonly newRegime: {
    readonly slabs: readonly Slab[];
    readonly stdDeductionSalaried: number;
    readonly rebate87A: number;
    readonly rebateIncomeLimit: number;
  };
  readonly oldRegime: {
    readonly slabs: readonly Slab[];
    readonly stdDeductionSalaried: number;
    readonly rebate87A: number;
    readonly rebateIncomeLimit: number;
    readonly section80CLimit: number;
  };

  readonly presumptive: {
    readonly rate44ADA: number;
    readonly rate44ADdigital: number;
    readonly rate44ADcash: number;
    readonly limit44ADAstd: number;
    readonly limit44ADAdigital: number;
    readonly limit44ADstd: number;
    readonly limit44ADdigital: number;
    readonly lockin44ADAyears: number;
    readonly lockin44ADyears: number;
  };

  readonly gst: {
    readonly rateServices: number;
    readonly thresholdServices: number;
    readonly thresholdGoods: number;
    readonly thresholdLowerStatesServices: number;
    readonly lateFeePerDayEstimate: number;
    readonly lateFeeCap: number;
  };

  readonly cess: number;
  readonly tds194Jrate: number;
  readonly tds194Jthreshold: number;
  readonly advanceTaxThreshold: number;
}

export const FY_2025_26: TaxRuleSet = {
  version: "2025-26",
  financialYear: "2025-26",
  assessmentYear: "2026-27",
  effectiveFrom: "2025-04-01",
  sources: [
    "https://incometax.gov.in",
    "https://cleartax.in/s/income-tax-slabs",
    "CBDT/CBIC Budget 2025 (Income-tax Act 1961 as amended)",
  ],

  newRegime: {
    slabs: [
      { upTo: 400_000, rate: 0 },
      { upTo: 800_000, rate: 0.05 },
      { upTo: 1_200_000, rate: 0.1 },
      { upTo: 1_600_000, rate: 0.15 },
      { upTo: 2_000_000, rate: 0.2 },
      { upTo: 2_400_000, rate: 0.25 },
      { upTo: Infinity, rate: 0.3 },
    ],
    stdDeductionSalaried: 75_000, // salaried income only
    rebate87A: 60_000, // was wrongly 25_000 in old docs
    rebateIncomeLimit: 1_200_000, // zero tax up to ₹12L taxable
  },

  oldRegime: {
    slabs: [
      { upTo: 250_000, rate: 0 },
      { upTo: 500_000, rate: 0.05 },
      { upTo: 1_000_000, rate: 0.2 },
      { upTo: Infinity, rate: 0.3 },
    ],
    stdDeductionSalaried: 50_000,
    rebate87A: 12_500,
    rebateIncomeLimit: 500_000,
    section80CLimit: 150_000, // old regime only
  },

  presumptive: {
    rate44ADA: 0.5, // professionals
    rate44ADdigital: 0.06, // business, ≥95% digital
    rate44ADcash: 0.08, // business, cash
    limit44ADAstd: 5_000_000, // ₹50L
    limit44ADAdigital: 7_500_000, // ₹75L if cash receipts ≤5%
    limit44ADstd: 20_000_000, // ₹2 Cr
    limit44ADdigital: 30_000_000, // ₹3 Cr if cash ≤5%
    lockin44ADAyears: 0, // opt out anytime
    lockin44ADyears: 5, // 5-year mandatory lock-in
  },

  gst: {
    rateServices: 0.18,
    thresholdServices: 2_000_000, // ₹20L
    thresholdGoods: 4_000_000, // ₹40L
    thresholdLowerStatesServices: 1_000_000, // ₹10L
    lateFeePerDayEstimate: 50, // ₹25 CGST + ₹25 SGST — planning estimate only
    lateFeeCap: 5_000,
  },

  cess: 0.04,
  tds194Jrate: 0.1,
  tds194Jthreshold: 30_000, // per payer per year
  advanceTaxThreshold: 10_000,
};
