/**
 * Multilingual proof: a Hindi (Devanagari) user is onboarded in Hindi, a
 * Hinglish user in Hinglish, and engine-backed advisory answers localize — while
 * ₹ figures stay identical across languages (never mistranslated).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { t } from "./i18n.ts";
import { gstRegistrationAnswer } from "./advisory.ts";
import { TaxEasyAgent } from "./agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

const DEVANAGARI = /[ऀ-ॿ]/;

test("t() injects ₹ vars identically across languages and falls back to en", () => {
  const vars = { amount: "60,00,000" };
  assert.match(t("onboard.turnover_ack", "en", vars), /60,00,000/);
  assert.match(t("onboard.turnover_ack", "hi", vars), /60,00,000/);
  assert.match(t("onboard.turnover_ack", "hi", vars), DEVANAGARI); // Hindi prose
  assert.equal(t("nonexistent.key", "hi"), "nonexistent.key");
});

test("Hindi (Devanagari) user is onboarded in Hindi", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  const u = "hi-user";
  const r0 = await agent.handle(u, "नमस्ते");
  assert.equal(r0.lang, "hi");
  assert.match(r0.text, DEVANAGARI); // region prompt in Hindi
  await agent.handle(u, "भारत"); // region → India (supported)
  const r1 = await agent.handle(u, "किराना दुकान");
  assert.match(r1.text, DEVANAGARI);
  assert.match(r1.text, /44AD\b/); // numbers/scheme codes stay as-is
});

test("Hinglish user is onboarded in Hinglish (Latin, not English template)", async () => {
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  const u = "hin-user";
  const r0 = await agent.handle(u, "bhai namaste");
  assert.equal(r0.lang, "hinglish");
  assert.match(r0.text, /swagat/); // Hinglish welcome, not "Welcome to TaxEasy"
  assert.doesNotMatch(r0.text, /Welcome to TaxEasy/);
});

test("engine-backed GST advisory localizes; ₹ numbers unchanged", () => {
  const profile = { profession: "kirana store", grossReceipts: 6_000_000, incomeType: "BUSINESS" as const };
  const en = gstRegistrationAnswer(profile, "en")!;
  const hi = gstRegistrationAnswer(profile, "hi")!;
  assert.match(en, /registration required/);
  assert.match(hi, DEVANAGARI);
  assert.match(en, /60,00,000/);
  assert.match(hi, /60,00,000/); // same figure in both
});
