/**
 * The "agentic CA" layer — turns the agent from reactive (answer when asked) to
 * proactive (guide + suggest from what it already knows). Everything here is
 * engine-backed and deterministic, so it's specific and trustworthy, not a
 * vague LLM paragraph.
 *
 * Surfaced by the persona simulation: clients' real questions (GST registration,
 * advance tax, presumptive eligibility) were falling to generic AI even though
 * the engine can answer them precisely from the user's profile.
 */
import type { UserProfileData } from "../ports/types.ts";
import { estimateTax, gstRegistrationRequired, advanceTaxDue } from "../engine/index.ts";

const dealsInGoods = (p: UserProfileData) => p.incomeType === "BUSINESS";

/** Personalised GST-registration answer using the user's actual turnover. */
export function gstRegistrationAnswer(p: UserProfileData): string | null {
  if (p.grossReceipts == null) return null;
  const r = gstRegistrationRequired(p.grossReceipts, dealsInGoods(p));
  return r.required
    ? `${r.note} I can walk you through registration; small traders can opt for the composition scheme (~1% of turnover, simpler returns).`
    : `${r.note} You can still register voluntarily if your buyers want input credit.`;
}

/** Definitive presumptive-eligibility answer (vs punting to the AI). */
export function presumptiveEligibilityAnswer(p: UserProfileData): string | null {
  if (p.grossReceipts == null || !p.profession) return null;
  const est = estimateTax({
    profession: p.profession,
    grossReceipts: p.grossReceipts,
    incomeType: p.incomeType ?? "PROFESSION",
    ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
  });
  const cap = est.presumptive.limit.toLocaleString("en-IN");
  return est.presumptiveApplicable
    ? `Yes — at ₹${p.grossReceipts.toLocaleString("en-IN")} you're within the ${est.presumptive.scheme} cap (₹${cap}), so you can use presumptive taxation.`
    : `No — ₹${p.grossReceipts.toLocaleString("en-IN")} exceeds the ${est.presumptive.scheme} cap (₹${cap}). You'll need books (income − expenses) and likely a tax audit.`;
}

/**
 * Proactive insights computed from the profile at onboarding (and re-checkable
 * later). This is the CA volunteering what matters before being asked.
 */
export function proactiveInsights(p: UserProfileData): string[] {
  if (p.grossReceipts == null || !p.profession) return [];
  const out: string[] = [];

  const gst = gstRegistrationRequired(p.grossReceipts, dealsInGoods(p));
  if (gst.required) out.push(`⚠️ GST: ${gst.note} I can guide you through it.`);

  const est = estimateTax({
    profession: p.profession,
    grossReceipts: p.grossReceipts,
    incomeType: p.incomeType ?? "PROFESSION",
    ...(p.mostlyDigital != null ? { mostlyDigital: p.mostlyDigital } : {}),
  });

  if (!est.presumptiveApplicable) {
    out.push(`⚠️ ${est.auditWarning}`);
  } else {
    if (p.grossReceipts > 0.9 * est.presumptive.limit) {
      out.push(`📈 You're close to the ${est.presumptive.scheme} presumptive cap (₹${est.presumptive.limit.toLocaleString("en-IN")}) — crossing it means books + audit.`);
    }
    if (est.tax && est.tax.total >= 10_000) {
      const at = advanceTaxDue(est.tax.total, true);
      out.push(`🗓️ Advance tax ≈ ₹${est.tax.total.toLocaleString("en-IN")} this year — ${at.note} I'll remind you before the date.`);
    }
  }
  return out.slice(0, 3);
}
