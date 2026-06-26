/**
 * The adaptive layer. A UserModel captures who this customer is and how they
 * like to be spoken to; it is updated every turn from their messages and drives
 * the agent's behaviour (language, verbosity, tier, persona context).
 *
 * This is what makes one codebase serve Dr. Mehta (detailed English) and Arjun
 * the gig worker (one-line Hinglish) differently — automatically.
 */
import type { UserModelData } from "../ports/types.ts";

export function defaultModel(): UserModelData {
  return {
    language: "en",
    verbosity: "normal",
    techLevel: "medium",
    knownFacts: [],
    messageCount: 0,
  };
}

const DEVANAGARI = /[ऀ-ॿ]/;
// Common romanised-Hindi tokens → detect Hinglish even in Latin script.
const HINGLISH_TOKENS = /\b(kitna|kaise|kya|nahi|haan|mera|mujhe|paisa|hai|kar|bhai|chahiye|batao)\b/i;

/** Learn from one inbound message and return the updated model (pure). */
export function updateModel(model: UserModelData, message: string): UserModelData {
  const next: UserModelData = { ...model, knownFacts: [...model.knownFacts], messageCount: model.messageCount + 1 };

  // Language: Devanagari → hi; romanised Hindi tokens → hinglish; else keep/Englishl.
  if (DEVANAGARI.test(message)) next.language = "hi";
  else if (HINGLISH_TOKENS.test(message)) next.language = "hinglish";

  // Verbosity: very short messages ⇒ this user wants brief; long detailed ones ⇒ detailed.
  const len = message.trim().length;
  if (len <= 25) next.verbosity = "brief";
  else if (len >= 120) next.verbosity = "detailed";

  return next;
}

/** Apply a detected segment (from onboarding) — adjusts default tech level. */
export function applySegment(model: UserModelData, segment: NonNullable<UserModelData["segment"]>): UserModelData {
  const techLevel = segment === "gig" ? "low" : segment === "professional" ? "high" : "medium";
  return { ...model, segment, techLevel };
}

const LANG_INSTRUCTION: Record<UserModelData["language"], string> = {
  en: "Reply in clear English.",
  hi: "Reply in Hindi (Devanagari).",
  hinglish: "Reply in Hinglish (Hindi+English mix, Latin script) — casual and friendly.",
};

const VERBOSITY_INSTRUCTION: Record<UserModelData["verbosity"], string> = {
  brief: "Keep it to ONE short line. No preamble.",
  normal: "Be concise — 2-4 short lines.",
  detailed: "Give a thorough, structured answer with the reasoning.",
};

/** Compose the per-user system prompt from a base + the user model. */
export function adaptSystemPrompt(base: string, model: UserModelData): string {
  const parts = [base, LANG_INSTRUCTION[model.language], VERBOSITY_INSTRUCTION[model.verbosity]];
  if (model.segment) parts.push(`The user is a ${model.segment.replace("_", " ")} (tax-relevant context).`);
  if (model.techLevel === "low") parts.push("Assume low financial/tech literacy — avoid jargon, explain simply.");
  if (model.knownFacts.length) parts.push(`Known about this user: ${model.knownFacts.join("; ")}.`);
  return parts.join(" ");
}
