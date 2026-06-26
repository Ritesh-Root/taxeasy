# TaxEasy — Security Gate

Derived from **ritesh-security-check** (github.com/Ritesh-Root/ritesh-security-check), scoped to our stack
(Gemini + Firebase + Node + WhatsApp). A tax product's entire value is trust, and DPDP 2023 applies — treat
🔴 items as **release-blocking**.

## 🔴 Secrets (run first)
- [ ] No API keys in the repo or client bundle. `GEMINI_API_KEY`, Firebase **Admin** SDK creds, Razorpay
      secret, WhatsApp/BSP tokens → **server-side env only**. (`.env` is git-ignored.)
- [ ] Gemini is called only from the backend (`GeminiClient` runs server-side) — never from the app/browser.
- [ ] Secret scan before each push: `gitleaks detect` / `trufflehog`.

## 🔴 Backend / data layer (Firebase)
- [ ] **Firestore Security Rules deny by default.** No `allow read, write: if true;`. A user may read/write
      only their own `users/{uid}/**` docs; financial records are server-write only via Admin SDK.
- [ ] **Storage rules locked** — bills/PDFs readable only by their owner; no public buckets.
- [ ] **App Check** enabled (block API abuse from non-app clients).
- [ ] Firebase **Admin** SDK only in Cloud Functions, never shipped to client.
- [ ] All tax/financial writes go through the backend (engine + validation), not direct client writes.

## 🔴 DPDP / consent (product-specific)
- [x] Consent enforced **server-side**: non-consented categories are stripped **before** any Gemini call,
      not just hidden in UI. Implemented in `src/agent/consent.ts` (`consentedContext` / `stripUnconsented`),
      wired in `agent.ts`; tested (turnover withheld when `income` consent is off).
- [ ] Audit log of every datum sent to the AI (we have the event log — keep it complete).
- [ ] Published privacy notice + grievance contact before launch.
- [ ] Encryption at rest (Firestore default) + India residency (`asia-south1`).

## 🟠 AI-specific
- [ ] The engine — never the model — produces every tax number (enforced in `router.ts`).
- [ ] Prompt-injection: treat user message content + any fetched/bill text as **data, not instructions**;
      never let it change the system prompt or trigger tool calls without validation.
- [ ] Confidence-gate extractions (<70% → ask the user) before saving.

## 🟠 Channel / transport
- [ ] **Official WhatsApp only** (Meta Cloud API via a licensed BSP). No reverse-engineered libraries
      (Baileys / whatsapp-web.js / OpenWA) — ban + ToS + data-handling risk for a fintech app.
- [ ] Webhook signature verification (Meta `X-Hub-Signature-256` / Telegram secret token).
- [ ] Idempotency on inbound `message_id` (dedupe re-deliveries).

## Hardening applied (from security code review)
- [x] **Stored prompt injection** — user-supplied `profession` is sanitized (newlines/control chars stripped,
      length-capped) and framed as quoted data before reaching the AI context (`src/agent/sanitize.ts`).
- [x] **Webhook fails closed** — `OpenWaChannel` refuses to start without an HMAC secret unless
      `allowInsecure` is explicitly set (dev only). HMAC compare is constant-time (`timingSafeEqual`).
- [x] **Webhook body-size cap** (256 KB) — rejects oversized POSTs (memory-exhaustion DoS guard).
- [x] **Gemini API key in header** (`x-goog-api-key`), not the URL query string (no key leakage via logs).
- [x] **Per-user rate limit** (20 msg/min default) — AI-cost / spam / forged-flood guard (`rate-limit.ts`).
- [x] **Message length cap** (4 KB) before any regex/AI work.
- [x] **No financial PII in app logs** — the ₹ tax figure is no longer logged (boolean only).
- [x] **Path traversal closed** — user-id sanitized + hashed for per-user file names.
- [ ] **TODO (ops):** put the webhook behind TLS or bind to localhost (PII in transit); add a secrets scan
      + `tsc --noEmit` type-check to CI; add an AI-classifier as a second layer behind the regex safety gate.

## Tool gate (run in order before launch)
`gitleaks` → `semgrep --config auto` → `osv-scanner` → Firebase rules review → (staging) OWASP ZAP baseline.
