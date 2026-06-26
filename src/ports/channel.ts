/**
 * Channel port — the messaging transport is a swappable adapter, exactly like
 * storage and AI. Telegram (dev), official WhatsApp Cloud API via a BSP (prod),
 * or a console all implement this same interface, so the agent never knows or
 * cares which transport it is speaking over.
 *
 * NOTE: production WhatsApp must be an OFFICIAL Meta Cloud API adapter (Twilio /
 * AiSensy / Wati). Reverse-engineered libraries (Baileys / whatsapp-web.js /
 * OpenWA) are out of scope per SECURITY.md — ban + ToS + fintech-data risk.
 */

export interface InboundMessage {
  /** Stable per-user id from the transport (phone number / chat id). */
  userId: string;
  text: string;
  /** Transport's own message id — used for idempotency/dedupe. */
  messageId: string;
  /** Optional media (a photographed bill, voice note) for later. */
  media?: { kind: "image" | "audio" | "document"; url?: string; bytes?: Uint8Array };
}

export interface Channel {
  readonly name: string;
  /** Send a reply back to a user on this transport. */
  send(userId: string, text: string): Promise<void>;
  /**
   * Begin receiving messages. The adapter calls `onMessage` for each inbound
   * message; returning a promise that resolves when listening stops.
   */
  start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void>;
}
