/**
 * Proves the file adapter persists across a simulated process restart and that
 * its event file is a portable log (re-readable, replayable).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileEventStore, FileUserStore } from "./file-store.ts";
import { TaxEasyAgent } from "../agent/agent.ts";
import { MockLlmClient } from "../ai/mock.ts";
import { defaultModel } from "../agent/user-model.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("file store: state survives a 'restart' (new store instance, same dir)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "taxeasy-"));
  try {
    // Session 1: handle some messages, persist to disk.
    const agent = new TaxEasyAgent({
      llm: new MockLlmClient(),
      users: new FileUserStore(dir),
      events: new FileEventStore(dir),
    });
    await agent.handle("u1", "kitna tax hai bhai");
    await agent.handle("u1", "when is GSTR-3B due?");

    // Session 2: brand-new store objects on the same dir = a restart.
    const users2 = new FileUserStore(dir);
    const events2 = new FileEventStore(dir);

    const u = await users2.get("u1");
    assert.equal(u?.model.language, "hinglish"); // learned state persisted
    assert.equal(u?.model.messageCount, 2);

    const log = await events2.all();
    assert.equal(log.length, 4); // 2 in + 2 out, in order
    assert.equal(log[0]?.type, "message_in");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file store: unknown user is null; put/get round-trips", async () => {
  const dir = await mkdtemp(join(tmpdir(), "taxeasy-"));
  try {
    const users = new FileUserStore(dir);
    assert.equal(await users.get("nobody"), null);
    await users.put({ userId: "x", profile: {}, model: defaultModel(), updatedAt: "now" });
    assert.equal((await users.get("x"))?.userId, "x");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
