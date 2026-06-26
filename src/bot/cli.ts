/**
 * CLI simulator — talk to the full TaxEasy agent in your terminal, including
 * onboarding + persistence (exactly what a WhatsApp user experiences).
 *
 *   node src/bot/cli.ts                       # mock AI, in-memory
 *   GEMINI_API_KEY=xxx node src/bot/cli.ts    # real Gemini replies
 *   DATA_DIR=./.data node src/bot/cli.ts      # persist across runs (file store)
 *
 * Just start typing — the agent will onboard you, then answer. /quit to exit.
 */
import { createInterface } from "node:readline";
import { TaxEasyAgent } from "../agent/agent.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { FileEventStore, FileUserStore } from "../ports/file-store.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink((rec) => process.stderr.write(JSON.stringify(rec) + "\n")); // logs → stderr

const key = process.env["GEMINI_API_KEY"];
const llm: LlmClient = key
  ? new GeminiClient({ apiKey: key })
  : new MockLlmClient(() => "(mock AI) set GEMINI_API_KEY for a real reply.");

const dir = process.env["DATA_DIR"];
const users = dir ? new FileUserStore(dir) : new InMemoryUserStore();
const events = dir ? new FileEventStore(dir) : new InMemoryEventStore();
const agent = new TaxEasyAgent({ llm, users, events });
const userId = "cli-user";

console.log(`TaxEasy CLI — AI: ${llm.provider}${dir ? `, persisting to ${dir}` : ""}. Say hi to begin.\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "you ▸ " });
rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return rl.prompt();
  if (text === "/quit") return rl.close();
  rl.pause();
  try {
    const reply = await agent.handle(userId, text);
    console.log(`bot ▸ ${reply.text}\n`);
  } catch (err) {
    console.log(`bot ▸ (error) ${String(err)}\n`);
  }
  rl.resume();
  rl.prompt();
});

rl.on("close", () => {
  console.log("\nbye 👋");
  process.exit(0);
});
