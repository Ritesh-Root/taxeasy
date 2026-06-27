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
import { defaultModel, updateModel, adaptSystemPrompt, applySegment } from "./user-model.ts";
import { handleOnboarding } from "./onboarding.ts";
import { consentedContext } from "./consent.ts";
import { t } from "./i18n.ts";
import { isSupportedRegion, getRegion } from "../regions/registry.ts";

export interface AgentDeps {
  llm: LlmClient;
  users: UserStore;
  events: EventStore;
}

/** Hard cap on inbound message length (cost/DoS guard, review #6). */
const MAX_MESSAGE_LEN = 4000;

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
    message = message.slice(0, MAX_MESSAGE_LEN); // cap before any regex/AI work (cost/DoS guard)
    const user = await this.#loadOrCreate(userId);
    await this.#deps.events.append({ userId, type: "message_in", data: { chars: message.length } });

    // New or mid-onboarding users go through the onboarding flow first.
    if (!user.onboarding || !user.onboarding.complete) {
      return this.#onboard(user, message);
    }

    // Onboarded but in a region we don't yet support → waitlist mode (no tax math).
    if (user.profile.region && !isSupportedRegion(user.profile.region)) {
      const learnedW = updateModel(user.model, message);
      await this.#deps.users.put({ ...user, model: learnedW, updatedAt: new Date().toISOString() });
      const r = getRegion(user.profile.region);
      return {
        text: t("onboard.region_coming_soon", learnedW.language, { region: r.name }),
        source: "static",
        lang: learnedW.language,
      };
    }

    // Onboarded → learn, adapt, route in the user's language. The AI context is
    // built from consented data only (DPDP enforcement — see consent.ts).
    const model = updateModel(user.model, message);
    const profile: UserProfile = { userId, ...user.profile };
    const reply = await route(message, profile, {
      llm: this.#deps.llm,
      systemPrompt: adaptSystemPrompt(SYSTEM_PROMPT, model) + consentedContext(user.profile),
      lang: model.language,
    });

    const updated: StoredUser = { ...user, model, updatedAt: new Date().toISOString() };
    await this.#deps.users.put(updated);
    await this.#deps.events.append({ userId, type: "message_out", data: { source: reply.source } });
    return reply;
  }

  async #onboard(user: StoredUser, message: string): Promise<AgentReply> {
    // Learn language/verbosity from onboarding messages too.
    const learned = updateModel(user.model, message);

    // First contact: greet and ask for the region (don't process the "hi").
    if (!user.onboarding) {
      const updated: StoredUser = {
        ...user,
        model: learned,
        onboarding: { step: "region", complete: false },
        updatedAt: new Date().toISOString(),
      };
      await this.#deps.users.put(updated);
      await this.#deps.events.append({ userId: user.userId, type: "message_out", data: { onboarding: "region_prompt" } });
      return { text: t("onboard.region_prompt", learned.language), source: "static", lang: learned.language };
    }

    const res = handleOnboarding(user.onboarding.step, message, user.profile, learned.language);
    const model = res.segment ? applySegment(learned, res.segment) : learned;
    const updated: StoredUser = {
      ...user,
      profile: { ...user.profile, ...res.profilePatch },
      model,
      onboarding: { step: res.nextStep, complete: res.complete },
      updatedAt: new Date().toISOString(),
    };
    await this.#deps.users.put(updated);
    await this.#deps.events.append({
      userId: user.userId,
      type: res.complete ? "onboarding_complete" : "message_out",
      data: { step: res.nextStep },
    });
    return { text: res.reply, source: "static", lang: learned.language };
  }
}
