/**
 * Run several channels at once against ONE agent — so a user can choose their
 * platform (WhatsApp, Telegram, …) and get the same assistant. Each channel runs
 * its own loop; they share the agent + store (state namespaced per platform by
 * serve()).
 */
import type { Channel } from "../ports/channel.ts";
import type { TaxEasyAgent } from "../agent/agent.ts";
import { serve } from "./serve.ts";
import type { ServeOptions } from "./serve.ts";

export async function serveAll(
  channels: Channel[],
  agent: TaxEasyAgent,
  opts?: ServeOptions,
): Promise<void> {
  await Promise.all(channels.map((c) => serve(c, agent, opts)));
}
