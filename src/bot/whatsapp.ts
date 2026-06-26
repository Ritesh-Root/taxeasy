/**
 * WhatsApp entry point (via OpenWA, interim transport).
 *
 * Run AFTER your OpenWA gateway is up and a session is connected:
 *   OPENWA_API_KEY=xxx GEMINI_API_KEY=yyy node src/bot/whatsapp.ts
 *
 * Env:
 *   OPENWA_API_KEY   (required)  X-API-Key for your OpenWA gateway
 *   OPENWA_BASE_URL  (default http://localhost:2785)
 *   OPENWA_SESSION   (default "default")
 *   WEBHOOK_PORT     (default 3000)   point OpenWA's webhook to http://<host>:PORT/webhook
 *   WEBHOOK_SECRET   (recommended)    HMAC secret shared with OpenWA
 *   GEMINI_API_KEY   (optional)       falls back to mock AI if absent
 *
 * To switch to the official WhatsApp BSP later: replace OpenWaChannel with the
 * BSP adapter — nothing else changes.
 */
import { TaxEasyAgent } from "../agent/agent.ts";
import { serve } from "../runtime/serve.ts";
import { OpenWaChannel } from "../channels/openwa.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { LlmClient } from "../ai/types.ts";
import { FileEventStore, FileUserStore } from "../ports/file-store.ts";

const apiKey = process.env["OPENWA_API_KEY"];
if (!apiKey) {
  console.error("Set OPENWA_API_KEY (and ideally WEBHOOK_SECRET, GEMINI_API_KEY).");
  process.exit(1);
}

const geminiKey = process.env["GEMINI_API_KEY"];
const llm: LlmClient = geminiKey ? new GeminiClient({ apiKey: geminiKey }) : new MockLlmClient();

// Durable file store (survives restarts). Swap to a Firestore adapter — same
// ports — when GCP creds land; the events.jsonl file is your portable log.
const dataDir = process.env["DATA_DIR"] ?? "./.data";
const agent = new TaxEasyAgent({ llm, users: new FileUserStore(dataDir), events: new FileEventStore(dataDir) });

const channel = new OpenWaChannel({
  apiKey,
  baseUrl: process.env["OPENWA_BASE_URL"] ?? "http://localhost:2785",
  session: process.env["OPENWA_SESSION"] ?? "default",
  webhookPort: Number(process.env["WEBHOOK_PORT"] ?? 3000),
  webhookSecret: process.env["WEBHOOK_SECRET"],
  // Without WEBHOOK_SECRET the channel fails closed; opt into insecure for dev only.
  allowInsecure: process.env["ALLOW_INSECURE_WEBHOOK"] === "1",
});

console.log(`TaxEasy WhatsApp (OpenWA) — AI: ${llm.provider}. Listening for webhooks…`);
await serve(channel, agent);
