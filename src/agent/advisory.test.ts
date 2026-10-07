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

test("GST-liability question is answered by the engine, not punted (Suresh)", async () => {
  const llm = new MockLlmClient();
  const suresh: UserProfile = { userId: "s", profession: "garments wholesale trader", grossReceipts: 12_000_000, incomeType: "BUSINESS" };
  const r = await route("how much GST do I actually pay after input credit?", suresh, { llm, lang: "en" });
  assert.equal(r.source, "engine");
  assert.equal(llm.calls.length, 0);
  assert.match(r.text, /output GST.*input credit/);
});

test("proactiveTriggers fires near a deadline and stays quiet otherwise", () => {
  // ₹3.5 Cr is over the 44AD cap → books → all four advance-tax instalments apply.
  const trader: UserProfile = { userId: "t", profession: "wholesale trader", grossReceipts: 35_000_000, incomeType: "BUSINESS" };
  // 13 Jun → advance-tax (15 Jun) within 7 days, keyed by due date.
  const near = proactiveTriggers(trader, new Date(2026, 5, 13), "en");
  assert.ok(near.some((r) => r.key === "advance_tax:2026-6-15" && /Advance tax/.test(r.text)));
  // 2 Feb → nothing due within 7 days.
  assert.equal(proactiveTriggers(trader, new Date(2026, 1, 2), "en").length, 0);
});

test("reminders only for deadlines that apply: no advance tax on ₹0 tax; GSTR-1/3B only if registered", () => {
  const smallTrader: UserProfile = { userId: "s", profession: "kirana store", grossReceipts: 6_000_000, incomeType: "BUSINESS" }; // 44AD ₹3.6L → ₹0 tax
  assert.equal(proactiveTriggers(smallTrader, new Date(2026, 2, 10)).filter((r) => r.key.startsWith("advance_tax")).length, 0);

  const doc: UserProfile = { userId: "d", profession: "doctor", grossReceipts: 4_000_000, incomeType: "PROFESSION" }; // 44ADA ₹20L → tax due
  assert.ok(proactiveTriggers(doc, new Date(2026, 2, 10)).some((r) => r.key === "advance_tax:2026-3-15"));
  assert.ok(!proactiveTriggers(doc, new Date(2026, 5, 13)).some((r) => r.key.startsWith("advance_tax"))); // presumptive: 15 Mar only

  const registered = { ...smallTrader, gstRegistered: true };
  assert.deepEqual(proactiveTriggers(registered, new Date(2026, 10, 6)).map((r) => r.key), ["gstr1:2026-11-11"]);
  assert.deepEqual(proactiveTriggers({ ...registered, gstRegistered: false }, new Date(2026, 10, 6)), []);
});
