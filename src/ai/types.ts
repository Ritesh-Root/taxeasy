/**
 * Provider-agnostic LLM interface. The product was designed so the AI provider
 * is a one-line swap — for the Gemini XPRIZE we use Gemini, but the engine and
 * router never import a provider directly, only this interface.
 */

/** Model tiers map to cost/capability, mirroring the 90%/10% routing plan. */
export type ModelTier = "fast" | "smart";

export interface LlmMessage {
  role: "user" | "model";
  text: string;
}

export interface LlmRequest {
  tier: ModelTier;
  system: string;
  messages: LlmMessage[];
  /** 0..1 — lower = more deterministic. Tax-adjacent NL stays low. */
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmResponse {
  text: string;
  tier: ModelTier;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  latencyMs: number;
}

export interface LlmClient {
  readonly provider: string;
  generate(req: LlmRequest): Promise<LlmResponse>;
}
