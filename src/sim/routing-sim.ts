/**
 * Routing + language simulation. Runs a realistic, multi-language message corpus
 * through the agent and reports: routing split (static/engine/ai → cost & 429
 * exposure), language detection accuracy, and intent gaps.
 *
 *   node src/sim/routing-sim.ts
 */
import { route } from "../agent/router.ts";
import type { UserProfile, ReplySource } from "../agent/router.ts";
import { updateModel, defaultModel } from "../agent/user-model.ts";
import type { UserModelData } from "../ports/types.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

const llm = new MockLlmClient(() => "ok");
const profile: UserProfile = {
  userId: "sim", profession: "freelance developer", grossReceipts: 1_800_000, incomeType: "PROFESSION",
};

type Lang = "en" | "hi" | "hinglish";
interface Case { msg: string; wantSource?: ReplySource; wantLang?: Lang }

const corpus: Case[] = [
  // deterministic facts → should be static (zero AI)
  { msg: "when is GSTR-3B due?", wantSource: "static" },
  { msg: "do I need GST registration?", wantSource: "static" },
  { msg: "advance tax dates please", wantSource: "static" },
  { msg: "what are the new regime slabs?", wantSource: "static" },
  { msg: "when is the ITR deadline?", wantSource: "static" },
  { msg: "tell me about LUT renewal for exports", wantSource: "static" },
  // estimate → engine (zero AI math)
  { msg: "how much tax do I owe?", wantSource: "engine" },
  { msg: "calculate my tax", wantSource: "engine" },
  { msg: "kitna tax dena hai mujhe?", wantSource: "engine", wantLang: "hinglish" },
  // genuinely conversational → ai
  { msg: "explain presumptive taxation simply", wantSource: "ai" },
  { msg: "hello", wantSource: "ai" },
  { msg: "why is my electricity bill so high this month?", wantSource: "ai" },
  { msg: "should I switch to old regime?", wantSource: "ai" },
  // language detection probes
  { msg: "मेरा टैक्स कितना है", wantLang: "hi" },
  { msg: "bhai gst number kaise banta hai batao", wantLang: "hinglish" },
  // tricky: looks factual but phrased open — likely falls to AI (a GAP if so)
  { msg: "is my GST filing late and what's the penalty?", wantSource: "static" },
  { msg: "remind me about my deadlines", wantSource: "static" },
];

const counts: Record<ReplySource, number> = { static: 0, engine: 0, ai: 0 };
const misroutes: string[] = [];
let langCorrect = 0, langTotal = 0;

for (const c of corpus) {
  const reply = await route(c.msg, profile, { llm });
  counts[reply.source]++;
  if (c.wantSource && reply.source !== c.wantSource) {
    misroutes.push(`"${c.msg}" → ${reply.source} (wanted ${c.wantSource})`);
  }
  if (c.wantLang) {
    langTotal++;
    const m: UserModelData = updateModel(defaultModel(), c.msg);
    if (m.language === c.wantLang) langCorrect++;
    else misroutes.push(`lang "${c.msg}" → ${m.language} (wanted ${c.wantLang})`);
  }
}

const total = corpus.length;
const aiPct = (100 * counts.ai) / total;
console.log("=== ROUTING + LANGUAGE SIM ===\n");
console.log(`messages: ${total}`);
console.log(`routing split → static ${counts.static} | engine ${counts.engine} | ai ${counts.ai}`);
console.log(`AI share: ${aiPct.toFixed(0)}%  (each AI msg = cost + 429 exposure)`);
console.log(`language detection: ${langCorrect}/${langTotal} correct`);
console.log("\nMISROUTES / GAPS:");
if (misroutes.length === 0) console.log("  (none)");
for (const m of misroutes) console.log("  • " + m);
console.log(`\n${misroutes.length} routing/lang issue(s).`);
