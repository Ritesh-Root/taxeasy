/**
 * Input Tax Credit eligibility (§17(5) + business-purpose).
 *
 * SAFE-BY-DEFAULT (fixes report B1): the real-data sim showed 85% of "eligible"
 * spend was actually personal. Claiming ITC on personal/ineligible spend exposes
 * the USER to GST scrutiny. So eligibility is NEVER the default — it requires a
 * valid GST invoice AND a positive business-purpose signal AND no §17(5) block.
 * Anything ambiguous returns "review" (ask the user / confirm business use).
 *
 * Keyword matching is a cheap pre-filter only; ambiguous cases must be confirmed
 * by the user (or the AI categorizer with a confidence gate) before claiming ITC.
 */
import type { ItcResult } from "./types.ts";

/** §17(5) blocked credit (non-exhaustive) — never eligible even for business. */
const BLOCKED = [
  "restaurant", "food", "beverage", "catering", "hotel", "lodging", "club",
  "gym", "fitness", "salon", "spa", "beauty", "cosmetic", "membership",
  "motor_vehicle", "car ", "fuel", "petrol", "diesel", "gift", "insurance",
  "health", "medical", // personal medical/health services
];

/** Clearly personal — not business-purpose, so no ITC (default deny). */
const PERSONAL = [
  "household", "family", "festival", "apparel", "clothing", "grocery",
  "tourism", "travel", "transportation", "commute", "culture", "maid",
  "investment", "money transfer", "education", "school", "tuition",
  "entertainment", "movie", "donation", "self", "personal", "rent_home",
];

/** Positive business-purpose signals — eligible WITH a valid GST invoice. */
const BUSINESS = [
  "software", "saas", "hosting", "domain", "cloud", "server", "advertising",
  "marketing", "ads", "office", "stationery", "printing", "internet",
  "broadband", "telecom", "professional fee", "legal", "accounting", "audit",
  "consultanc", "commission", "freight", "logistics", "courier", "packaging",
  "raw material", "inventory", "stock purchase", "equipment", "machinery",
  "tools", "wholesale", "supplies",
];

const has = (cat: string, list: string[]) => list.find((k) => cat.includes(k));

export function itcStatus(category: string, hasGstInvoice: boolean): ItcResult {
  const cat = (category ?? "").toLowerCase();

  if (!hasGstInvoice) {
    return { eligible: false, status: "review", reason: "Need a valid GST tax invoice in your name before any ITC." };
  }

  const blocked = has(cat, BLOCKED);
  if (blocked) {
    return { eligible: false, status: "blocked", reason: `ITC blocked under §17(5) ("${category}").` };
  }

  const business = has(cat, BUSINESS);
  const personal = has(cat, PERSONAL);

  if (business && !personal) {
    return { eligible: true, status: "eligible", reason: `Business expense with a GST invoice — ITC eligible ("${category}").` };
  }
  if (personal && !business) {
    return { eligible: false, status: "ineligible", reason: `Looks personal — ITC is only for business-purpose expenses ("${category}").` };
  }

  // Unknown or dual-use → never auto-claim; ask the user.
  return { eligible: false, status: "review", reason: `Confirm this is a business expense before claiming ITC ("${category}").` };
}
