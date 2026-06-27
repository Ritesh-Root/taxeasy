/**
 * Telegram channel adapter — official Bot API, zero approval needed (great as a
 * production channel AND the instant dev channel). Uses long polling (getUpdates)
 * so it needs no public webhook. Implements the same Channel port as WhatsApp, so
 * the agent is identical across platforms.
 *
 *   const ch = new TelegramChannel({ token: process.env.TELEGRAM_TOKEN });
 */
import type { Channel, InboundMessage } from "../ports/channel.ts";
import { logEvent } from "../observability/log.ts";

export interface TelegramConfig {
  token: string;
  baseUrl?: string;
  /** Long-poll timeout in seconds. */
  pollTimeoutSec?: number;
}

interface TgUpdate {
  update_id: number;
  message?: { message_id: number; from?: { id: number; is_bot?: boolean }; chat: { id: number }; text?: string };
}

/** Pure mapping of a Telegram update → InboundMessage (testable, no network). */
export function parseTelegramUpdate(u: TgUpdate): InboundMessage | null {
  const m = u.message;
  if (!m || typeof m.text !== "string" || m.from?.is_bot) return null;
  return { userId: String(m.chat.id), text: m.text, messageId: String(m.message_id) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TelegramChannel implements Channel {
  readonly name = "telegram";
  #token: string;
  #baseUrl: string;
  #timeout: number;
  #offset = 0;
  #running = false;

  constructor(cfg: TelegramConfig) {
    this.#token = cfg.token;
    this.#baseUrl = cfg.baseUrl ?? "https://api.telegram.org";
    this.#timeout = cfg.pollTimeoutSec ?? 30;
  }

  #url(method: string): string {
    return `${this.#baseUrl}/bot${this.#token}/${method}`;
  }

  async send(userId: string, text: string): Promise<void> {
    const res = await fetch(this.#url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: userId, text }),
    });
    if (!res.ok) {
      logEvent("ai_error", { channel: this.name, send: false, status: res.status });
      throw new Error(`Telegram send failed: ${res.status}`);
    }
  }

  stop(): void {
    this.#running = false;
  }

  async start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void> {
    this.#running = true;
    logEvent("message_in", { channel: this.name, started: true });
    while (this.#running) {
      try {
        const res = await fetch(this.#url("getUpdates"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset: this.#offset, timeout: this.#timeout }),
        });
        if (!res.ok) {
          logEvent("ai_error", { channel: this.name, getUpdates: res.status });
          await sleep(2000);
          continue;
        }
        const data = (await res.json()) as { ok: boolean; result?: TgUpdate[] };
        for (const u of data.result ?? []) {
          this.#offset = u.update_id + 1; // ack so we don't re-receive it
          const inbound = parseTelegramUpdate(u);
          if (inbound) await onMessage(inbound);
        }
      } catch (err) {
        logEvent("ai_error", { channel: this.name, poll: String(err) });
        await sleep(2000); // backoff on network error, then keep polling
      }
    }
  }
}
