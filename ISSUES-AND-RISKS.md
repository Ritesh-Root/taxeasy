# TaxEasy — Issues & Risks Report

**Method:** three simulations run against the actual codebase + **real Indian data** (2,176 real household
expense transactions from Kaggle, plus 20k UPI transactions available). Reproduce any time:
```bash
node src/sim/engine-stress.ts        # tax-engine correctness
python3 sim/itc_anomaly_sim.py       # ITC + anomaly on real transactions
node src/sim/routing-sim.ts          # agent routing + language
```
Severity: 🔴 critical (wrong tax / legal/GST exposure) · 🟠 high · 🟡 medium.

---

## A. Tax engine (correctness)

| # | Finding | Sev | Status |
|---|---------|-----|--------|
| A1 | **Over-limit turnover taxed at presumptive rate.** ₹3.1Cr turnover (> ₹3Cr 44AD cap) was taxed at 6% → ₹1.78L, a gross understatement (presumptive is illegal above the cap). | 🔴 | ✅ **Fixed** — estimate now withheld; books + audit flagged. |
| A2 | **Scheme mis-detection.** 7/7 traders with profession-like names ("medical store", "IT hardware shop", "engineering goods trader") were flagged §44ADA (50%) instead of §44AD (6/8%). | 🟠 | ✅ **Fixed** — trader tokens override profession words (now 0/7). |
| A3 | **Marginal-relief + cess micro-cliff at ₹12L.** Just above ₹12L, ₹100 more income adds ₹104 tax (relief caps tax at income−12L, then 4% cess is added on top → you can be ~₹4 worse off per ₹100). | 🟡 | ⚠️ **Open** — verify CBDT treatment; likely cap total *including* cess. Tiny absolute impact but a trust/correctness detail. |
| — | Invariants that PASSED: non-negative + monotonic tax across ₹0–40L (both regimes); ₹18L freelancer = ₹0. | — | ✅ |

## B. Bills: ITC + anomaly (real data, n=2,176 expenses)

| # | Finding | Sev | Status |
|---|---------|-----|--------|
| B1 | **ITC false-positive risk.** Classifier defaulted non-blocked → ELIGIBLE. On real data, **85% of "eligible" rows were actually personal**. Suggesting input credit on these = **GST exposure for the *user***. | 🔴 | ✅ **Fixed** — safe-by-default: eligible only on a business signal + GST invoice; personal→ineligible, unknown→review. Re-run on real data: **false-ITC 85.3% → 0%**. |
| B2 | **Anomaly alert fatigue.** Duplicate detector (category+amount within 7d) fired on **8.4%** of expenses + 1.6% σ-outliers → **~20 alerts/month** for a normal 200-expense user. Daily ₹30 train / ₹60 snacks look like "duplicates." | 🟠 | ⚠️ **Open** — match on vendor+amount+description (not category), tighter window, per-category baselines. |
| B3 | **Uninformative inputs.** **17%** of real notes are ≤3 chars; 90 distinct subcategories. AI categorization will be uncertain often. | 🟡 | ⚠️ **Open** — confidence-gate (<70% → ask the user) before saving (already a planned rule; enforce it). |

## C. Agent: routing + language

| # | Finding | Sev | Status |
|---|---------|-----|--------|
| C1 | **AI over-use.** Brittle static matching sent **59%** of messages to the LLM (target ~10%) — cost + 429 exposure. Strict `\b…\b` patterns even leaked "advance tax **dates**", "LUT **renewal**". | 🟠 | ✅ **Improved** — suffix-tolerant patterns + late-fee/reminder intents → **35%**, 0 misroutes. Push lower with a cheap classifier + answer cache. |
| C2 | Language detection (Hindi/Hinglish, incl. romanised). | — | ✅ 3/3 correct. |

## D. Cross-cutting risks (engineering / ops / business)

| # | Risk | Sev | Mitigation |
|---|------|-----|-----------|
| D1 | **OpenWA WhatsApp ban** mid-judging (unofficial transport). | 🔴 | Separate throwaway number; Telegram fallback; swap to official BSP (one file). Tracked in `SECURITY.md`. |
| D2 | **No persistence yet** — state is in-memory, lost on restart. | 🟠 | ✅ **Addressed** — file-based adapter (`FileUserStore`/`FileEventStore`) persists across restarts (tested); WhatsApp entry uses it by default. Firestore = same ports, drop in when GCP creds land. |
| D3 | **Tax-rule staleness** — Budget changes yearly. | 🟠 | Rules are versioned per FY; add a 1-April re-verify checklist. |
| D4 | **DPDP consent not yet enforced server-side.** | 🟠 | Wire the consent strip-before-AI in the agent (design done; `SECURITY.md` gate). |
| D5 | **Gemini quota / 429** on a new GCP project. | 🟡 | Backoff + routing in place; request quota on day 1 before load. |
| D6 | **Scope gaps:** foreign income (FIRC, USD→INR), salaried+business mix, full GST netting, depreciation. | 🟡 | Roadmap P2–P4; surface "not yet supported" rather than guess. |
| D7 | **Razorpay AutoPay success ~30–50%.** | 🟡 | Intelligent retry + WhatsApp dunning (planned). |

---

## Priority order to act
1. ~~B1 ITC default-eligible~~ ✅ fixed (false-ITC 85%→0%).
2. ~~D2 persistence~~ ✅ file adapter (Firestore later, same ports).
3. **D4 DPDP consent enforcement (🟠)** — strip OFF-toggle categories before any AI call, before real customer data.
4. **B2 anomaly tuning (🟠)** — vendor+amount+description, not category; cut ~20 alerts/mo.
5. **A3 marginal relief (🟡)** — confirm CBDT cess treatment.
6. **C1 push AI share <35%** — cheap classifier + answer cache.

*Fixed this session: A1, A2, B1, C1, D2.*
