/**
 * Router tests — prove the cost-aware routing and the "AI never does math" rule
 * without any network/API key (uses the mock LLM).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { route } from "./router.ts";
import type { UserProfile } from "./router.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {}); // silence logs during tests

const baseProfile: UserProfile = { userId: "u1" };

test("static fact: GST due dates answered with ZERO ai calls", async () => {
  const llm = new MockLlmClient();
  const r = await route("when is my GSTR-3B due?", baseProfile, { llm });
  assert.equal(r.source, "static");
  assert.match(r.text, /20th/);
  assert.equal(llm.calls.length, 0);
});

test("tax estimate uses the engine, not AI, and ₹18L dev → ₹0", async () => {
  const llm = new MockLlmClient();
  const profile: UserProfile = {
    userId: "u2",
    profession: "freelance software developer",
    grossReceipts: 1_800_000,
    incomeType: "PROFESSION",
  };
  const r = await route("how much tax do I owe?", profile, { llm });
  assert.equal(r.source, "engine");
  assert.match(r.text, /44ADA/);
  assert.match(r.text, /₹0 tax/);
  assert.match(r.text, /not a CA firm/); // disclaimer present
  assert.equal(llm.calls.length, 0); // engine did the math, no AI
});

test("estimate with incomplete profile asks for info, no AI", async () => {
  const llm = new MockLlmClient();
  const r = await route("calculate my tax", baseProfile, { llm });
  assert.equal(r.source, "static");
  assert.match(r.text, /gross receipts|turnover/i);
  assert.equal(llm.calls.length, 0);
});

test("conversational query falls through to Gemini (fast tier)", async () => {
  const llm = new MockLlmClient(() => "Presumptive taxation lets you skip detailed books.");
  const r = await route("explain presumptive taxation like I'm five", baseProfile, { llm });
  assert.equal(r.source, "ai");
  assert.equal(llm.calls.length, 1);
  assert.equal(llm.calls[0]?.tier, "fast");
});

const dev: UserProfile = { userId: "d", profession: "freelance software developer", grossReceipts: 2_000_000, incomeType: "PROFESSION" };

test("regime comparison: shows both regimes with the math, from the engine", async () => {
  const llm = new MockLlmClient();
  const r = await route("old vs new regime, which is better?", dev, { llm });
  assert.equal(r.source, "engine");
  assert.match(r.text, /income of ₹10,00,000/); // 44ADA: 50% of ₹20L
  assert.match(r.text, /New regime: tax ₹0/);
  assert.match(r.text, /taxable → tax ₹1,17,000/); // 12,500 + 1,00,000 + 4% cess
  assert.match(r.text, /new regime saves you ₹1,17,000/);
  assert.equal(llm.calls.length, 0);

  const withDed = await route("old vs new with 1.5 lakh deductions", dev, { llm });
  assert.match(withDed.text, /₹1,50,000 deductions = ₹8,50,000 taxable → tax ₹85,800/);
});

test("GST on a stated sale (the website mockup, in Hindi): ₹4.2 लाख at 18% = ₹75,600", async () => {
  const llm = new MockLlmClient();
  const r = await route("मेरी इस महीने की sale ₹4.2 लाख है, GST कितना देना है?", baseProfile, { llm, lang: "hi" });
  assert.equal(r.source, "engine");
  assert.match(r.text, /75,600/);
  assert.match(r.text, /20 तारीख/);
  assert.match((await route("sales 2 lakh at 5%, how much GST?", baseProfile, { llm })).text, /at 5%: ₹10,000/);
  // A registration question that mentions sales is NOT turned into a GST bill.
  const reg = await route("do I need GST if my sales are 25 lakh?", dev, { llm });
  assert.doesNotMatch(reg.text, /GST on sales/);
  assert.equal(llm.calls.length, 0);
});
