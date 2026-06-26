/**
 * Input Tax Credit eligibility (§17(5) blocked-credit check).
 *
 * The §17(5) blocked list is non-exhaustive (40+ categories) — this covers the
 * common ones; always ship with the "verify, not legal certainty" disclaimer. (TAX-09)
 */
import type { ItcResult } from "./types.ts";

/** Common §17(5) blocked-credit categories (non-exhaustive). */
const ITC_BLOCKED = [
  "restaurant", "food", "beverage", "hotel", "lodging", "club", "gym",
  "fitness", "personal", "salon", "spa", "motor_vehicle", "car",
  "fuel_personal", "gift",
];

export function itcStatus(category: string, hasGstInvoice: boolean): ItcResult {
  const cat = (category ?? "").toLowerCase();

  if (!hasGstInvoice) {
    return {
      eligible: false,
      reason: "No GST invoice in your name — ITC needs a valid tax invoice.",
    };
  }

  const blocked = ITC_BLOCKED.find((b) => cat.includes(b));
  if (blocked) {
    return {
      eligible: false,
      reason: `ITC blocked under §17(5) for "${category}".`,
    };
  }

  return { eligible: true, reason: `ITC eligible for "${category}".` };
}
