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

test("parseAmount handles Indian formats incl. Hindi", () => {
  assert.equal(parseAmount("18,00,000"), 1_800_000);
  assert.equal(parseAmount("18 lakh"), 1_800_000);
  assert.equal(parseAmount("1.2 cr"), 12_000_000);
  assert.equal(parseAmount("60 लाख"), 6_000_000); // Devanagari word
  assert.equal(parseAmount("१८ लाख"), 1_800_000); // Devanagari digits + word
  assert.equal(parseAmount("1.2 करोड़"), 12_000_000);
  assert.equal(parseAmount("nope"), null);
});

test("full onboarding flow → profile captured, first estimate, then normal routing", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  const u = "wa-919999";

  const r0 = await agent.handle(u, "hi");
  assert.match(r0.text, /Welcome/); // region prompt
  await agent.handle(u, "India"); // region → supported

  const r1 = await agent.handle(u, "freelance software developer");
  assert.match(r1.text, /44ADA/); // detected professional scheme
  assert.match(r1.text, /2\/4 — Which state .* GST-registered/);

  const r2 = await agent.handle(u, "Odisha, not registered");
  assert.match(r2.text, /Odisha, not GST-registered/);
  assert.match(r2.text, /3\/4 — Roughly, your yearly turnover/);

  const r3 = await agent.handle(u, "18 lakh");
  assert.match(r3.text, /4\/4 — What do you want help with/);

  const r4 = await agent.handle(u, "income, bills");
  assert.match(r4.text, /all set/i);
  assert.match(r4.text, /₹0 tax/); // ₹18L 44ADA → ₹0, shown as first value

  // Profile persisted correctly.
  const stored = await users.get(u);
  assert.equal(stored?.onboarding?.complete, true);
  assert.equal(stored?.profile.region, "IN");
  assert.equal(stored?.profile.state, "21");
  assert.equal(stored?.profile.gstRegistered, false);
  assert.equal(stored?.profile.mostlyDigital, true); // no "cash" in the turnover answer
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
  await agent.handle(u, "India"); // region step
  const r = await agent.handle(u, "kirana store");
  assert.match(r.text, /44AD\b/);
  await agent.handle(u, "21ABCDE1234F1Z5"); // GSTIN → registered, state from its first two digits
  await agent.handle(u, "60 lakh cash");
  await agent.handle(u, "all");
  const p = (await users.get(u))?.profile;
  assert.equal((await users.get(u))?.model.segment, "trader");
  assert.equal(p?.mostlyDigital, false);
  assert.equal(p?.gstin, "21ABCDE1234F1Z5");
  assert.equal(p?.gstRegistered, true);
  assert.equal(p?.state, "21");
});

test("state step: Hindi state name works, nothing recognisable re-asks", () => {
  const hi = handleOnboarding("state", "ओडिशा, रजिस्टर्ड नहीं", {}, "hi");
  assert.equal(hi.profilePatch.state, "21");
  assert.equal(hi.profilePatch.gstRegistered, false);
  assert.equal(hi.nextStep, "turnover");
  assert.equal(handleOnboarding("state", "dunno", {}).nextStep, "state");
});

test("a user who was mid-onboarding at the old payment-mode step still finishes", () => {
  const res = handleOnboarding("mode", "cash", { profession: "kirana", grossReceipts: 6_000_000 });
  assert.equal(res.nextStep, "consent");
  assert.equal(res.profilePatch.mostlyDigital, false);
});
