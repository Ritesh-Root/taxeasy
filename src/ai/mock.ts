/**
 * Deterministic mock LLM — lets the router/agent be tested offline (no API key,
 * no network) and keeps CI hermetic. Echoes a canned reply and records calls.
 */
import type { LlmClient, LlmRequest, LlmResponse } from "./types.ts";

export class MockLlmClient implements LlmClient {
  readonly provider = "mock";
  readonly calls: LlmRequest[] = [];
  #reply: (req: LlmRequest) => string;

  constructor(reply?: (req: LlmRequest) => string) {
    this.#reply = reply ?? (() => "Here's a plain-language explanation.");
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    return {
      text: this.#reply(req),
      tier: req.tier,
      model: `mock-${req.tier}`,
      latencyMs: 0,
    };
  }
}
