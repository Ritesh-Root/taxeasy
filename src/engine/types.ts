/** Shared domain types for the deterministic tax engine. */

export type Regime = "new" | "old";
export type IncomeType = "SALARY" | "PROFESSION" | "BUSINESS" | "OTHER";
export type PresumptiveScheme = "44ADA" | "44AD" | "NONE";

export interface IncomeTaxResult {
  readonly rulesetVersion: string;
  readonly regime: Regime;
  readonly taxableIncome: number;
  readonly taxBeforeRebate: number;
  readonly rebateApplied: number;
  readonly taxBeforeCess: number;
  readonly cess: number;
  readonly total: number;
}

export interface PresumptiveResult {
  readonly scheme: PresumptiveScheme;
  readonly grossReceipts: number;
  readonly rateApplied: number;
  readonly presumptiveIncome: number;
  readonly withinLimit: boolean;
  readonly limit: number;
  readonly lockinYears: number;
}

export type GstInvoiceType =
  | "CGST+SGST"
  | "IGST"
  | "EXPORT_LUT"
  | "EXPORT_NO_LUT";

export interface GstResult {
  readonly type: GstInvoiceType;
  readonly cgst?: number;
  readonly sgst?: number;
  readonly igst?: number;
  readonly totalGst: number;
  readonly note?: string;
}

export type ItcStatus = "eligible" | "blocked" | "ineligible" | "review";

export interface ItcResult {
  readonly eligible: boolean;
  /** Finer-grained outcome: "review" means confirm business use before claiming. */
  readonly status: ItcStatus;
  readonly reason: string;
}

export interface AdvanceTaxInstalment {
  readonly dueDate: string;
  readonly cumulativeAmount: number;
}

export interface AdvanceTaxResult {
  readonly required: boolean;
  readonly schedule: readonly AdvanceTaxInstalment[];
  readonly note: string;
}
