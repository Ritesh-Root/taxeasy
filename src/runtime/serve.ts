/**
 * Transport-agnostic runtime — connects ANY Channel to the TaxEasyAgent.
 *
 * Adds the cross-cutting concerns SECURITY.md requires at the edge:
 *  - idempotency/dedupe on the transport message id (Meta & OpenWA re-deliver),
 *  - error isolation (one bad message never crashes the loop),
 *  - structured logging.
 *
 * The same `serve()` runs over Telegram, OpenWA, or the official WhatsApp BSP —
 * swap the Channel adapter, change nothing else.
 */
import type { Channel, InboundMessage } from "../ports/channel.ts";
import type { TaxEasyAgent } from "../agent/agent.ts";
import { RateLimiter } from "./rate-limit.ts";
import { logEvent } from "../observability/log.ts";

export interface ServeOptions {
  /** Cap on remembered message ids before the dedupe set resets. */
  dedupeMax?: number;
  /** Max messages per user per minute (AI-cost / spam guard). Default 20. */
  ratePerMinute?: number;
}

export async function serve(
  channel: Channel,
  agent: TaxEasyAgent,
  opts: ServeOptions = {},
): Promise<void> {
  const seen = new Set<string>();
  const dedupeMax = opts.dedupeMax ?? 5_000;
  const limiter = new RateLimiter(opts.ratePerMinute ?? 20, 60_000);

  await channel.start(async (msg: InboundMessage) => {
    // Namespace identity by platform so the same raw id on two channels (e.g.
    // Telegram "12345" vs WhatsApp "12345") never share state. The channel.send
    // call still uses the RAW transport id.
    const userKey = `${channel.name}:${msg.userId}`;
    const dedupeKey = msg.messageId ? `${channel.name}:${msg.messageId}` : "";

    if (dedupeKey) {
      if (seen.has(dedupeKey)) {
        logEvent("message_in", { userId: userKey, channel: channel.name, dedup: true });
        return;
      }
      seen.add(dedupeKey);
      if (seen.size > dedupeMax) seen.clear();
    }

    // Per-user rate limit — drop floods silently (don't amplify by replying).
    if (!limiter.allow(userKey)) {
      logEvent("message_in", { userId: userKey, channel: channel.name, throttled: true });
      return;
    }

    try {
      const reply = await agent.handle(userKey, msg.text);
      await channel.send(msg.userId, reply.text);
    } catch (err) {
      logEvent("ai_error", { userId: userKey, channel: channel.name, message: String(err) });
      await channel.send(msg.userId, "Sorry — something went wrong on my end. Please try again in a moment.");
    }
  });
}
