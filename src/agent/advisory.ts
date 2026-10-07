/**
 * The "agentic CA" layer — proactive + advisory, engine-backed and deterministic
 * (specific, trustworthy), and now localized via the i18n catalog so a Hindi or
 * Hinglish owner gets real guidance, not English prose.
 */
import type { UserProfileData } from "../ports/types.ts";
import { estimateTax, gstRegistrationRequired, advanceTaxDue, incomeTax } from "../engine/index.ts";
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
    // For a registered trader, GST (not income tax) is the real monthly burden.
    if (goods) out.push(t("insights.gst_trader", lang));
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

/** GST output−input netting explainer for traders (S4) — formula + offer to compute. */
export function gstLiabilityAnswer(lang: Lang = "en"): string {
  return t("advisory.gst_liability", lang);
}

/**
 * Old vs new regime on the user's presumptive income, with the math shown.
 * Deductions (80C, 80D, …) only count in the old regime. Null when the profile
 * is incomplete or presumptive taxation doesn't apply (caller explains why).
 */
export function regimeComparisonAnswer(p: UserProfileData, deductions: number, lang: Lang = "en"): string | null {
  if (p.grossReceipts == null || !p.profession) return null;
  const est = estimateTax({
    profession: p.profession,
    grossReceipts: p.grossReceipts,
    incomeType: p.incomeType ?? "PROFESSION",
    ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
  });
  if (!est.presumptiveApplicable) return null;
  const income = est.presumptive.presumptiveIncome;
  const oldTaxable = Math.max(0, income - deductions);
  const newTax = incomeTax(income, "new").total;
  const oldTax = incomeTax(oldTaxable, "old").total;
  const lines = [
    t("regime.compare", lang, {
      scheme: est.presumptive.scheme,
      income: inr(income),
      newTax: inr(newTax),
      ded: inr(deductions),
      oldTaxable: inr(oldTaxable),
      oldTax: inr(oldTax),
    }),
    newTax === oldTax
      ? t("regime.same", lang)
      : t("regime.saves", lang, { regime: t(newTax < oldTax ? "regime.new" : "regime.old", lang), saving: inr(Math.abs(newTax - oldTax)) }),
  ];
  if (!deductions) lines.push(t("regime.tip", lang));
  return lines.join("\n");
}

/** Output GST on a stated sales amount (default 18%), due date, and the ITC note. */
export function gstOnSalesAnswer(sales: number, ratePct: number, lang: Lang = "en"): string {
  return t("gst.on_sales", lang, { sales: inr(sales), rate: ratePct, gst: inr(Math.round((sales * ratePct) / 100)) });
}

/**
 * Deadline reminders due within the next 7 days — sent by runtime/reminders.ts.
 * Pure: given a date, returns each reminder with a key (kind + due date) so the
 * scheduler sends it once. Only deadlines that apply to this user are included.
 */
export function proactiveTriggers(p: UserProfileData, date: Date, lang: Lang = "en"): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const add = (kind: string, m: number, d: number) => {
    const due = new Date(date.getFullYear(), m - 1, d);
    const days = Math.round((due.getTime() - date.getTime()) / 86_400_000);
    if (days < 0 || days > 7) return;
    const label = `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
    out.push({ key: `${kind}:${date.getFullYear()}-${m}-${d}`, text: t(`trigger.${kind}`, lang, { date: label }) });
  };

  // Advance tax only when it's due: books → 4 instalments; presumptive → 100% by 15 Mar, if tax ≥ ₹10,000.
  if (p.profession && p.grossReceipts != null) {
    const est = estimateTax({
      profession: p.profession,
      grossReceipts: p.grossReceipts,
      incomeType: p.incomeType ?? "PROFESSION",
      ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
    });
    const dates = !est.presumptiveApplicable
      ? [[6, 15], [9, 15], [12, 15], [3, 15]]
      : est.tax && advanceTaxDue(est.tax.total, true).required ? [[3, 15]] : [];
    for (const [m, d] of dates) add("advance_tax", m!, d!);
  }
  // GST returns (and LUT renewal) — registered users; if unknown, turnover above the threshold.
  const goods = p.incomeType === "BUSINESS";
  if (p.gstRegistered ?? (p.grossReceipts != null && p.grossReceipts > (goods ? 4_000_000 : 2_000_000))) {
    add("gstr1", date.getMonth() + 1, 11);
    add("gstr3b", date.getMonth() + 1, 20);
    add("lut", 3, 31);
  }
  // ITR-3/4 (business/presumptive) 31 Aug.
  add("itr", 8, 31);
  return out;
}
