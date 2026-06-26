/**
 * Static, deterministic intents — the 429/cost killer. Deadlines, slabs, GST
 * thresholds, late fees never change between two messages, so they are matched
 * here with ZERO AI and rendered from the i18n catalog in the user's language
 * (see i18n.ts / router.ts). Only genuinely conversational queries reach Gemini.
 */

/** Keyword → i18n answer key. Suffix-tolerant (date/dates, renew/renewal). */
const STATIC_PATTERNS: { key: string; rx: RegExp }[] = [
  { key: "static.late_fee", rx: /\b(late fee|penalt|fine|interest)\b.*\b(gst|gstr|filing|return|file|tax)\b|\b(gst|return).*(late|penalt)/i },
  { key: "static.gst_due_dates", rx: /\b(gstr|gst return|3b|gstr-?1)\b.*(due|date|when|file)|when.*gst.*(due|file)/i },
  { key: "static.gst_threshold", rx: /\bgst\b.*(threshold|regist|limit|need|require)|do i need gst/i },
  { key: "static.advance_tax_dates", rx: /advance tax.*(date|when|due|schedul|pay)|when.*advance tax/i },
  { key: "static.itr_deadlines", rx: /\b(itr|income tax return)\b.*(deadline|date|when|due|last|file)/i },
  { key: "static.deadlines_overview", rx: /\b(deadline|reminder|due date|remind me)\b/i },
  { key: "static.new_regime_slabs", rx: /\b(slab|tax rate|new regime|tax bracket|rates)\b/i },
  { key: "static.lut_renewal", rx: /\b(lut|export)\b.*(gst|igst|renew|expir)/i },
];

/** Return the i18n key for a static answer, or null. The router renders it. */
export function matchStaticAnswer(text: string): string | null {
  for (const { key, rx } of STATIC_PATTERNS) {
    if (rx.test(text)) return key;
  }
  return null;
}
