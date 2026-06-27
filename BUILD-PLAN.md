# TaxEasy — Build Plan

**Owner:** Ritesh (solo founder) · **Compiled:** 26 Jun 2026
**Source of truth for the product:** `~/Downloads/TaxEasy-FINAL/` (tie-breaker: `09-RECONCILIATION`).
**This repo:** the production build. Engine-first, platform-agnostic until we deploy.

## 🏆 Competing in: Build with Gemini XPRIZE (Devpost) — deadline **18 Aug 2026** (~52 days)
- **Category:** Small Business Services.
- **Hard requirement:** business operated by AI agents + uses ≥1 Google Cloud product.
- **Stack decision (locked):** **Google-native** — **Gemini** (Flash 90% / Pro 10%) as the AI brain + vision,
  **Firebase** (Firestore, Cloud Functions, Auth, Hosting) backend, on the **$300 Google credit**.
  AWS $500 credit is not used for the prize. Tax engine stays model-agnostic (the moat).
- **What's scored:** Business Viability (real revenue in 90 days), AI-Native Operations (AI live in prod,
  executes key decisions), Category Impact. → We log every AI call + agent decision as evidence from day 1.
- **Submission needs:** GitHub repo, 3-min video, 500–1000w narrative (AI vs human), revenue evidence,
  expense disclosure, agent execution logs, customer evidence. Collect screenshots/logs as we build.

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
- ✅ **Provider-agnostic AI layer** — `src/ai/` (Gemini client w/ tier routing + backoff; mock for tests).
- ✅ **Intent router + static answers** — `src/agent/`. Deterministic facts + tax math route around the AI
  (zero cost / zero 429); only real conversation hits Gemini. AI never produces a number.
- ✅ **Execution logging** — `src/observability/log.ts` (JSON evidence trail for judging).
- ✅ **Conversational onboarding** — `src/agent/onboarding.ts`. New user → profession (scheme detect) →
  turnover → payment mode → DPDP consent → first estimate. Persisted; onboarded users route normally.
- ✅ **Durable persistence** — `FileUserStore`/`FileEventStore` survive restarts (events.jsonl = portable log).
- ✅ **Simulation suite + issues report** — 3 sims on real Kaggle data; fixed 5 issues (`ISSUES-AND-RISKS.md`).
- ✅ **34 tests pass** (`node --test`), incl. the TAX-04 §87A-on-net fix + full onboarding flow.
- ⏳ Bill capture (Gemini vision) → month-end tax bill → Razorpay → official-BSP swap → website.

## 1a. International (region-based) — NEW direction
TaxEasy is global: at onboarding the user **picks their region** and the agent customizes to it
(language, currency, tax engine). Implemented in `src/regions/registry.ts` + a region-first onboarding step.
- **Legal safety:** we only emit tax *numbers* for a region whose engine is implemented + verified
  (`supported: true`). **India is the launch region (live).** US/UK/UAE/CA/SG/AU are registered but
  **"coming soon"** — those users are waitlisted and the agent never computes tax it can't stand behind.
- **Per-region work to make a region live:** correct tax rules (own `tax-rules`), currency formatting
  (`formatMoney`), local languages, deadlines/compliance. One region at a time, each CA-reviewed.
- Currency stays ₹ (India) until a second engine lands; then i18n money is parameterized via `formatMoney`.

## 2. Platform — DECIDED: Google-native (see hackathon banner above)
Gemini + Firebase. Engine + AI wrapper were built model-agnostic, so this was a clean swap.

---

## 3. Model + effort — the product's runtime AI
Hard-coded engine answers anything deterministic (deadlines, slabs, the tax math). Only genuine NL hits Claude.

| Runtime job | Model (tier) | Notes |
|---|---|---|
| Categorize expense / read bill (vision) | Gemini Flash (`fast`) | High volume |
| Explain a concept, simple Q&A | Gemini Flash (`fast`) | Static facts answered with 0 AI calls |
| Segment classification (onboarding) | Gemini Pro (`smart`) | Wrong segment = wrong scheme |
| Reconciliation / GSTR-2B netting | Gemini Pro (`smart`) | Multi-step, money-sensitive |
| Foreign income / edge cases | Gemini Pro (`smart`) | Rare, high blast radius |

Verify model IDs in Google AI Studio (`gemini-2.5-flash` / `gemini-2.5-pro` as of build). Backoff + queue,
no cross-provider fallback. The hard-coded engine — not any model — produces every tax number.

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

## 6a. Architecture guarantees (founder requirements — built in, tested)
**Adaptive agentic system.** Each user has a persisted **UserModel** (`src/agent/user-model.ts`): language
(en/hi/hinglish), verbosity, tech level, segment, learned facts — updated every message. `TaxEasyAgent`
composes a per-user adapted system prompt, so one codebase serves a detailed-English doctor and a
one-line-Hinglish gig worker differently, automatically. Adaptation grows richer as we add onboarding +
behavioural signals.

**Zero-data-loss mobility.** Hexagonal **ports** (`src/ports/`) — the agent depends only on
`UserStore`/`EventStore`/`DocStore` interfaces, never a concrete cloud. Firestore/Postgres/S3 are swappable
adapters. The **append-only event log is the source of truth**; all other state is a replayable projection.
Migration = `exportLog` → `replayInto` a fresh store → verify (tested: export→replay→byte-identical history).
No provider can lock in your data. AI provider is likewise swappable (`LlmClient`).

## 6b. Channel transport (decided, with guardrails)
- **Interim:** **OpenWA** (self-hosted gateway) as the WhatsApp transport until the official Meta BSP is
  approved. Built behind the `Channel` port (`src/channels/openwa.ts`) — OpenWA's code stays out of our
  repo; we only call its REST API. Webhook HMAC verification + loop/group guards + idempotency enforced.
- **Guardrails (non-negotiable):** use a **separate throwaway number** (a ban must not touch the future
  official WABA); keep **Telegram as the zero-risk dev channel**; minimise sensitive data over OpenWA.
- **Production target:** swap `OpenWaChannel` → official BSP adapter (Twilio/AiSensy/Wati). One file; the
  agent, engine and runtime are unchanged. Tracked as release-blocking in `SECURITY.md`.

## 7. Never compromise
1. The tax numbers are right (re-verify each 1 April after the Budget).
2. The AI never does math — engine computes, Claude explains.
3. You're a tool, not an advisor — "compare," never "recommend." Disclaimer on every calculation.
