/**
 * Telegram adapter parsing + multi-platform identity namespacing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTelegramUpdate } from "./telegram.ts";
import { serve } from "../runtime/serve.ts";
import type { Channel, InboundMessage } from "../ports/channel.ts";
import { TaxEasyAgent } from "../agent/agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("parseTelegramUpdate maps text messages and skips bots/non-text", () => {
  const ok = parseTelegramUpdate({ update_id: 5, message: { message_id: 9, from: { id: 1 }, chat: { id: 42 }, text: "hi" } });
  assert.deepEqual(ok, { userId: "42", text: "hi", messageId: "9" });
  assert.equal(parseTelegramUpdate({ update_id: 6, message: { message_id: 1, from: { id: 1, is_bot: true }, chat: { id: 42 }, text: "x" } }), null);
  assert.equal(parseTelegramUpdate({ update_id: 7 }), null); // no message
});

class OneShot implements Channel {
  readonly name: string;
  readonly sent: { userId: string; text: string }[] = [];
  #msg: InboundMessage;
  constructor(name: string, msg: InboundMessage) { this.name = name; this.#msg = msg; }
  async send(userId: string, text: string) { this.sent.push({ userId, text }); }
  async start(on: (m: InboundMessage) => Promise<void>) { await on(this.#msg); }
}

test("user state is namespaced per platform (telegram:42 ≠ whatsapp:42), reply uses raw id", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });

  await serve(new OneShot("telegram", { userId: "42", text: "hi", messageId: "1" }), agent);
  await serve(new OneShot("whatsapp", { userId: "42", text: "hi", messageId: "1" }), agent);

  const ids = (await users.all()).map((u) => u.userId).sort();
  assert.deepEqual(ids, ["telegram:42", "whatsapp:42"]); // separate accounts, no collision
});

test("reply is sent back to the raw transport id", async () => {
  const ch = new OneShot("telegram", { userId: "42", text: "hi", messageId: "1" });
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users: new InMemoryUserStore(), events: new InMemoryEventStore() });
  await serve(ch, agent);
  assert.equal(ch.sent[0]?.userId, "42"); // not "telegram:42"
});
