/**
 * Phase B — advisory depth: the agent answers the exact "uneasy" moments the
 * persona sim caught (value-pivot, notice fear, reassurance) instead of punting,
 * in the user's language, plus date-driven proactive triggers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { route } from "./router.ts";
import type { UserProfile } from "./router.ts";
import { valuePivotAnswer, reassuranceAnswer, proactiveTriggers } from "./advisory.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

const arjun: UserProfile = { userId: "arjun", profession: "rapido captain", grossReceipts: 450_000, incomeType: "BUSINESS" };

test("value-pivot: ₹0-tax earner asking 'why pay 200' gets the free-tier value story, not a punt", async () => {
  const llm = new MockLlmClient();
  const r = await route("to fir mai aapko 200 rupay kyu du?", arjun, { llm, lang: "hinglish" });
  assert.equal(r.source, "engine");
  assert.equal(llm.calls.length, 0); // not punted to AI
  assert.match(r.text, /FREE|free/);
});

test("valuePivotAnswer picks the ₹0 message when tax is zero", () => {
  assert.match(valuePivotAnswer(arjun, "en"), /income tax is ₹0/);
});

test("notice/penalty fear → calm reassurance (Hindi)", async () => {
  const r = await route("अगर नहीं लिया तो नोटिस आएगा?", { userId: "l" }, { llm: new MockLlmClient(), lang: "hi" });
  assert.equal(r.source, "static");
  assert.equal(r.lang, "hi");
  assert.match(r.text, /[ऀ-ॿ]/);
});

test("overwhelmed user → empathetic hand-holding, no AI punt", async () => {
  const llm = new MockLlmClient();
  const r = await route("ये सब मुझे समझ नहीं आता, आप ही सँभाल लो", { userId: "l" }, { llm, lang: "hi" });
  assert.equal(r.source, "static");
  assert.equal(llm.calls.length, 0);
  assert.match(reassuranceAnswer("hi"), /[ऀ-ॿ]/);
});

test("proactiveTriggers fires near a deadline and stays quiet otherwise", () => {
  const trader: UserProfile = { userId: "t", profession: "wholesale trader", grossReceipts: 12_000_000, incomeType: "BUSINESS" };
  // 13 Jun → advance-tax (15 Jun) within 7 days.
  const near = proactiveTriggers(trader, new Date(2026, 5, 13), "en");
  assert.ok(near.some((s) => /Advance tax/.test(s)));
  // 2 Feb → nothing due within 7 days.
  assert.equal(proactiveTriggers(trader, new Date(2026, 1, 2), "en").length, 0);
});
