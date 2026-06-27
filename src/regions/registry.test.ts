/**
 * International region selection: matching, support gating, and the legal-safety
 * rule that unsupported regions are waitlisted (no tax numbers emitted).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRegion, isSupportedRegion, formatMoney, REGIONS } from "./registry.ts";
import { TaxEasyAgent } from "../agent/agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("matchRegion handles names, codes, aliases, and Hindi", () => {
  assert.equal(matchRegion("India")?.code, "IN");
  assert.equal(matchRegion("भारत")?.code, "IN");
  assert.equal(matchRegion("usa")?.code, "US");
  assert.equal(matchRegion("United Kingdom")?.code, "GB");
  assert.equal(matchRegion("dubai")?.code, "AE");
  assert.equal(matchRegion("atlantis"), null);
});

test("only India is a supported tax region today", () => {
  assert.equal(isSupportedRegion("IN"), true);
  assert.equal(isSupportedRegion("US"), false);
  assert.equal(isSupportedRegion(undefined), true); // legacy users default to India
});

test("formatMoney is region-aware", () => {
  assert.equal(formatMoney(REGIONS["IN"]!, 1_800_000), "₹18,00,000");
  assert.match(formatMoney(REGIONS["US"]!, 1_800_000), /^\$1,800,000$/);
});

test("unsupported region → waitlisted, no tax flow, no AI", async () => {
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users: new InMemoryUserStore(), events: new InMemoryEventStore() });
  const u = "wa-1us";
  const r0 = await agent.handle(u, "hi");
  assert.match(r0.text, /country/i); // region prompt
  const r1 = await agent.handle(u, "USA");
  assert.match(r1.text, /isn't live in United States|early-access/i); // coming-soon
  // Any later message stays in waitlist mode — never computes tax.
  const r2 = await agent.handle(u, "how much tax do I owe?");
  assert.match(r2.text, /United States|early-access/i);
  assert.doesNotMatch(r2.text, /presumptive|₹/);
});

test("supported region (India) proceeds into the normal flow", async () => {
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users: new InMemoryUserStore(), events: new InMemoryEventStore() });
  const u = "wa-91in";
  await agent.handle(u, "hello");
  const r = await agent.handle(u, "India");
  assert.match(r.text, /work|business/i); // moves on to the profession question
});
