/**
 * The "agentic CA" layer — proactive + advisory, engine-backed and deterministic
 * (specific, trustworthy), and now localized via the i18n catalog so a Hindi or
 * Hinglish owner gets real guidance, not English prose.
 */
import type { UserProfileData } from "../ports/types.ts";
import { estimateTax, gstRegistrationRequired, advanceTaxDue } from "../engine/index.ts";
import { t } from "./i18n.ts";
import type { Lang } from "./i18n.ts";

const dealsInGoods = (p: UserProfileData) => p.incomeType === "BUSINESS";
const inr = (n: number) => n.toLocaleString("en-IN");

/** Personalised GST-registration answer using the user's actual turnover. */
export function gstRegistrationAnswer(p: UserProfileData, lang: Lang = "en"): string | null {
  if (p.grossReceipts == null) return null;
  const goods = dealsInGoods(p);
  const r = gstRegistrationRequired(p.grossReceipts, goods);
  const vars = {
    turnover: inr(p.grossReceipts),
    threshold: inr(r.threshold),
    kind: t(goods ? "kind.goods" : "kind.services", lang),
  };
  return t(r.required ? "advisory.gst_required" : "advisory.gst_not_required", lang, vars);
}

/** Definitive presumptive-eligibility answer (vs punting to the AI). */
export function presumptiveEligibilityAnswer(p: UserProfileData, lang: Lang = "en"): string | null {
  if (p.grossReceipts == null || !p.profession) return null;
  const est = estimateTax({
    profession: p.profession,
    grossReceipts: p.grossReceipts,
    incomeType: p.incomeType ?? "PROFESSION",
    ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
  });
  const vars = { gross: inr(p.grossReceipts), scheme: est.presumptive.scheme, cap: inr(est.presumptive.limit) };
  return t(est.presumptiveApplicable ? "advisory.presumptive_yes" : "advisory.presumptive_no", lang, vars);
}

/** Proactive insights computed from the profile — the CA volunteering what matters. */
export function proactiveInsights(p: UserProfileData, lang: Lang = "en"): string[] {
  if (p.grossReceipts == null || !p.profession) return [];
  const out: string[] = [];
  const goods = dealsInGoods(p);

  const gst = gstRegistrationRequired(p.grossReceipts, goods);
  if (gst.required) {
    out.push(t("insights.gst", lang, {
      turnover: inr(p.grossReceipts),
      threshold: inr(gst.threshold),
      kind: t(goods ? "kind.goods" : "kind.services", lang),
    }));
  }

  const est = estimateTax({
    profession: p.profession,
    grossReceipts: p.grossReceipts,
    incomeType: p.incomeType ?? "PROFESSION",
    ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
  });

  if (est.presumptiveApplicable) {
    if (p.grossReceipts > 0.9 * est.presumptive.limit) {
      out.push(t("insights.near_cap", lang, { scheme: est.presumptive.scheme, cap: inr(est.presumptive.limit) }));
    }
    if (est.tax && est.tax.total >= 10_000) {
      out.push(t("insights.advance_tax", lang, { tax: inr(est.tax.total) }));
    }
  }
  return out.slice(0, 3);
}
