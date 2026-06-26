/**
 * Gemini client (Google AI / Vertex) over the REST API — zero dependencies.
 *
 * Tier → model:
 *   fast  → Gemini Flash  (the ~90%: categorize, explain, simple NL)
 *   smart → Gemini Pro    (the ~10%: onboarding segment, reconciliation, edge cases)
 *
 * Verify exact model IDs in Google AI Studio before launch (they version often).
 * Includes exponential backoff + jitter on 429/5xx (the simulation's 429 killer).
 */
import type { LlmClient, LlmRequest, LlmResponse, ModelTier } from "./types.ts";
import { logEvent } from "../observability/log.ts";

export interface GeminiConfig {
  apiKey: string;
  fastModel?: string;
  smartModel?: string;
  baseUrl?: string;
  maxRetries?: number;
}

const DEFAULTS = {
  fastModel: "gemini-2.5-flash",
  smartModel: "gemini-2.5-pro",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  maxRetries: 6,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiClient implements LlmClient {
  readonly provider = "gemini";
  #cfg: Required<GeminiConfig>;

  constructor(cfg: GeminiConfig) {
    this.#cfg = { ...DEFAULTS, ...cfg };
  }

  #model(tier: ModelTier): string {
    return tier === "smart" ? this.#cfg.smartModel : this.#cfg.fastModel;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const model = this.#model(req.tier);
    const url = `${this.#cfg.baseUrl}/models/${model}:generateContent?key=${this.#cfg.apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 1024,
      },
    };

    const started = Date.now();
    for (let attempt = 0; attempt <= this.#cfg.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 429 || res.status >= 500) {
          if (attempt === this.#cfg.maxRetries) throw new Error(`Gemini ${res.status} after retries`);
          const retryAfter = Number(res.headers.get("retry-after"));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : Math.min(32_000, 2 ** attempt * 1000) + Math.random() * 250;
          logEvent("ai_error", { model, status: res.status, attempt, backoffMs: Math.round(backoff) });
          await sleep(backoff);
          continue;
        }

        if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

        const json = (await res.json()) as GeminiResponseShape;
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
        const latencyMs = Date.now() - started;
        const usage = {
          inputTokens: json.usageMetadata?.promptTokenCount,
          outputTokens: json.usageMetadata?.candidatesTokenCount,
        };
        logEvent("ai_call", { model, tier: req.tier, latencyMs, ...usage });
        return { text, tier: req.tier, model, usage, latencyMs };
      } catch (err) {
        if (attempt === this.#cfg.maxRetries) {
          logEvent("ai_error", { model, fatal: true, message: String(err) });
          throw err;
        }
        await sleep(Math.min(32_000, 2 ** attempt * 1000) + Math.random() * 250);
      }
    }
    throw new Error("unreachable");
  }
}

interface GeminiResponseShape {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
