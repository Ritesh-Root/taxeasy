/**
 * Multi-channel entry point — runs every configured platform against one agent.
 * The user picks whichever messaging app they're comfortable with.
 *
 *   TELEGRAM_TOKEN=xxx GEMINI_API_KEY=yyy node src/bot/multi.ts        # Telegram only
 *   TELEGRAM_TOKEN=xxx OPENWA_API_KEY=zzz WEBHOOK_SECRET=s node src/bot/multi.ts  # + WhatsApp
 *
 * Channels are enabled by presence of their env vars. Add a new platform = add an
 * adapter implementing the Channel port and one line here.
 */
import { TaxEasyAgent } from "../agent/agent.ts";
import { serveAll } from "../runtime/serve-all.ts";
import { TelegramChannel } from "../channels/telegram.ts";
import { OpenWaChannel } from "../channels/openwa.ts";
import { GeminiClient } from "../ai/gemini.ts";
import { MockLlmClient } from "../ai/mock.ts";
import type { Channel } from "../ports/channel.ts";
import type { LlmClient } from "../ai/types.ts";
import { FileEventStore, FileUserStore } from "../ports/file-store.ts";

const geminiKey = process.env["GEMINI_API_KEY"];
const llm: LlmClient = geminiKey ? new GeminiClient({ apiKey: geminiKey }) : new MockLlmClient();

const dataDir = process.env["DATA_DIR"] ?? "./.data";
const agent = new TaxEasyAgent({ llm, users: new FileUserStore(dataDir), events: new FileEventStore(dataDir) });

const channels: Channel[] = [];

const telegramToken = process.env["TELEGRAM_TOKEN"];
if (telegramToken) channels.push(new TelegramChannel({ token: telegramToken }));

const openwaKey = process.env["OPENWA_API_KEY"];
if (openwaKey) {
  channels.push(new OpenWaChannel({
    apiKey: openwaKey,
    baseUrl: process.env["OPENWA_BASE_URL"] ?? "http://localhost:2785",
    session: process.env["OPENWA_SESSION"] ?? "default",
    webhookPort: Number(process.env["WEBHOOK_PORT"] ?? 3000),
    webhookSecret: process.env["WEBHOOK_SECRET"],
    allowInsecure: process.env["ALLOW_INSECURE_WEBHOOK"] === "1",
  }));
}

if (channels.length === 0) {
  console.error("No channels configured. Set TELEGRAM_TOKEN and/or OPENWA_API_KEY.");
  process.exit(1);
}

console.log(`TaxEasy multi-channel — AI: ${llm.provider} · channels: ${channels.map((c) => c.name).join(", ")}`);
await serveAll(channels, agent);
