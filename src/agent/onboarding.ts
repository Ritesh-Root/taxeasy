/**
 * Conversational onboarding — turns a fresh WhatsApp contact into a usable
 * profile in four short steps, then delivers their first tax estimate.
 *
 *   welcome → profession (detect scheme+segment) → turnover → payment mode
 *           → DPDP consent toggles → done (first estimate)
 *
 * Pure functions: given the current step + message + profile-so-far, return the
 * reply, the profile patch, and the next step. The agent owns persistence.
 */
import type { OnboardingStep, UserProfileData, UserModelData } from "../ports/types.ts";
import { detectScheme, estimateTax } from "../engine/index.ts";
import { proactiveInsights } from "./advisory.ts";
import { DISCLAIMER } from "./router.ts";

export interface OnboardingResult {
  reply: string;
  profilePatch: Partial<UserProfileData>;
  segment?: NonNullable<UserModelData["segment"]>;
  nextStep: OnboardingStep;
  complete: boolean;
}

export const WELCOME =
  "👋 Welcome to TaxEasy — your tax & bills helper for FY2025-26.\n" +
  "I'll set you up in 4 quick questions.\n\n" +
  "1/4 — What's your work or business? (e.g. \"freelance developer\", \"kirana store\", \"doctor\")";

/** Parse Indian-style amounts: "18,00,000", "18 lakh", "1.2 cr". */
export function parseAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const num = parseFloat((t.match(/[\d.]+/) ?? [])[0] ?? "");
  if (!Number.isFinite(num)) return null;
  if (/cr|crore/.test(t)) return Math.round(num * 10_000_000);
  if (/lakh|lac|\bl\b/.test(t)) return Math.round(num * 100_000);
  return Math.round(num);
}

const CONSENT_KEYS = ["income", "gst", "bank", "bills", "notices"] as const;

function parseConsent(text: string): Partial<Record<(typeof CONSENT_KEYS)[number], boolean>> {
  const t = text.toLowerCase();
  if (/\b(all|everything|sab|sabhi|haan|yes)\b/.test(t)) {
    return Object.fromEntries(CONSENT_KEYS.map((k) => [k, true]));
  }
  const out: Partial<Record<(typeof CONSENT_KEYS)[number], boolean>> = {};
  for (const k of CONSENT_KEYS) if (t.includes(k)) out[k] = true;
  return out;
}

export function handleOnboarding(
  step: OnboardingStep,
  message: string,
  profile: UserProfileData,
): OnboardingResult {
  const msg = message.trim();

  switch (step) {
    case "profession": {
      if (!msg) {
        return { reply: WELCOME, profilePatch: {}, nextStep: "profession", complete: false };
      }
      const scheme = detectScheme(msg);
      const segment = scheme === "44ADA" ? "professional" : "trader";
      const incomeType = scheme === "44ADA" ? "PROFESSION" : "BUSINESS";
      return {
        reply:
          `Got it — ${msg} (likely ${scheme} presumptive scheme).\n\n` +
          "2/4 — Roughly, your yearly income / turnover? (e.g. \"18,00,000\" or \"18 lakh\")",
        profilePatch: { profession: msg, incomeType },
        segment,
        nextStep: "turnover",
        complete: false,
      };
    }

    case "turnover": {
      const amount = parseAmount(msg);
      if (amount == null || amount <= 0) {
        return {
          reply: "Please send your yearly amount as a number, e.g. \"1800000\" or \"18 lakh\".",
          profilePatch: {},
          nextStep: "turnover",
          complete: false,
        };
      }
      return {
        reply:
          `Noted ₹${amount.toLocaleString("en-IN")}/year.\n\n` +
          "3/4 — Do you receive most payments digitally (UPI / bank) or in cash?",
        profilePatch: { grossReceipts: amount },
        nextStep: "mode",
        complete: false,
      };
    }

    case "mode": {
      const mostlyDigital = !/\bcash\b/i.test(msg);
      return {
        reply:
          (mostlyDigital ? "Great, mostly digital.\n\n" : "Okay, mostly cash.\n\n") +
          "4/4 — Which data may I use to help you? Reply with any of: " +
          "income, gst, bills, bank, notices — or \"all\". You can change this anytime.",
        profilePatch: { mostlyDigital },
        nextStep: "consent",
        complete: false,
      };
    }

    case "consent": {
      const consent = parseConsent(msg);
      // Onboarding complete — give the first real value: a tax estimate.
      const merged: UserProfileData = { ...profile, consent };
      let estimateLine = "";
      if (merged.profession && merged.grossReceipts != null) {
        const est = estimateTax({
          profession: merged.profession,
          grossReceipts: merged.grossReceipts,
          incomeType: merged.incomeType ?? "PROFESSION",
          ...(merged.mostlyDigital != null ? { mostlyDigital: merged.mostlyDigital } : {}),
        });
        estimateLine = est.presumptiveApplicable && est.tax
          ? `\n\n📊 First estimate: ${est.presumptive.scheme}, presumptive income ` +
            `₹${est.presumptive.presumptiveIncome.toLocaleString("en-IN")} → tax ` +
            `₹${est.tax.total.toLocaleString("en-IN")} (new regime).` +
            (est.tax.total === 0 ? " You're within the §87A rebate — ₹0 tax." : "")
          : `\n\n⚠️ ${est.auditWarning}`;
      }
      const shared = Object.keys(consent).filter((k) => consent[k as keyof typeof consent]);
      // Proactive CA guidance — volunteer what matters before being asked.
      const insights = proactiveInsights(merged);
      const insightBlock = insights.length ? `\n\n${insights.join("\n")}` : "";
      return {
        reply:
          `✅ You're all set! Sharing: ${shared.length ? shared.join(", ") : "nothing yet"}.` +
          estimateLine +
          insightBlock +
          `\n\nAsk me anything — \"my tax?\", \"do I need GST?\", or send a bill photo.\n\n${DISCLAIMER}`,
        profilePatch: { consent },
        nextStep: "done",
        complete: true,
      };
    }

    default:
      return { reply: "", profilePatch: {}, nextStep: "done", complete: true };
  }
}
