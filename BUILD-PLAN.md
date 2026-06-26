# TaxEasy — Build Plan

**Owner:** Ritesh (solo founder) · **Compiled:** 26 Jun 2026
**Source of truth for the product:** `~/Downloads/TaxEasy-FINAL/` (tie-breaker: `09-RECONCILIATION`).
**This repo:** the production build. Engine-first, platform-agnostic until we deploy.

---

## 0. What's already true (don't re-litigate)
Locked by your two converging plan reviews:
- **Product:** WhatsApp-first financial co-pilot for Indian business owners + companion app.
- **Pricing:** ₹200/mo headline · ₹1,999–2,000/yr annual lead · free tier for low earners.
- **Golden rule:** a hard-coded engine does ALL tax math; AI never computes a number.
- **Channel:** official Meta WhatsApp Cloud API via a BSP (never Baileys). Telegram for dev/test.
- **Funding:** optional. Scale-to-zero + free tiers; cash-positive after ~1–2 paying users.

## 1. Status
- ✅ **Production tax engine (TypeScript), FY2025-26** — `src/engine/`. Versioned ruleset, income tax
  (new/old + §87A), presumptive 44ADA/44AD with whole-word scheme detection, GST, ITC §17(5), advance tax.
- ✅ **17 trust-critical unit tests pass** (`node --test`), incl. the TAX-04 §87A-on-net fix.
- ⏳ Everything below.

## 2. The decision still open (decide together)
**Where do we deploy / what's the backend platform?** Engine is platform-independent so this blocks nothing
yet. Options in `§5`. Decide before Phase 1 ships.

---

## 3. Model + effort — the product's runtime AI
Hard-coded engine answers anything deterministic (deadlines, slabs, the tax math). Only genuine NL hits Claude.

| Runtime job | Model | Effort | Notes |
|---|---|---|---|
| Categorize expense / read bill | Haiku 4.5 | none–low | High volume |
| Explain a concept, simple Q&A | Haiku 4.5 | low | Static answers cached → 0 AI calls |
| Segment classification (onboarding) | Sonnet 4.6 | medium | Wrong segment = wrong scheme |
| Reconciliation / GSTR-2B netting | Sonnet 4.6 | high | Multi-step, money-sensitive |
| Foreign income / edge cases | Sonnet → Opus | high | Rare, high blast radius |

Model IDs: `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`. No GPT fallback — backoff + queue.

## 4. Model + effort — how Claude Code builds each task
| Build task | Model | Effort |
|---|---|---|
| Tax engine (done) + future tax-rule changes | Opus 4.8 | high |
| Unit/integration tests | Sonnet 4.6 | high |
| Claude wrapper (backoff, prompt-cache, routing) | Sonnet 4.6 | medium |
| Intent router + static-answer cache (429 fix) | Sonnet 4.6 | medium |
| Channel handler (Telegram → WhatsApp) | Sonnet 4.6 | medium |
| Storage + idempotency | Sonnet 4.6 | medium |
| Scheduler (month-end bill, reminders) | Sonnet 4.6 | medium |
| Payments (Razorpay AutoPay + dunning) | Opus 4.8 | high |
| Consent dashboard / app UI | Haiku/Sonnet | low |
| Architecture calls + gnarly debugging | Opus 4.8 | high |

---

## 5. Platform options (the joint decision)
| | A. Lean build-now | B. Documented AWS+GCP | C. Hybrid |
|---|---|---|---|
| Backend/state | Supabase (Postgres+auth+storage+fns) | AWS Lambda/SQS/DynamoDB/EventBridge | Supabase |
| AI (Claude) | Anthropic API or Vertex | Vertex AI | **Vertex AI (day 1)** |
| Dashboard host | Vercel | — | Vercel |
| Free credits | smaller | **$3,350 (AWS+GCP)** | GCP $2,000 |
| Time to first message | **days** | weeks | days |
| I can provision it here (MCP) | **yes** | no (AWS) | partly |
| Funding "uses Google" story | weak | strong | **strong** |

Recommendation: **C (Hybrid)** — Supabase to move fast now, Claude on Vertex from day 1 so the GCP credit +
Google-for-Startups story is real without the full AWS build. Migrate queue/scheduler to AWS at ~50 users.

## 6. Phased roadmap (mapped to tax season)
- **P1 — WhatsApp MVP (now → Aug 2026):** engine ✅ → Claude wrapper → intent router → Telegram loop →
  WhatsApp swap → onboarding/segment selector → month-end tax bill. *Catch the Jul–Sep ITR rush.*
- **P2 — Bills module (Sep → Nov):** track, T-3/T-0/T+1 reminders, anomaly flags, ITC capture. *Retention.*
- **P3 — Mobile app (Dec → Feb):** cashflow, doc vault, GST views, granular data-sharing consent.
- **P4 — Business modules (Mar → Jun):** multi-GSTIN, invoicing, depreciation/WDV, CA export.

## 7. Never compromise
1. The tax numbers are right (re-verify each 1 April after the Budget).
2. The AI never does math — engine computes, Claude explains.
3. You're a tool, not an advisor — "compare," never "recommend." Disclaimer on every calculation.
