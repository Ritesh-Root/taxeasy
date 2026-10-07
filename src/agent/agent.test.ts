/**
 * Proves the two architectural guarantees the founder asked for:
 *   1. Zero-data-loss mobility — export the event log, replay into a brand-new
 *      store, and the full history is identical (this IS server migration).
 *   2. Adaptive behaviour — the agent learns each user's language/verbosity and
 *      adapts the AI system prompt per user, from one codebase.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TaxEasyAgent } from "./agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import {
  InMemoryEventStore,
  InMemoryUserStore,
  exportLog,
  replayInto,
} from "../ports/memory.ts";
import { defaultModel, updateModel, adaptSystemPrompt, applySegment } from "./user-model.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("zero-loss migration: export event log → replay into fresh store → identical", async () => {
  const events = new InMemoryEventStore();
  const users = new InMemoryUserStore();
  const llm = new MockLlmClient();
  const agent = new TaxEasyAgent({ llm, users, events });

  await agent.handle("u1", "when is GSTR-3B due?");
  await agent.handle("u1", "explain presumptive tax");
  await agent.handle("u2", "kitna tax dena hai bhai?");

  const exported = await exportLog(events);
  const original = await events.all();

  // Simulate a new server: a brand-new, empty store.
  const migrated = new InMemoryEventStore();
  const count = await replayInto(migrated, exported);

  const restored = await migrated.all();
  assert.equal(count, original.length);
  assert.deepEqual(restored, original); // nothing lost, nothing reordered
});

test("adaptation: agent learns Hinglish from a romanised message", async () => {
  const events = new InMemoryEventStore();
  const users = new InMemoryUserStore();
  const llm = new MockLlmClient();
  const agent = new TaxEasyAgent({ llm, users, events });

  await agent.handle("u3", "bhai mera tax kitna hai batao");
  const u = await users.get("u3");
  assert.equal(u?.model.language, "hinglish");
});

test("adaptation: brief vs detailed inferred from message length", () => {
  const brief = updateModel(defaultModel(), "tax?");
  assert.equal(brief.verbosity, "brief");
  const detailed = updateModel(defaultModel(), "x".repeat(200));
  assert.equal(detailed.verbosity, "detailed");
});

test("adapted system prompt carries language + segment + tech level", () => {
  let m = defaultModel();
  m = updateModel(m, "kya mera tax zero hai");
  m = applySegment(m, "gig");
  const prompt = adaptSystemPrompt("BASE.", m);
  assert.match(prompt, /Hinglish/);
  assert.match(prompt, /gig/);
  assert.match(prompt, /low .*literacy/i);
});

test("per-user models are independent (one codebase, many customers)", async () => {
  const events = new InMemoryEventStore();
  const users = new InMemoryUserStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events });

  await agent.handle("doctor", "Could you please provide a detailed breakdown of my advance tax obligations for the financial year including the relevant due dates");
  await agent.handle("gig", "tax?");

  assert.equal((await users.get("doctor"))?.model.verbosity, "detailed");
  assert.equal((await users.get("gig"))?.model.verbosity, "brief");
});

const onboarded = (updatedAt: string) => ({
  userId: "u", updatedAt, model: defaultModel(),
  onboarding: { step: "done" as const, complete: true },
  profile: { profession: "freelance developer", grossReceipts: 1_800_000, incomeType: "PROFESSION" as const },
});

test("AI notice opens a new session (first message after 24h), not every message", async () => {
  const users = new InMemoryUserStore();
  const now = () => new Date("2026-10-02T01:00:00.000Z");
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore(), now });

  await users.put(onboarded("2026-10-01T00:00:00.000Z")); // 25h ago
  assert.match((await agent.handle("u", "when is GSTR-3B due?")).text, /^🤖 .*not a person/);

  await users.put(onboarded("2026-10-02T00:00:00.000Z")); // 1h ago
  assert.doesNotMatch((await agent.handle("u", "when is GSTR-3B due?")).text, /not a person/);
});

test("DELETE MY DATA erases the profile and the event log for that user only", async () => {
  const users = new InMemoryUserStore();
  const events = new InMemoryEventStore();
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events });
  await agent.handle("u", "hi");
  await agent.handle("other", "hi");

  const r = await agent.handle("u", "DELETE MY DATA");
  assert.match(r.text, /deleted your TaxEasy profile/);
  assert.equal(await users.get("u"), null);
  assert.deepEqual(await events.byUser("u"), []);
  assert.ok(await users.get("other"));

  const hi = await agent.handle("other", "मेरा डेटा डिलीट करो");
  assert.match(hi.text, /[ऀ-ॿ]/); // confirmed in Hindi
  assert.equal(await users.get("other"), null);
});
