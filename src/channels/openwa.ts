/**
 * OpenWA channel adapter (INTERIM transport, until the official WhatsApp BSP is
 * approved). OpenWA is a self-hosted gateway you run separately; this adapter
 * only makes HTTP calls to it — none of its reverse-engineered code lives here,
 * so the official-BSP swap later is just a different Channel adapter.
 *
 * ⚠️ Use a SEPARATE throwaway number for OpenWA — never the number you'll
 * register for the official WABA (a ban must not contaminate the real account).
 *
 * Verified against OpenWA REST: POST /api/sessions/{session}/messages/send-text,
 * header X-API-Key, default base http://localhost:2785, inbound via webhook.
 * Confirm the inbound payload shape at {base}/api/docs for your OpenWA version.
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Channel, InboundMessage } from "../ports/channel.ts";
import { logEvent } from "../observability/log.ts";

export interface OpenWaConfig {
  apiKey: string;
  baseUrl?: string;
  session?: string;
  webhookPort?: number;
  webhookPath?: string;
  /** HMAC-SHA256 secret to verify inbound webhooks (REQUIRED unless allowInsecure). */
  webhookSecret?: string;
  webhookSignatureHeader?: string;
  /** Escape hatch for LOCAL DEV ONLY — run without webhook auth. Never in prod. */
  allowInsecure?: boolean;
  /** Max inbound webhook body size in bytes (DoS guard). Default 256 KB. */
  maxBodyBytes?: number;
}

interface ResolvedConfig extends Required<Omit<OpenWaConfig, "webhookSecret">> {
  webhookSecret: string | undefined;
}

const DEFAULTS = {
  baseUrl: "http://localhost:2785",
  session: "default",
  webhookPort: 3000,
  webhookPath: "/webhook",
  webhookSignatureHeader: "x-signature",
  allowInsecure: false,
  maxBodyBytes: 256 * 1024,
};

const toChatId = (userId: string) =>
  userId.includes("@") ? userId : `${userId.replace(/[^0-9]/g, "")}@c.us`;
const fromChatId = (chatId: string) => chatId.replace(/@c\.us$/, "");

export class OpenWaChannel implements Channel {
  readonly name = "openwa";
  #cfg: ResolvedConfig;

  constructor(cfg: OpenWaConfig) {
    this.#cfg = { ...DEFAULTS, webhookSecret: cfg.webhookSecret, ...cfg };
  }

  async send(userId: string, text: string): Promise<void> {
    const url = `${this.#cfg.baseUrl}/api/sessions/${this.#cfg.session}/messages/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.#cfg.apiKey },
      body: JSON.stringify({ chatId: toChatId(userId), text }),
    });
    if (!res.ok) {
      logEvent("ai_error", { channel: this.name, send: false, status: res.status });
      throw new Error(`OpenWA send failed: ${res.status} ${await res.text()}`);
    }
  }

  async start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void> {
    const { webhookPort, webhookPath, webhookSecret, webhookSignatureHeader, allowInsecure, maxBodyBytes } = this.#cfg;

    // FAIL CLOSED: refuse to accept webhooks without HMAC auth unless explicitly
    // opted into for local dev. Otherwise anyone could forge messages from any number.
    if (!webhookSecret && !allowInsecure) {
      throw new Error(
        "OpenWA webhook refuses to start without webhookSecret (set WEBHOOK_SECRET). " +
        "For local dev only, pass allowInsecure: true.",
      );
    }

    const server = createServer((req, res) => {
      if (req.method !== "POST" || req.url !== webhookPath) {
        res.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let aborted = false;
      req.on("data", (c) => {
        if (aborted) return;
        size += (c as Buffer).length;
        if (size > maxBodyBytes) { // DoS guard: reject oversized bodies
          aborted = true;
          res.writeHead(413).end();
          req.destroy();
          return;
        }
        chunks.push(c as Buffer);
      });
      req.on("end", async () => {
        if (aborted) return;
        const raw = Buffer.concat(chunks).toString("utf8");

        // Verify the HMAC signature before trusting the payload.
        if (webhookSecret && !verifySignature(raw, req.headers[webhookSignatureHeader], webhookSecret)) {
          logEvent("ai_error", { channel: "openwa", webhook: "bad_signature" });
          res.writeHead(401).end();
          return;
        }

        res.writeHead(200).end(); // ack fast; process async
        try {
          const inbound = parseInbound(raw);
          if (inbound) await onMessage(inbound);
        } catch (err) {
          logEvent("ai_error", { channel: "openwa", webhook: "parse", message: String(err) });
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(webhookPort, resolve));
    logEvent("message_in", { channel: "openwa", listening: `${webhookPort}${webhookPath}`, started: true });
    if (!webhookSecret) {
      console.warn("[openwa] INSECURE MODE — webhooks are unauthenticated. Local dev only.");
    }
  }
}

function verifySignature(raw: string, header: string | string[] | undefined, secret: string): boolean {
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Map an OpenWA webhook body → InboundMessage. Defensive about field paths since
 * the exact shape varies by version; ignores our own outbound and group chats.
 */
function parseInbound(raw: string): InboundMessage | null {
  const body = JSON.parse(raw) as Record<string, any>;
  const event = body.event ?? body.type;
  if (event && !String(event).includes("message")) return null;

  const p = body.payload ?? body.data ?? body;
  if (p.fromMe === true) return null; // never reply to our own messages (loop guard)

  const chatId: string | undefined = p.from ?? p.sender ?? p.chatId ?? p.author;
  const text: string | undefined = p.body ?? p.text ?? p.message ?? p.caption;
  const messageId: string | undefined = p.id ?? p.messageId ?? p.key?.id;
  if (!chatId || typeof text !== "string") return null;
  if (String(chatId).includes("@g.us")) return null; // skip groups for now

  return { userId: fromChatId(String(chatId)), text, messageId: messageId ?? `${Date.now()}` };
}
