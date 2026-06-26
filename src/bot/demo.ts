/**
 * Scripted end-to-end demo: a new user is onboarded, then asks questions.
 * Deterministic, ordered output — smoke test + hackathon video footage.
 *
 *   node src/bot/demo.ts                       # mock AI
 *   GEMINI_API_KEY=xxx node src/bot/demo.ts    # real Gemini for the chat turn
 */
import { TaxEasyAgent } from "../agent/agent.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink((rec) => process.stderr.write(JSON.stringify(rec) + "\n"));

const key = process.env["GEMINI_API_KEY"];
const llm: LlmClient = key
  ? new GeminiClient({ apiKey: key })
  : new MockLlmClient(() => "(mock) Presumptive tax = declare a flat % of income, skip detailed books.");

const agent = new TaxEasyAgent({ llm, users: new InMemoryUserStore(), events: new InMemoryEventStore() });
const u = "demo-user";

const script = [
  "hi",                              // → welcome
  "freelance software developer",    // → onboarding: profession
  "18 lakh",                         // → onboarding: turnover
  "digital",                         // → onboarding: mode
  "income, bills",                   // → onboarding: consent → first estimate
  "when is GSTR-3B due?",            // → static (no AI)
  "how much tax do I owe?",          // → engine (no AI)
  "explain presumptive tax simply",  // → AI
];

console.log(`TaxEasy demo — AI: ${llm.provider}\n`);
for (const msg of script) {
  const reply = await agent.handle(u, msg);
  console.log(`you ▸ ${msg}`);
  console.log(`bot ▸ ${reply.text}`);
  console.log(`      [${reply.source}]\n`);
}
