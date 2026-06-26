# TaxEasy — your CA, on WhatsApp 🇮🇳

**An AI agent that gives every Indian small-business owner their own chartered accountant —
tax, GST & bills help, in Hindi, Hinglish, or English.**

Built for the **Build with Gemini XPRIZE** · category **Small Business Services**.

> **AI explains; a hard-coded engine calculates.** Every ₹ figure comes from a deterministic
> FY2025-26 tax engine — the AI never produces a tax number, so a hallucinated figure is
> structurally impossible. That's the trust moat of a tax product.

---

## What it does
Message it on WhatsApp and it:
- **Onboards** you in 4 questions (detects your business, tax scheme, and language).
- **Answers** tax / GST / bills questions — precisely, from the engine.
- **Guides proactively** — flags GST thresholds, advance-tax/ITR/GSTR deadlines, savings, near-cap warnings.
- **Adapts** to each user's language (Hindi/Hinglish/English) and literacy.
- Runs **autonomously** — the AI operates the service; the founder sets strategy.

## AI-native operations (what the AI does vs. the human)
| AI (Gemini) | Deterministic engine | Founder |
|---|---|---|
| Understands messages, detects language + segment, explains, reads bills (vision), reminds, converses — per message, 24/7 | Computes **every** tax/GST number (correct by construction) | Strategy + compliance; user taps to file (the law's part) |

Every agent decision is logged as JSON (`src/observability/log.ts`) — an evidence trail of AI in production.

## Architecture (hexagonal, swap-anything)
```
WhatsApp / Telegram ─▶ Channel port ─▶ runtime ─▶ TaxEasyAgent
                                                     ├─ onboarding (4-step, localized)
                                                     ├─ router  ── static facts (i18n, 0 AI)
                                                     │           ── engine-backed advisory (GST/tax/notice/value)
                                                     │           ── Gemini (only true conversation)
                                                     ├─ tax engine  (hard-coded FY2025-26 — the moat)
                                                     ├─ adaptive UserModel (lang/verbosity/literacy)
                                                     └─ ports: UserStore · EventStore · DocStore
```
- **Swappable adapters** for AI (Gemini), transport (WhatsApp/Telegram), and storage (file/Firestore) — vendor-independent.
- **Append-only event log = source of truth** → zero-data-loss server migration (`exportLog`/`replayInto`).

## Run it
Node 24+ (native TypeScript — no build step, zero dependencies).
```bash
node --test 'src/**/*.test.ts'     # 45 tests
node src/bot/demo.ts               # scripted onboarding + Q&A (mock AI)
node src/bot/cli.ts                # chat in your terminal (set GEMINI_API_KEY for real AI)
GEMINI_API_KEY=xxx node src/sim/persona-sim.ts --llm   # Gemini Flash role-plays Indian clients
```

## Proof it works (simulation on real data)
- `src/sim/engine-stress.ts` — engine correctness on dense input grids.
- `sim/itc_anomaly_sim.py` — ITC + anomaly on 2,176 **real** Indian transactions (Kaggle).
- `src/sim/persona-sim.ts` — 6 Indian personas use the live agent. Agent "punt rate" 33% → 21%,
  language mismatches 16 → 0, low-literacy Hindi user fully served. See `USER-SIMULATION-REPORT.md`.

## Docs
- `BUILD-PLAN.md` — roadmap + model/effort plan · `SECURITY.md` — security gate
- `ISSUES-AND-RISKS.md` · `USER-SIMULATION-REPORT.md` — findings & fixes
- `docs/PITCH-DECK.md` · `docs/STARTUP-DESCRIPTION.md`

*TaxEasy is a calculation tool, not a CA firm. Verify before filing.*
