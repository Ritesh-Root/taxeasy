/**
 * Region registry — TaxEasy is international. A user picks their region and the
 * agent customizes to it (language, currency, and which tax engine runs).
 *
 * LEGAL SAFETY: tax rules are country-specific. We only emit tax NUMBERS for a
 * region whose engine is actually implemented + verified (`supported: true`).
 * Every other region is "coming soon" — the agent collects them on a waitlist and
 * never computes tax it can't stand behind. India is the launch region.
 */

export interface Region {
  code: string; // ISO-3166 alpha-2
  name: string;
  currency: { symbol: string; code: string; locale: string };
  /** Languages the agent supports for this region (i18n). */
  languages: string[];
  /** Is the tax engine for this region implemented + verified? */
  supported: boolean;
  /** Free-text aliases for matching what the user types. */
  aliases: string[];
}

export const REGIONS: Record<string, Region> = {
  IN: {
    code: "IN", name: "India",
    currency: { symbol: "₹", code: "INR", locale: "en-IN" },
    languages: ["en", "hi", "hinglish"],
    supported: true, // ← the only fully-implemented engine today
    aliases: ["india", "in", "ind", "bharat", "hindustan", "भारत", "इंडिया"],
  },
  US: {
    code: "US", name: "United States",
    currency: { symbol: "$", code: "USD", locale: "en-US" },
    languages: ["en"], supported: false,
    aliases: ["usa", "us", "america", "united states", "u.s.", "u.s.a"],
  },
  GB: {
    code: "GB", name: "United Kingdom",
    currency: { symbol: "£", code: "GBP", locale: "en-GB" },
    languages: ["en"], supported: false,
    aliases: ["uk", "gb", "britain", "england", "united kingdom", "great britain"],
  },
  AE: {
    code: "AE", name: "United Arab Emirates",
    currency: { symbol: "AED ", code: "AED", locale: "en-AE" },
    languages: ["en"], supported: false,
    aliases: ["uae", "ae", "dubai", "emirates", "abu dhabi", "united arab emirates"],
  },
  CA: {
    code: "CA", name: "Canada",
    currency: { symbol: "$", code: "CAD", locale: "en-CA" },
    languages: ["en"], supported: false,
    aliases: ["canada", "ca", "can"],
  },
  SG: {
    code: "SG", name: "Singapore",
    currency: { symbol: "$", code: "SGD", locale: "en-SG" },
    languages: ["en"], supported: false,
    aliases: ["singapore", "sg", "sgp"],
  },
  AU: {
    code: "AU", name: "Australia",
    currency: { symbol: "$", code: "AUD", locale: "en-AU" },
    languages: ["en"], supported: false,
    aliases: ["australia", "au", "aus", "oz"],
  },
};

export const DEFAULT_REGION = "IN";

/** Match free-text region input to a Region, or null. Whole-word matching so a
 *  short alias like "in" doesn't false-match inside "kingdom". */
export function matchRegion(text: string): Region | null {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return null;
  const tokens = new Set(t.split(/[^a-zऀ-ॿ]+/i).filter(Boolean));
  for (const r of Object.values(REGIONS)) {
    if (r.code.toLowerCase() === t || r.name.toLowerCase() === t) return r;
    for (const a of r.aliases) {
      const al = a.toLowerCase();
      if (al.includes(" ")) {
        if (t.includes(al)) return r; // multi-word alias → phrase match
      } else if (tokens.has(al)) {
        return r; // single-word alias → whole-word match
      }
    }
  }
  return null;
}

export function getRegion(code: string | undefined): Region {
  return (code && REGIONS[code]) || REGIONS[DEFAULT_REGION]!;
}

/** True only if the region's tax engine is implemented (undefined ⇒ legacy India). */
export function isSupportedRegion(code: string | undefined): boolean {
  if (!code) return true; // legacy users predate region selection → India
  return REGIONS[code]?.supported ?? false;
}

/** Region-aware money formatting (for when non-India engines land). */
export function formatMoney(region: Region, amount: number): string {
  return `${region.currency.symbol}${amount.toLocaleString(region.currency.locale)}`;
}
