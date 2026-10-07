/**
 * DPDP consent enforcement (review #2): non-consented financial data must never
 * be attached to an AI call; consented data may be.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { consentedContext, stripUnconsented } from "./consent.ts";
import type { UserProfileData } from "../ports/types.ts";
import { TaxEasyAgent } from "./agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { InMemoryEventStore, InMemoryUserStore } from "../ports/memory.ts";
import { defaultModel } from "./user-model.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

const base: UserProfileData = { profession: "doctor", grossReceipts: 4_000_000, incomeType: "PROFESSION" };

test("consentedContext excludes turnover without income consent, includes with", () => {
  assert.doesNotMatch(consentedContext({ ...base, consent: { income: false } }), /40,00,000/);
  assert.match(consentedContext({ ...base, consent: { income: true } }), /40,00,000/);
  assert.match(consentedContext(base), /doctor/); // profession is user-stated, always allowed
});

test("stripUnconsented keeps only consented categories", () => {
  const p: UserProfileData = { consent: { bills: true, bank: false } };
  const out = stripUnconsented(p, { bills: "bill-data", bank: "bank-data", income: "x" });
  assert.deepEqual(out, { bills: "bill-data" });
});

test("agent does NOT send non-consented turnover to the LLM", async () => {
  const users = new InMemoryUserStore();
  await users.put({
    userId: "u", updatedAt: "now", model: defaultModel(),
    onboarding: { step: "done", complete: true },
    profile: { ...base, consent: { income: false } },
  });
  const llm = new MockLlmClient();
  const agent = new TaxEasyAgent({ llm, users, events: new InMemoryEventStore() });
  await agent.handle("u", "explain presumptive taxation simply"); // → AI
  assert.equal(llm.calls.length, 1);
  assert.doesNotMatch(llm.calls[0]!.system, /40,00,000/); // turnover withheld
});

test("agent DOES send consented turnover to the LLM", async () => {
  const users = new InMemoryUserStore();
  await users.put({
    userId: "u2", updatedAt: "now", model: defaultModel(),
    onboarding: { step: "done", complete: true },
    profile: { ...base, consent: { income: true } },
  });
  const llm = new MockLlmClient();
  const agent = new TaxEasyAgent({ llm, users, events: new InMemoryEventStore() });
  await agent.handle("u2", "explain presumptive taxation simply");
  assert.match(llm.calls[0]!.system, /40,00,000/);
});

test("MY DATA shows consent; STOP SHARING income turns it off AND deletes stored turnover", async () => {
  const users = new InMemoryUserStore();
  await users.put({
    userId: "u", updatedAt: "now", model: defaultModel(),
    onboarding: { step: "done", complete: true },
    profile: { ...base, consent: { income: true, bills: true } },
  });
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });

  assert.match((await agent.handle("u", "MY DATA")).text, /✅ income[\s\S]*❌ gst[\s\S]*✅ bills/);

  const off = await agent.handle("u", "STOP SHARING income");
  assert.match(off.text, /❌ income/);
  const u = await users.get("u");
  assert.equal(u?.profile.consent?.income, false);
  assert.equal(u?.profile.grossReceipts, undefined); // category history deleted (privacy policy §2)

  const on = await agent.handle("u", "share income");
  assert.match(on.text, /TURNOVER 18 lakh/); // asks for the deleted turnover back
  assert.match((await agent.handle("u", "TURNOVER 18 lakh")).text, /18,00,000/);
  assert.equal((await users.get("u"))?.profile.grossReceipts, 1_800_000);
});
