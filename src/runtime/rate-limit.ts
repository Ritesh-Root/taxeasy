/**
 * Per-key sliding-window rate limiter — caps how many messages one user can push
 * through per window. Stops AI-cost abuse / spam / forged-webhook floods
 * (review breach #5). In-memory; per process (fine for MVP — move to a shared
 * store when horizontally scaled).
 */
export class RateLimiter {
  #hits = new Map<string, number[]>();
  #max: number;
  #windowMs: number;

  constructor(max: number, windowMs: number) {
    this.#max = max;
    this.#windowMs = windowMs;
  }

  /** Records an attempt; returns false if the key is over its limit. */
  allow(key: string): boolean {
    const now = Date.now();
    const recent = (this.#hits.get(key) ?? []).filter((t) => now - t < this.#windowMs);
    if (recent.length >= this.#max) {
      this.#hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.#hits.set(key, recent);
    return true;
  }
}
