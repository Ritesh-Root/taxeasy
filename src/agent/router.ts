/**
 * Intent router — the agent's decision layer.
 *
 * Order is deliberate and cost-aware:
 *   1. Static facts (deadlines, slabs, thresholds)  → engine ruleset, ZERO AI.
 *   2. Tax estimate                                  → hard-coded engine, ZERO AI math.
 *   3. Everything conversational                     → Gemini (fast tier).
 *
 * The AI NEVER produces a tax number. The engine computes; Gemini only explains
 * and converses. Every calculation carries the statutory disclaimer.
 */
import type { LlmClient } from "../ai/types.ts";
import { estimateTax, advanceTaxDue } from "../engine/index.ts";
import type { IncomeType, Regime } from "../engine/types.ts";
import { matchStaticAnswer } from "./static-answers.ts";
import { gstRegistrationAnswer, presumptiveEligibilityAnswer } from "./advisory.ts";
import { logEvent } from "../observability/log.ts";

export const DISCLAIMER =
  "⚠️ Calculations use published CBDT/CBIC rules for FY2025-26. Verify before filing. " +
  "TaxEasy is a calculation tool, not a CA firm.";

export interface UserProfile {
  userId: string;
  profession?: string;
  grossReceipts?: number;
  incomeType?: IncomeType;
  mostlyDigital?: boolean;
  regime?: Regime;
  /** Per-category data-sharing consent (DPDP). Missing/false ⇒ not shared. */
  consent?: Partial<Record<"income" | "gst" | "bank" | "bills" | "notices", boolean>>;
}

export type ReplySource = "static" | "engine" | "ai";

export interface AgentReply {
  text: string;
  source: ReplySource;
}

export interface RouterDeps {
  llm: LlmClient;
  /** Per-user adapted system prompt (from the user model). Falls back to default. */
  systemPrompt?: string;
}

export const SYSTEM_PROMPT =
  "You are TaxEasy, a financial assistant for Indian small-business owners on WhatsApp. " +
  "Be concise, use ₹, and match the user's language (English/Hindi/Hinglish). " +
  "You NEVER compute or state tax amounts yourself — those come only from the TaxEasy engine. " +
  "You explain, clarify, and guide. You compare options; you never 'recommend' (ICAI rules). " +
  "If asked for a number you don't have, ask the user to run an estimate.";

const ESTIMATE_RX = /\b(my tax|how much tax|calculate|estimate|kitna tax|tax kitna|liability)\b/i;
// Multilingual: "do I need GST", "mujhe GST lena padega", "GST chahiye", "GST lagega"
const GST_REG_RX = /(do i need gst|need gst|gst regist|register.*gst|gst lena|gst lega|gst chahiy|gst lagega|gst.*(zaroorat|required|threshold)|mujhe gst|जीएसटी)/i;
const PRESUMPTIVE_RX = /(presumptive.*(eligib|use|apply|qualif|scheme|allow|at my)|can i use (44ad|44ada|presumptive)|44ada?\b.*(eligib|use))/i;

export async function route(
  message: string,
  profile: UserProfile,
  deps: RouterDeps,
): Promise<AgentReply> {
  const text = message.trim();
  logEvent("message_in", { userId: profile.userId, chars: text.length });

  // 0) Engine-backed advisory (multilingual) — answer precisely from the profile
  //    instead of punting to generic AI (persona-sim finding).
  if (GST_REG_RX.test(text)) {
    const ans = gstRegistrationAnswer(profile);
    if (ans) {
      logEvent("engine_call", { userId: profile.userId, intent: "gst_registration" });
      return { text: `${ans}\n\n${DISCLAIMER}`, source: "engine" };
    }
  }
  if (PRESUMPTIVE_RX.test(text)) {
    const ans = presumptiveEligibilityAnswer(profile);
    if (ans) {
      logEvent("engine_call", { userId: profile.userId, intent: "presumptive_eligibility" });
      return { text: `${ans}\n\n${DISCLAIMER}`, source: "engine" };
    }
  }

  // 1) Static deterministic facts — no AI.
  const staticAns = matchStaticAnswer(text);
  if (staticAns) {
    logEvent("static_answer", { userId: profile.userId });
    return { text: staticAns, source: "static" };
  }

  // 2) Tax estimate — hard-coded engine, no AI math.
  if (ESTIMATE_RX.test(text)) {
    if (profile.profession && profile.grossReceipts != null) {
      const est = estimateTax({
        profession: profile.profession,
        grossReceipts: profile.grossReceipts,
        incomeType: profile.incomeType ?? "PROFESSION",
        ...(profile.mostlyDigital != null ? { mostlyDigital: profile.mostlyDigital } : {}),
        ...(profile.regime ? { regime: profile.regime } : {}),
      });
      logEvent("engine_call", {
        userId: profile.userId,
        scheme: est.presumptive.scheme,
        applicable: est.presumptiveApplicable,
        total: est.tax?.total ?? null,
      });
      // Over the presumptive cap → withhold the (falsely low) number; guide instead.
      if (!est.presumptiveApplicable || est.tax === null) {
        const reply = `⚠️ ${est.auditWarning}\n\n${DISCLAIMER}`;
        logEvent("message_out", { userId: profile.userId, source: "engine" });
        return { text: reply, source: "engine" };
      }
      const reply =
        `Scheme: ${est.presumptive.scheme} · presumptive income ₹${est.presumptive.presumptiveIncome.toLocaleString("en-IN")} ` +
        `(${Math.round(est.presumptive.rateApplied * 100)}% of ₹${est.presumptive.grossReceipts.toLocaleString("en-IN")}).\n` +
        `Estimated tax: ₹${est.tax.total.toLocaleString("en-IN")} (new regime).` +
        (est.tax.total === 0 ? " You're within the §87A rebate — ₹0 tax." : "") +
        `\n\n${DISCLAIMER}`;
      logEvent("message_out", { userId: profile.userId, source: "engine" });
      return { text: reply, source: "engine" };
    }
    // Profile incomplete → ask, still no AI needed.
    const ask =
      "To estimate your tax I need two things: (1) what you do (e.g. 'freelance developer', " +
      "'kirana store'), and (2) your yearly gross receipts/turnover. Send both and I'll calculate.";
    logEvent("message_out", { userId: profile.userId, source: "static" });
    return { text: ask, source: "static" };
  }

  // 3) Conversational — Gemini (fast tier), with the per-user adapted prompt.
  const res = await deps.llm.generate({
    tier: "fast",
    system: deps.systemPrompt ?? SYSTEM_PROMPT,
    messages: [{ role: "user", text }],
    temperature: 0.2,
  });
  logEvent("message_out", { userId: profile.userId, source: "ai", model: res.model });
  return { text: res.text, source: "ai" };
}
