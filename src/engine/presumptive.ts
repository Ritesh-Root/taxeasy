/**
 * Presumptive taxation — §44ADA (professionals, 50%) vs §44AD (business, 6%/8%).
 *
 * Using the wrong section is the #1 costly mistake (triggers §142 scrutiny), so
 * scheme detection is whole-word token matching: "Rapido bike taxi captain" must
 * NOT match "ca" → 44ADA. It is a trader → §44AD.
 */
import type { PresumptiveScheme, PresumptiveResult } from "./types.ts";
import type { TaxRuleSet } from "./tax-rules/2025-26.ts";
import { FY_2025_26 } from "./tax-rules/2025-26.ts";

/** Profession keywords eligible for §44ADA — matched as whole words only. */
const PROFESSIONS_44ADA = new Set<string>([
  "doctor", "physician", "medical", "clinic", "lawyer", "advocate", "ca",
  "accountant", "accountancy", "architect", "engineer", "engineering",
  "consultant", "consulting", "designer", "design", "it", "software",
  "developer", "interior", "film", "artist", "technical",
]);

/**
 * Trader/retail indicators. These OVERRIDE a professional keyword, because the
 * sale of goods is §44AD even when the name borrows a profession word — e.g.
 * "medical store" (pharmacy), "IT hardware shop", "engineering goods trader".
 * (Found by the engine stress sim: 7/7 such traders were mis-flagged 44ADA.)
 */
const TRADER_TOKENS = new Set<string>([
  "store", "shop", "trader", "trading", "retail", "retailer", "wholesale",
  "wholesaler", "reseller", "dealer", "mart", "kirana", "boutique", "goods",
  "stationery", "hardware", "grocery", "supermarket", "distributor", "vendor",
]);

export function detectScheme(profession: string): PresumptiveScheme {
  const tokens = new Set((profession ?? "").toLowerCase().match(/[a-z]+/g) ?? []);
  for (const t of tokens) {
    if (TRADER_TOKENS.has(t)) return "44AD"; // selling goods → business, overrides profession words
  }
  for (const t of tokens) {
    if (PROFESSIONS_44ADA.has(t)) return "44ADA";
  }
  return "44AD"; // traders / retailers / gig / most businesses
}

export function presumptiveIncome(
  grossReceipts: number,
  scheme: PresumptiveScheme,
  mostlyDigital = true,
  rules: TaxRuleSet = FY_2025_26,
): PresumptiveResult {
  const p = rules.presumptive;
  const gross = Math.max(0, Math.round(grossReceipts));

  let rate: number;
  let limit: number;
  let lockin: number;

  switch (scheme) {
    case "44ADA":
      rate = p.rate44ADA;
      limit = mostlyDigital ? p.limit44ADAdigital : p.limit44ADAstd;
      lockin = p.lockin44ADAyears;
      break;
    case "44AD":
      rate = mostlyDigital ? p.rate44ADdigital : p.rate44ADcash;
      limit = mostlyDigital ? p.limit44ADdigital : p.limit44ADstd;
      lockin = p.lockin44ADyears;
      break;
    default:
      rate = 1; // no scheme → full receipts taxable
      limit = Infinity;
      lockin = 0;
  }

  return {
    scheme,
    grossReceipts: gross,
    rateApplied: rate,
    presumptiveIncome: Math.round(gross * rate),
    withinLimit: gross <= limit,
    limit,
    lockinYears: lockin,
  };
}
