import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "./rate-limit.ts";

test("RateLimiter allows up to max per window, then blocks; keys are independent", () => {
  const rl = new RateLimiter(3, 60_000);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), false); // 4th over the limit
  assert.equal(rl.allow("b"), true); // different user unaffected
});
