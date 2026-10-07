/**
 * Reminder scheduler: sends due reminders once per deadline, on the user's own
 * channel, only in Indian daytime, and never to users who opted out.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendDueReminders } from "./reminders.ts";
import type { Channel } from "../ports/channel.ts";
import type { StoredUser } from "../ports/types.ts";
import { InMemoryUserStore, InMemoryEventStore } from "../ports/memory.ts";
import { TaxEasyAgent } from "../agent/agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { defaultModel } from "../agent/user-model.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

const sent: { userId: string; text: string }[] = [];
const telegram: Channel = { name: "telegram", send: async (userId, text) => void sent.push({ userId, text }), start: async () => {} };

const user = (userId: string, extra: Partial<StoredUser> = {}): StoredUser => ({
  userId, updatedAt: "now", model: defaultModel(), onboarding: { step: "done", complete: true },
  profile: { profession: "kirana store", grossReceipts: 6_000_000, incomeType: "BUSINESS", gstRegistered: true },
  ...extra,
});

test("sends each due reminder once, to the raw id on the user's channel, with an opt-out line", async () => {
  sent.length = 0;
  const users = new InMemoryUserStore();
  await users.put(user("telegram:123"));
  await users.put(user("telegram:456", { reminders: { off: true } })); // opted out
  await users.put(user("openwa:789")); // channel not running here

  const morning = new Date("2026-11-06T05:00:00Z"); // 10:30 IST, GSTR-1 due 11 Nov
  assert.equal(await sendDueReminders(users, [telegram], morning), 1);
  assert.equal(sent[0]?.userId, "123");
  assert.match(sent[0]!.text, /GSTR-1[\s\S]*STOP REMINDERS/);

  assert.equal(await sendDueReminders(users, [telegram], morning), 0); // already sent
  assert.deepEqual((await users.get("telegram:123"))?.reminders?.sent, ["gstr1:2026-11-11"]);
});

test("no reminders at night (IST)", async () => {
  sent.length = 0;
  const users = new InMemoryUserStore();
  await users.put(user("telegram:123"));
  assert.equal(await sendDueReminders(users, [telegram], new Date("2026-11-06T17:00:00Z")), 0); // 22:30 IST
});

test("STOP REMINDERS / START REMINDERS toggle the opt-out", async () => {
  const users = new InMemoryUserStore();
  await users.put(user("u"));
  const agent = new TaxEasyAgent({ llm: new MockLlmClient(), users, events: new InMemoryEventStore() });
  assert.match((await agent.handle("u", "STOP REMINDERS")).text, /no more deadline reminders/);
  assert.equal((await users.get("u"))?.reminders?.off, true);
  await agent.handle("u", "start reminders");
  assert.equal((await users.get("u"))?.reminders?.off, false);
});
