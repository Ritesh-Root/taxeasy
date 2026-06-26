/**
 * Runtime tests with a fake in-memory channel — proves dedupe + reply wiring
 * without any network/transport. (Same guarantees apply to OpenWA/Telegram/BSP.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "./serve.ts";
import type { Channel, InboundMessage } from "../ports/channel.ts";
import { TaxEasyAgent } from "../agent/agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

/** A channel that replays a fixed list of inbound messages and records replies. */
class FakeChannel implements Channel {
  readonly name = "fake";
  readonly sent: { userId: string; text: string }[] = [];
  #inbound: InboundMessage[];
  constructor(inbound: InboundMessage[]) {
    this.#inbound = inbound;
  }
  async send(userId: string, text: string): Promise<void> {
    this.sent.push({ userId, text });
  }
  async start(onMessage: (m: InboundMessage) => Promise<void>): Promise<void> {
    for (const m of this.#inbound) await onMessage(m);
  }
}

function makeAgent() {
  return new TaxEasyAgent({
    llm: new MockLlmClient(() => "ok"),
    users: new InMemoryUserStore(),
    events: new InMemoryEventStore(),
  });
}

test("serve answers each message and dedupes repeated message ids", async () => {
  const ch = new FakeChannel([
    { userId: "u1", text: "when is GSTR-3B due?", messageId: "m1" },
    { userId: "u1", text: "when is GSTR-3B due?", messageId: "m1" }, // duplicate re-delivery
    { userId: "u1", text: "hello there", messageId: "m2" },
  ]);
  await serve(ch, makeAgent());

  // m1 answered once (dedupe), m2 answered once → 2 replies total.
  assert.equal(ch.sent.length, 2);
  assert.match(ch.sent[0]?.text ?? "", /20th/); // static GST answer
});

test("serve isolates errors — a failing turn still replies gracefully", async () => {
  const ch = new FakeChannel([{ userId: "u9", text: "boom", messageId: "x1" }]);
  const agent = new TaxEasyAgent({
    llm: new MockLlmClient(() => { throw new Error("model down"); }),
    users: new InMemoryUserStore(),
    events: new InMemoryEventStore(),
  });
  await serve(ch, agent);
  assert.equal(ch.sent.length, 1);
  assert.match(ch.sent[0]?.text ?? "", /something went wrong/i);
});
