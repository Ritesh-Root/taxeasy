# TaxEasy — Client Simulation Report ("does it feel like a CA?")

**Method:** 6 realistic Indian small-business personas *used* the live agent end-to-end (onboarding + their
real concerns), via `src/sim/persona-sim.ts`. Transcripts in `sim/out/`. Scripted mode (agent-AI = mock) for
this run; an emergent mode where **Gemini Flash role-plays each client** runs with `--llm` + a key.

> Goal isn't "pass a few tax rules" — it's whether each owner gets a **proactive CA that guides and suggests**.

## Personas
Lakshmi (kirana ₹60L, Hindi) · Ravi (freelance dev ₹18L foreign, Hinglish) · Dr. Mehta (doctor ₹40L, English)
· Arjun (gig ₹4.5L, Hinglish) · Priya (creator ₹25L, English) · Suresh (wholesaler ₹1.2Cr, English).

---

## The headline
**Onboarding is smooth and fast; then the agent falls off a cliff at the first real CA question.** Every
persona's actual concerns — GST, foreign income, depreciation, ITC netting, "is ₹200 worth it" — hit a
generic *"Here's a plain-language explanation."* The engine often *could* answer; the router just wasn't
wired to it. We fixed the biggest slice this session and the rest is the roadmap to a real agentic CA.

## Findings

| # | What the client felt | Sev | Status |
|---|----------------------|-----|--------|
| S1 | **Advisory cliff.** Real questions punted to generic AI instead of engine-backed answers. | 🔴 | ✅ **Started** — GST-registration + presumptive-eligibility now answered by the engine (multilingual). AI-share 33%→29%; high-value Qs now specific. |
| S2 | **Not proactive.** After onboarding the agent just waited — a CA would flag what matters. | 🔴 | ✅ **Started** — onboarding now volunteers GST-threshold / advance-tax / near-cap insights from the profile (`proactiveInsights`). Lakshmi & Suresh now warned about GST unprompted. |
| S3 | **Language barrier.** Hindi/Hinglish users (Lakshmi, Ravi, Arjun) got all-English onboarding + templates (16 mismatches). For a mass-market "every small business" product this is a hard blocker. | 🔴 | ⚠️ **Open** — localise onboarding + static/engine templates (Hindi/Hinglish), or generate them via Gemini in the user's language. |
| S4 | **"₹0 tax" is misleading for traders.** Suresh (₹1.2Cr) is told "tax ₹0" — true for *income* tax under presumptive, but ignores his real **GST liability**. Reassuring him wrongly. | 🟠 | ⚠️ **Open** — for GST-registered/large traders, lead with GST liability, not just income tax; build output−input ITC netting. |
| S5 | **Value-justification whiff (churn).** Arjun: "my tax is ₹0, why pay ₹200/mo?" → punted. The exact conversion moment, missed. | 🟠 | ⚠️ **Open** — when tax = ₹0, pivot to the value story (bills, reminders, notices) + the free tier. |
| S6 | **Emotional / trust moments punted.** Lakshmi: "ye samajh nahi aata, aap hi sambhal lo" and "notice aayega?" → generic. A CA reassures + acts. | 🟠 | ⚠️ **Open** — handle reassurance + a notice/penalty intent; hand-hold low-literacy users. |
| S7 | **Missing CA features** surfaced as punts: foreign income (Ravi), depreciation/WDV (Dr. Mehta), client invoicing + dunning (Priya), GST netting + multi-GSTIN (Suresh). | 🟡 | ⚠️ Roadmap P2–P4; until built, say "not yet — coming soon" rather than a vague AI answer. |

## What "agentic CA" means after this run
The agent must do three things it mostly didn't:
1. **Volunteer** the high-value, deterministic insights it can already compute (GST threshold, advance tax,
   near-cap, ₹0-tax value pivot) — *started* (`proactiveInsights`).
2. **Answer advisory questions from the engine**, multilingually, not punt to generic prose — *started*
   (GST registration, presumptive eligibility).
3. **Speak the user's language** — *open*, and the single biggest blocker for the mass market.

## Recommended next steps (priority)
1. 🔴 **Multilingual onboarding + templates** (S3) — unblock Hindi/Hinglish owners; the mass market.
2. 🔴 **Expand the proactive/advisory layer** (S1/S2/S5/S6) — notice/penalty intent, ₹0-tax value pivot,
   reassurance; schedule periodic proactive nudges (advance-tax, deadlines).
3. 🟠 **GST liability for traders** (S4) — output−input netting; lead with it for registered businesses.
4. 🟡 **Feature build-out** (S7) — foreign income, depreciation, invoicing+dunning, multi-GSTIN.
5. Run the **emergent (`--llm`) simulation** with a Gemini key to stress the agent with unscripted clients.
