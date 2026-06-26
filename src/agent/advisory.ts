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

// ---- Phase B: advisory depth ----

/** Calm, engine-backed explanation of late-fee/penalty + reassurance (S6). */
export function noticePenaltyAnswer(lang: Lang = "en"): string {
  return t("advisory.notice_penalty", lang);
}

/** Value-pivot when a low earner questions the price (S5) — free-tier aware. */
export function valuePivotAnswer(p: UserProfileData, lang: Lang = "en"): string {
  let zeroTax = false;
  if (p.profession && p.grossReceipts != null) {
    const est = estimateTax({
      profession: p.profession,
      grossReceipts: p.grossReceipts,
      incomeType: p.incomeType ?? "PROFESSION",
      ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
    });
    zeroTax = est.presumptiveApplicable && est.tax?.total === 0;
  }
  return t(zeroTax ? "advisory.value_zero" : "advisory.value", lang);
}

/** Empathetic hand-holding for an overwhelmed / low-literacy user (S6). */
export function reassuranceAnswer(lang: Lang = "en"): string {
  return t("advisory.reassurance", lang);
}

/**
 * Date-driven proactive nudges — the CA reminding before deadlines. Pure: given
 * a date, emit nudges for deadlines within the next 7 days. Wired to a scheduler
 * in Phase D; usable opportunistically now.
 */
export function proactiveTriggers(p: UserProfileData, date: Date, lang: Lang = "en"): string[] {
  const out: string[] = [];
  const within7 = (m: number, d: number) => {
    const due = new Date(date.getFullYear(), m - 1, d);
    const days = Math.round((due.getTime() - date.getTime()) / 86_400_000);
    return days >= 0 && days <= 7;
  };
  const fmt = (m: number, d: number) =>
    `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;

  // Advance tax instalments (presumptive owners pay by 15 Mar, but warn near each).
  for (const [m, d] of [[6, 15], [9, 15], [12, 15], [3, 15]] as const) {
    if (within7(m, d)) out.push(t("trigger.advance_tax", lang, { date: fmt(m, d) }));
  }
  // GSTR-3B 20th — only if GST-registered/required.
  const goods = p.incomeType === "BUSINESS";
  if (p.grossReceipts != null && p.grossReceipts > (goods ? 4_000_000 : 2_000_000) && within7(date.getMonth() + 1, 20)) {
    out.push(t("trigger.gstr3b", lang, { date: fmt(date.getMonth() + 1, 20) }));
  }
  // ITR-3/4 (business/presumptive) 31 Aug.
  if (within7(8, 31)) out.push(t("trigger.itr", lang, { date: fmt(8, 31) }));
  // LUT renewal before 1 Apr.
  if (within7(3, 31)) out.push(t("trigger.lut", lang, { date: fmt(3, 31) }));

  return out;
}
