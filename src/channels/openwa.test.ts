/**
 * Webhook auth fails CLOSED (review breach #2): the channel refuses to start
 * without an HMAC secret unless insecure mode is explicitly opted into.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenWaChannel } from "./openwa.ts";
import { setLogSink } from "../observability/log.ts";

setLogSink(() => {});

test("start() throws without webhookSecret (fail closed)", async () => {
  const ch = new OpenWaChannel({ apiKey: "k" }); // no secret, allowInsecure defaults false
  await assert.rejects(() => ch.start(async () => {}), /webhookSecret/);
});
