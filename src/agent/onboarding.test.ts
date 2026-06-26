/**
 * End-to-end onboarding: a brand-new user is walked through 4 steps, learns
 * their language, ends with a persisted profile + first estimate, and afterwards
 * routes normally (tax question → engine).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TaxEasyAgent } from "./agent.ts";
import { parseAmount, handleOnboarding } from "./onboarding.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("parseAmount handles Indian formats", () => {
  assert.equal(parseAmount("18,00,000"), 1_800_000);
  assert.equal(parseAmount("18 lakh"), 1_800_000);
  assert.equal(parseAmount("1.2 cr"), 12_000_000);
  assert.equal(parseAmount("nope"), null);
});

test("full onboarding flow → profile captured, first estimate, then normal routing", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  const u = "wa-919999";

  const r0 = await agent.handle(u, "hi");
  assert.match(r0.text, /Welcome/);

  const r1 = await agent.handle(u, "freelance software developer");
  assert.match(r1.text, /44ADA/); // detected professional scheme
  assert.match(r1.text, /turnover/i);

  const r2 = await agent.handle(u, "18 lakh");
  assert.match(r2.text, /digitally|cash/i);

  const r3 = await agent.handle(u, "digital");
  assert.match(r3.text, /data may I use/i);

  const r4 = await agent.handle(u, "income, bills");
  assert.match(r4.text, /all set/i);
  assert.match(r4.text, /₹0 tax/); // ₹18L 44ADA → ₹0, shown as first value

  // Profile persisted correctly.
  const stored = await users.get(u);
  assert.equal(stored?.onboarding?.complete, true);
  assert.equal(stored?.profile.grossReceipts, 1_800_000);
  assert.equal(stored?.profile.incomeType, "PROFESSION");
  assert.equal(stored?.profile.consent?.income, true);
  assert.equal(stored?.profile.consent?.bills, true);
  assert.equal(stored?.model.segment, "professional");

  // Now onboarded → a tax question routes to the engine, not onboarding.
  const r5 = await agent.handle(u, "how much tax do I owe?");
  assert.equal(r5.source, "engine");
  assert.match(r5.text, /₹0 tax/);
});

test("turnover step re-asks on unparseable input", () => {
  const res = handleOnboarding("turnover", "dunno", { profession: "dev", incomeType: "PROFESSION" });
  assert.equal(res.nextStep, "turnover");
  assert.equal(res.complete, false);
});

test("kirana store onboarding → 44AD trader segment", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  const u = "wa-918888";
  await agent.handle(u, "namaste");
  const r = await agent.handle(u, "kirana store");
  assert.match(r.text, /44AD\b/);
  await agent.handle(u, "60 lakh");
  await agent.handle(u, "cash");
  await agent.handle(u, "all");
  assert.equal((await users.get(u))?.model.segment, "trader");
  assert.equal((await users.get(u))?.profile.mostlyDigital, false);
});
