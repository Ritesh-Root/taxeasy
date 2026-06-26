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
import { t } from "./i18n.ts";
import type { Lang } from "./i18n.ts";

export interface OnboardingResult {
  reply: string;
  profilePatch: Partial<UserProfileData>;
  segment?: NonNullable<UserModelData["segment"]>;
  nextStep: OnboardingStep;
  complete: boolean;
}

/** Localized welcome (the agent picks the language from the first message). */
export const welcome = (lang: Lang = "en") => t("onboard.welcome", lang);
/** Back-compat default (English) for callers that don't pass a language. */
export const WELCOME = welcome("en");

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
  lang: Lang = "en",
): OnboardingResult {
  const msg = message.trim();

  switch (step) {
    case "profession": {
      if (!msg) {
        return { reply: t("onboard.welcome", lang), profilePatch: {}, nextStep: "profession", complete: false };
      }
      const scheme = detectScheme(msg);
      const segment = scheme === "44ADA" ? "professional" : "trader";
      const incomeType = scheme === "44ADA" ? "PROFESSION" : "BUSINESS";
      return {
        reply: t("onboard.profession_ack", lang, { work: msg, scheme }),
        profilePatch: { profession: msg, incomeType },
        segment,
        nextStep: "turnover",
        complete: false,
      };
    }

    case "turnover": {
      const amount = parseAmount(msg);
      if (amount == null || amount <= 0) {
        return { reply: t("onboard.turnover_reask", lang), profilePatch: {}, nextStep: "turnover", complete: false };
      }
      return {
        reply: t("onboard.turnover_ack", lang, { amount: amount.toLocaleString("en-IN") }),
        profilePatch: { grossReceipts: amount },
        nextStep: "mode",
        complete: false,
      };
    }

    case "mode": {
      const mostlyDigital = !/\bcash\b/i.test(msg);
      return {
        reply: t(mostlyDigital ? "onboard.mode_digital" : "onboard.mode_cash", lang),
        profilePatch: { mostlyDigital },
        nextStep: "consent",
        complete: false,
      };
    }

    case "consent": {
      const consent = parseConsent(msg);
      const merged: UserProfileData = { ...profile, consent };

      // First real value: a localized tax estimate.
      let estimateLine = "";
      if (merged.profession && merged.grossReceipts != null) {
        const est = estimateTax({
          profession: merged.profession,
          grossReceipts: merged.grossReceipts,
          incomeType: merged.incomeType ?? "PROFESSION",
          ...(merged.mostlyDigital != null ? { mostlyDigital: merged.mostlyDigital } : {}),
        });
        if (est.presumptiveApplicable && est.tax) {
          estimateLine = "\n\n" + t(est.tax.total === 0 ? "estimate.zero" : "estimate.nonzero", lang, {
            scheme: est.presumptive.scheme,
            income: est.presumptive.presumptiveIncome.toLocaleString("en-IN"),
            tax: est.tax.total.toLocaleString("en-IN"),
          });
        }
      }
      const shared = Object.keys(consent).filter((k) => consent[k as keyof typeof consent]);
      // Proactive CA guidance — volunteer what matters before being asked.
      const insights = proactiveInsights(merged, lang);
      const insightBlock = insights.length ? `\n\n${insights.join("\n")}` : "";
      return {
        reply:
          t("onboard.complete", lang, { shared: shared.length ? shared.join(", ") : "—" }) +
          estimateLine +
          insightBlock +
          `\n\n${t("onboard.ask_anything", lang)}\n\n${t("disclaimer", lang)}`,
        profilePatch: { consent },
        nextStep: "done",
        complete: true,
      };
    }

    default:
      return { reply: "", profilePatch: {}, nextStep: "done", complete: true };
  }
}
