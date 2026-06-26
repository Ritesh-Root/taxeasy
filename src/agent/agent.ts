/**
 * TaxEasyAgent — the stateful, adaptive entry point.
 *
 * Per turn it: loads the user (or creates one) → learns from the message →
 * composes a per-user adapted prompt → routes → persists the updated user and
 * appends domain events to the append-only log (the portable source of truth).
 *
 * It depends only on PORTS (UserStore/EventStore/LlmClient), so the exact same
 * agent runs on in-memory, Firestore, or any future backend unchanged.
 */
import type { LlmClient } from "../ai/types.ts";
import type { EventStore, UserStore, StoredUser } from "../ports/types.ts";
import { route, SYSTEM_PROMPT } from "./router.ts";
import type { AgentReply, UserProfile } from "./router.ts";
import { defaultModel, updateModel, adaptSystemPrompt } from "./user-model.ts";

export interface AgentDeps {
  llm: LlmClient;
  users: UserStore;
  events: EventStore;
}

export class TaxEasyAgent {
  #deps: AgentDeps;
  constructor(deps: AgentDeps) {
    this.#deps = deps;
  }

  async #loadOrCreate(userId: string): Promise<StoredUser> {
    const existing = await this.#deps.users.get(userId);
    if (existing) return existing;
    return { userId, profile: {}, model: defaultModel(), updatedAt: new Date().toISOString() };
  }

  async handle(userId: string, message: string): Promise<AgentReply> {
    const user = await this.#loadOrCreate(userId);

    // Learn from this message (language, verbosity, …).
    const model = updateModel(user.model, message);
    await this.#deps.events.append({ userId, type: "message_in", data: { chars: message.length } });

    // Adapt and route.
    const profile: UserProfile = { userId, ...user.profile };
    const reply = await route(message, profile, {
      llm: this.#deps.llm,
      systemPrompt: adaptSystemPrompt(SYSTEM_PROMPT, model),
    });

    // Persist updated state + record the outbound as an event (rebuildable history).
    const updated: StoredUser = { ...user, model, updatedAt: new Date().toISOString() };
    await this.#deps.users.put(updated);
    await this.#deps.events.append({ userId, type: "message_out", data: { source: reply.source } });

    return reply;
  }
}
