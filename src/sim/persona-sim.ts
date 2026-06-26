/**
 * Client simulation — diverse Indian small-business personas USE the live agent
 * (onboarding + their real concerns). Captures transcripts + friction metrics so
 * we can see where a user would feel uneasy and where the agent fails to be the
 * proactive "CA" we want it to be.
 *
 *   node src/sim/persona-sim.ts                       # scripted personas, mock agent-AI
 *   GEMINI_API_KEY=xxx node src/sim/persona-sim.ts    # scripted personas, REAL agent-AI
 *   GEMINI_API_KEY=xxx node src/sim/persona-sim.ts --llm   # Gemini Flash role-plays the clients (emergent)
 *
 * Transcripts → sim/out/persona_<id>.txt
 */
import { mkdir, writeFile } from "node:fs/promises";
import { TaxEasyAgent } from "../agent/agent.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";
import { PERSONAS } from "./personas.ts";
import type { Persona } from "./personas.ts";

setLogSink(() => {});

const key = process.env["GEMINI_API_KEY"];
const useLlmPersonas = process.argv.includes("--llm") && !!key;
const agentLlm: LlmClient = key ? new GeminiClient({ apiKey: key }) : new MockLlmClient();
const personaLlm: LlmClient | null = useLlmPersonas ? new GeminiClient({ apiKey: key! }) : null;
const OUT = "sim/out";

const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

interface Metrics {
  turns: number;
  static: number;
  engine: number;
  ai: number;
  langMismatch: number; // non-English persona got an English templated reply
}

/** Ask Gemini Flash to produce this persona's next message (emergent mode). */
async function personaNext(persona: Persona, history: { who: "bot" | "you"; text: string }[], llm: LlmClient): Promise<string> {
  const system =
    `You are role-playing ${persona.name}: ${persona.blurb}. You are chatting with a tax/finance ` +
    `assistant on WhatsApp. Speak naturally in ${persona.lang}. Send ONE short message per turn, like a real ` +
    `WhatsApp user (no narration). Pursue your goals: ${persona.goals.join("; ")}. Answer onboarding questions ` +
    `realistically. If satisfied or annoyed, you may end with "bye".`;
  const messages = history.map((h) => ({ role: (h.who === "you" ? "model" : "user") as "model" | "user", text: h.text }));
  if (messages.length === 0) messages.push({ role: "user", text: "(the assistant is waiting for your first message)" });
  const res = await llm.generate({ tier: "fast", system, messages, temperature: 0.8 });
  return res.text.trim() || "ok";
}

async function runPersona(persona: Persona): Promise<{ metrics: Metrics; transcript: string }> {
  const agent = new TaxEasyAgent({ llm: agentLlm, users: new InMemoryUserStore(), events: new InMemoryEventStore() });
  const userId = `sim-${persona.id}`;
  const history: { who: "bot" | "you"; text: string }[] = [];
  const m: Metrics = { turns: 0, static: 0, engine: 0, ai: 0, langMismatch: 0 };
  const lines: string[] = [`# ${persona.name}  [${persona.lang}]`, `goals: ${persona.goals.join("; ")}`, ""];

  const maxTurns = useLlmPersonas ? 9 : persona.script.length;
  for (let i = 0; i < maxTurns; i++) {
    const userMsg = useLlmPersonas ? await personaNext(persona, history, personaLlm!) : persona.script[i]!;
    if (/^bye\b/i.test(userMsg)) break;
    history.push({ who: "you", text: userMsg });
    lines.push(`you ▸ ${userMsg}`);

    const reply = await agent.handle(userId, userMsg);
    history.push({ who: "bot", text: reply.text });
    lines.push(`bot ▸ ${reply.text}`, `      [${reply.source}]`, "");

    m.turns++;
    m[reply.source]++;
    // Non-English persona getting an English template (static/engine) = friction.
    if (persona.lang !== "en" && reply.source !== "ai" && !hasDevanagari(reply.text)) m.langMismatch++;
  }
  return { metrics: m, transcript: lines.join("\n") };
}

await mkdir(OUT, { recursive: true });
console.log(`=== CLIENT SIMULATION (${useLlmPersonas ? "LLM-driven" : "scripted"} personas, agent-AI=${agentLlm.provider}) ===\n`);
console.log("persona            turns  static  engine  ai   ai%   langMiss");

let totAi = 0, totTurns = 0, totMiss = 0;
for (const p of PERSONAS) {
  const { metrics: m, transcript } = await runPersona(p);
  await writeFile(`${OUT}/persona_${p.id}.txt`, transcript);
  const aiPct = Math.round((100 * m.ai) / Math.max(m.turns, 1));
  totAi += m.ai; totTurns += m.turns; totMiss += m.langMismatch;
  console.log(
    `${p.id.padEnd(18)} ${String(m.turns).padStart(4)}  ${String(m.static).padStart(5)}  ` +
    `${String(m.engine).padStart(5)}  ${String(m.ai).padStart(3)}  ${String(aiPct).padStart(3)}%  ${String(m.langMismatch).padStart(6)}`,
  );
}
console.log(
  `\nTOT:  ${totTurns} turns · AI-share ${Math.round((100 * totAi) / totTurns)}% ` +
  `(each AI turn = the agent had no structured/proactive answer) · language mismatches ${totMiss}`,
);
console.log(`Transcripts in ${OUT}/`);
