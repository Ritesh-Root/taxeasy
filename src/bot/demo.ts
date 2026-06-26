/**
 * Scripted demo of the agent loop — deterministic, ordered output.
 *
 *   node src/bot/demo.ts                       # mock AI
 *   GEMINI_API_KEY=xxx node src/bot/demo.ts    # real Gemini for the conversational turn
 *
 * Doubles as a smoke test and as footage for the hackathon demo video.
 */
import { route } from "../agent/router.ts";
import type { UserProfile } from "../agent/router.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink((rec) => process.stderr.write(JSON.stringify(rec) + "\n")); // logs → stderr

const key = process.env["GEMINI_API_KEY"];
const llm: LlmClient = key
  ? new GeminiClient({ apiKey: key })
  : new MockLlmClient(() => "(mock) Presumptive tax means you declare a flat % of income and skip detailed books.");

const profile: UserProfile = {
  userId: "demo",
  profession: "freelance software developer",
  grossReceipts: 1_800_000,
  incomeType: "PROFESSION",
};

const script = [
  "when is GSTR-3B due?",
  "do I need GST registration?",
  "how much tax do I owe this year?",
  "explain presumptive tax to me simply",
];

console.log(`TaxEasy demo — AI provider: ${llm.provider}\n`);
for (const msg of script) {
  const reply = await route(msg, profile, { llm });
  console.log(`you ▸ ${msg}`);
  console.log(`bot ▸ ${reply.text}`);
  console.log(`      [${reply.source}]\n`);
}
