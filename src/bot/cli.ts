/**
 * CLI simulator — talk to the TaxEasy agent in your terminal.
 *
 *   node src/bot/cli.ts                 # mock AI (no key needed) — try the whole loop offline
 *   GEMINI_API_KEY=xxx node src/bot/cli.ts   # real Gemini for conversational replies
 *
 * Commands inside the chat:
 *   /profession <text>   set your work (e.g. /profession freelance developer)
 *   /gross <number>      set yearly gross receipts (e.g. /gross 1800000)
 *   /quit
 */
import { createInterface } from "node:readline";
import { route } from "../agent/router.ts";
import type { UserProfile } from "../agent/router.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { setLogSink } from "../observability/log.ts";

// Keep the chat readable: send execution logs to stderr, not the conversation.
setLogSink((rec) => process.stderr.write(JSON.stringify(rec) + "\n"));

const key = process.env["GEMINI_API_KEY"];
const llm: LlmClient = key
  ? new GeminiClient({ apiKey: key })
  : new MockLlmClient(() => "(mock AI) I'd explain that in plain Hinglish here — set GEMINI_API_KEY for the real reply.");

const profile: UserProfile = { userId: "cli-user" };

console.log(`TaxEasy CLI — AI provider: ${llm.provider}`);
console.log("Try: 'when is GSTR-3B due?' · '/profession freelance developer' then '/gross 1800000' then 'my tax?'\n");

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "you ▸ " });
rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return rl.prompt();
  if (text === "/quit") return rl.close();
  rl.pause(); // hold input until this turn finishes (keeps piped input in order)
  if (text.startsWith("/profession ")) {
    profile.profession = text.slice("/profession ".length).trim();
    console.log(`bot ▸ Got it — noted you as: ${profile.profession}\n`);
  } else if (text.startsWith("/gross ")) {
    profile.grossReceipts = Number(text.slice("/gross ".length).replace(/[^0-9]/g, ""));
    console.log(`bot ▸ Noted yearly gross ₹${profile.grossReceipts.toLocaleString("en-IN")}\n`);
  } else {
    try {
      const reply = await route(text, profile, { llm });
      console.log(`bot ▸ ${reply.text}\n   [${reply.source}]\n`);
    } catch (err) {
      console.log(`bot ▸ (error) ${String(err)}\n`);
    }
  }
  rl.resume();
  rl.prompt();
});

rl.on("close", () => {
  console.log("\nbye 👋");
  process.exit(0);
});
