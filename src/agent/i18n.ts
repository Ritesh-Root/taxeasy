/**
 * Deterministic message catalog (i18n) — the multilingual surface for everything
 * the agent says WITHOUT the AI: onboarding, static facts, advisory templates.
 *
 * Why a catalog and not AI translation: ₹ figures and statutory numbers must
 * never be mistranslated, and there's no per-message AI cost/latency. Numbers are
 * injected as {vars} already formatted with toLocaleString("en-IN"); only the
 * surrounding prose is translated. The AI conversational fallback adapts language
 * separately via adaptSystemPrompt (user-model.ts).
 */
import type { UserModelData } from "../ports/types.ts";

export type Lang = UserModelData["language"]; // "en" | "hi" | "hinglish"

type Catalog = Record<string, Record<Lang, string>>;

/** All strings. Keep {placeholders} identical across languages. */
const CATALOG: Catalog = {
  "onboard.welcome": {
    en: "👋 Welcome to TaxEasy — your tax & bills helper for FY2025-26.\nI'll set you up in 4 quick questions.\n\n1/4 — What's your work or business? (e.g. \"freelance developer\", \"kirana store\", \"doctor\")",
    hi: "👋 TaxEasy में आपका स्वागत है — FY2025-26 के लिए आपका टैक्स और बिल सहायक।\nमैं 4 छोटे सवालों में आपको सेट कर दूँगा।\n\n1/4 — आप क्या काम/व्यापार करते हैं? (जैसे \"फ्रीलांस डेवलपर\", \"किराना दुकान\", \"डॉक्टर\")",
    hinglish: "👋 TaxEasy me aapka swagat hai — FY2025-26 ke liye aapka tax aur bills helper.\n4 chhote sawaalon me set kar deta hoon.\n\n1/4 — Aap kya kaam/business karte ho? (jaise \"freelance developer\", \"kirana store\", \"doctor\")",
  },
  "onboard.profession_ack": {
    en: "Got it — {work} (likely {scheme} presumptive scheme).\n\n2/4 — Roughly, your yearly income / turnover? (e.g. \"18,00,000\" or \"18 lakh\")",
    hi: "ठीक है — {work} ({scheme} प्रिज़म्प्टिव स्कीम के अंतर्गत)।\n\n2/4 — मोटे तौर पर, आपकी सालाना आमदनी / टर्नओवर कितना है? (जैसे \"18,00,000\" या \"18 लाख\")",
    hinglish: "Theek hai — {work} (lagta hai {scheme} presumptive scheme).\n\n2/4 — Mota-mota, aapka saalana income / turnover kitna hai? (jaise \"18,00,000\" ya \"18 lakh\")",
  },
  "onboard.turnover_ack": {
    en: "Noted ₹{amount}/year.\n\n3/4 — Do you receive most payments digitally (UPI / bank) or in cash?",
    hi: "नोट किया ₹{amount}/साल।\n\n3/4 — आपको ज़्यादातर पेमेंट डिजिटल (UPI / बैंक) में मिलती है या कैश में?",
    hinglish: "Note kiya ₹{amount}/saal.\n\n3/4 — Aapko zyada payment digital (UPI / bank) me milti hai ya cash me?",
  },
  "onboard.turnover_reask": {
    en: "Please send your yearly amount as a number, e.g. \"1800000\" or \"18 lakh\".",
    hi: "कृपया अपनी सालाना रकम संख्या में भेजें, जैसे \"1800000\" या \"18 लाख\"।",
    hinglish: "Apni saalana amount number me bhejo, jaise \"1800000\" ya \"18 lakh\".",
  },
  "onboard.mode_digital": {
    en: "Great, mostly digital.\n\n4/4 — Which data may I use to help you? Reply with any of: income, gst, bills, bank, notices — or \"all\". You can change this anytime.",
    hi: "बढ़िया, ज़्यादातर डिजिटल।\n\n4/4 — मैं आपकी मदद के लिए कौन-सा डेटा इस्तेमाल करूँ? इनमें से कोई भी भेजें: income, gst, bills, bank, notices — या \"all\"। आप इसे कभी भी बदल सकते हैं।",
    hinglish: "Badhiya, zyadatar digital.\n\n4/4 — Aapki help ke liye main kaun-sa data use karun? Inme se koi bhi bhejo: income, gst, bills, bank, notices — ya \"all\". Ise kabhi bhi badal sakte ho.",
  },
  "onboard.mode_cash": {
    en: "Okay, mostly cash.\n\n4/4 — Which data may I use to help you? Reply with any of: income, gst, bills, bank, notices — or \"all\". You can change this anytime.",
    hi: "ठीक है, ज़्यादातर कैश।\n\n4/4 — मैं आपकी मदद के लिए कौन-सा डेटा इस्तेमाल करूँ? इनमें से कोई भी भेजें: income, gst, bills, bank, notices — या \"all\"। आप इसे कभी भी बदल सकते हैं।",
    hinglish: "Theek hai, zyadatar cash.\n\n4/4 — Aapki help ke liye main kaun-sa data use karun? Inme se koi bhi bhejo: income, gst, bills, bank, notices — ya \"all\".",
  },
  "onboard.complete": {
    en: "✅ You're all set! Sharing: {shared}.",
    hi: "✅ सब तैयार है! आप साझा कर रहे हैं: {shared}।",
    hinglish: "✅ Sab set hai! Aap share kar rahe ho: {shared}.",
  },
  "onboard.ask_anything": {
    en: "Ask me anything — \"my tax?\", \"do I need GST?\", or send a bill photo.",
    hi: "मुझसे कुछ भी पूछें — \"मेरा टैक्स?\", \"क्या मुझे GST चाहिए?\", या बिल की फ़ोटो भेजें।",
    hinglish: "Mujhse kuch bhi poocho — \"mera tax?\", \"GST chahiye kya?\", ya bill ki photo bhejo.",
  },
  "estimate.zero": {
    en: "📊 First estimate: {scheme}, presumptive income ₹{income} → tax ₹0 (new regime). You're within the §87A rebate — ₹0 tax.",
    hi: "📊 पहला अनुमान: {scheme}, प्रिज़म्प्टिव आमदनी ₹{income} → टैक्स ₹0 (नई व्यवस्था)। आप §87A छूट के अंदर हैं — ₹0 टैक्स।",
    hinglish: "📊 Pehla estimate: {scheme}, presumptive income ₹{income} → tax ₹0 (new regime). Aap §87A rebate ke andar ho — ₹0 tax.",
  },
  "estimate.nonzero": {
    en: "📊 First estimate: {scheme}, presumptive income ₹{income} → tax ₹{tax} (new regime).",
    hi: "📊 पहला अनुमान: {scheme}, प्रिज़म्प्टिव आमदनी ₹{income} → टैक्स ₹{tax} (नई व्यवस्था)।",
    hinglish: "📊 Pehla estimate: {scheme}, presumptive income ₹{income} → tax ₹{tax} (new regime).",
  },
  "disclaimer": {
    en: "⚠️ Calculations use published CBDT/CBIC rules for FY2025-26. Verify before filing. TaxEasy is a calculation tool, not a CA firm.",
    hi: "⚠️ गणनाएँ FY2025-26 के लिए प्रकाशित CBDT/CBIC नियमों पर आधारित हैं। फ़ाइल करने से पहले जाँच लें। TaxEasy एक कैलकुलेशन टूल है, CA फर्म नहीं।",
    hinglish: "⚠️ Calculations FY2025-26 ke CBDT/CBIC rules par based hain. File karne se pehle verify karein. TaxEasy ek calculation tool hai, CA firm nahi.",
  },
  // ---- static facts ----
  "static.gst_due_dates": {
    en: "GST due dates: GSTR-1 by the 11th, GSTR-3B by the 20th (monthly) of the next month. QRMP filers: GSTR-3B on 22nd–24th quarterly.",
    hi: "GST की तारीख़ें: GSTR-1 अगले महीने की 11 तारीख़ तक, GSTR-3B 20 तारीख़ तक (मासिक)। QRMP वाले: GSTR-3B त्रैमासिक 22–24 तारीख़।",
    hinglish: "GST due dates: GSTR-1 agle mahine ki 11th tak, GSTR-3B 20th tak (monthly). QRMP wale: GSTR-3B quarterly 22nd–24th.",
  },
  "static.gst_threshold": {
    en: "GST registration thresholds (FY2025-26): services ₹20L (₹10L lower-threshold states); goods ₹40L.",
    hi: "GST रजिस्ट्रेशन सीमा (FY2025-26): सेवाएँ ₹20L (कुछ राज्यों में ₹10L); सामान ₹40L।",
    hinglish: "GST registration limit (FY2025-26): services ₹20L (kuch states me ₹10L); goods ₹40L.",
  },
  "static.advance_tax_dates": {
    en: "Advance tax: 15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%). Presumptive (44ADA/44AD) filers may pay 100% by 15 March. Only if tax payable ≥ ₹10,000.",
    hi: "एडवांस टैक्स: 15 जून (15%), 15 सितंबर (45%), 15 दिसंबर (75%), 15 मार्च (100%)। प्रिज़म्प्टिव (44ADA/44AD) वाले 15 मार्च तक 100% दे सकते हैं। केवल अगर टैक्स ≥ ₹10,000।",
    hinglish: "Advance tax: 15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%). Presumptive (44ADA/44AD) wale 15 March tak 100% de sakte hain. Sirf agar tax ≥ ₹10,000.",
  },
  "static.itr_deadlines": {
    en: "ITR deadlines (FY2025-26): ITR-1/2 (salaried) 31 Jul 2026; ITR-3/4 (business/presumptive, no audit) 31 Aug 2026; with audit 31 Oct 2026.",
    hi: "ITR की तारीख़ें (FY2025-26): ITR-1/2 (वेतनभोगी) 31 जुलाई 2026; ITR-3/4 (व्यापार/प्रिज़म्प्टिव, बिना ऑडिट) 31 अगस्त 2026; ऑडिट के साथ 31 अक्टूबर 2026।",
    hinglish: "ITR deadlines (FY2025-26): ITR-1/2 (salaried) 31 Jul 2026; ITR-3/4 (business/presumptive, no audit) 31 Aug 2026; audit ke saath 31 Oct 2026.",
  },
  "static.new_regime_slabs": {
    en: "New-regime slabs FY2025-26: 0–4L 0% · 4–8L 5% · 8–12L 10% · 12–16L 15% · 16–20L 20% · 20–24L 25% · above 24L 30%. §87A rebate → ₹0 tax up to ₹12L taxable.",
    hi: "नई व्यवस्था स्लैब FY2025-26: 0–4L 0% · 4–8L 5% · 8–12L 10% · 12–16L 15% · 16–20L 20% · 20–24L 25% · 24L से ऊपर 30%। §87A छूट → ₹12L तक ₹0 टैक्स।",
    hinglish: "New-regime slabs FY2025-26: 0–4L 0% · 4–8L 5% · 8–12L 10% · 12–16L 15% · 16–20L 20% · 20–24L 25% · 24L se upar 30%. §87A rebate → ₹12L tak ₹0 tax.",
  },
  "static.lut_renewal": {
    en: "Export of services is 0% IGST only with a valid LUT (Form RFD-11). It expires every 31 March — renew before 1 April or exports attract 18% IGST.",
    hi: "सेवाओं का निर्यात 0% IGST तभी जब वैध LUT (Form RFD-11) हो। यह हर 31 मार्च को समाप्त होता है — 1 अप्रैल से पहले रिन्यू करें वरना 18% IGST लगेगा।",
    hinglish: "Services ka export 0% IGST tabhi jab valid LUT (Form RFD-11) ho. Ye har 31 March ko expire hota hai — 1 April se pehle renew karo warna 18% IGST lagega.",
  },
  "static.late_fee": {
    en: "GST late fee ≈ ₹50/day (₹25 CGST + ₹25 SGST), ₹20/day for nil returns, capped ₹5,000/return, plus 18%/yr interest on tax due. (Planning estimate — verify before relying on it.)",
    hi: "GST लेट फीस ≈ ₹50/दिन (₹25 CGST + ₹25 SGST), nil रिटर्न पर ₹20/दिन, अधिकतम ₹5,000/रिटर्न, साथ ही बकाया टैक्स पर 18%/साल ब्याज। (अनुमान — भरोसा करने से पहले जाँचें।)",
    hinglish: "GST late fee ≈ ₹50/din (₹25 CGST + ₹25 SGST), nil return par ₹20/din, max ₹5,000/return, aur due tax par 18%/saal interest. (Estimate — verify karein.)",
  },
  "static.deadlines_overview": {
    en: "Key recurring deadlines: GSTR-1 11th · GSTR-3B 20th · advance tax 15 Jun/Sep/Dec/Mar · ITR-3/4 (business) 31 Aug · LUT renewal by 1 Apr. I can remind you before each.",
    hi: "मुख्य तारीख़ें: GSTR-1 11 · GSTR-3B 20 · एडवांस टैक्स 15 जून/सित/दिस/मार्च · ITR-3/4 (व्यापार) 31 अगस्त · LUT रिन्यू 1 अप्रैल तक। मैं हर एक से पहले याद दिला सकता हूँ।",
    hinglish: "Main deadlines: GSTR-1 11th · GSTR-3B 20th · advance tax 15 Jun/Sep/Dec/Mar · ITR-3/4 (business) 31 Aug · LUT renew 1 April tak. Main har ek se pehle yaad dila sakta hoon.",
  },
  // ---- router: estimate ----
  "router.estimate": {
    en: "Scheme: {scheme} · presumptive income ₹{income} ({rate}% of ₹{gross}).\nEstimated tax: ₹{tax} (new regime).",
    hi: "स्कीम: {scheme} · प्रिज़म्प्टिव आमदनी ₹{income} (₹{gross} का {rate}%)।\nअनुमानित टैक्स: ₹{tax} (नई व्यवस्था)।",
    hinglish: "Scheme: {scheme} · presumptive income ₹{income} (₹{gross} ka {rate}%).\nEstimated tax: ₹{tax} (new regime).",
  },
  "note.zero_rebate": {
    en: " You're within the §87A rebate — ₹0 tax.",
    hi: " आप §87A छूट के अंदर हैं — ₹0 टैक्स।",
    hinglish: " Aap §87A rebate ke andar ho — ₹0 tax.",
  },
  "router.estimate_incomplete": {
    en: "To estimate your tax I need two things: (1) what you do (e.g. \"freelance developer\"), and (2) your yearly gross receipts/turnover. Send both and I'll calculate.",
    hi: "टैक्स का अनुमान लगाने के लिए मुझे दो चीज़ें चाहिए: (1) आप क्या करते हैं, और (2) आपकी सालाना आमदनी/टर्नओवर। दोनों भेजें और मैं गणना कर दूँगा।",
    hinglish: "Tax estimate ke liye mujhe do cheezein chahiye: (1) aap kya karte ho, aur (2) saalana income/turnover. Dono bhejo, main calculate kar dunga.",
  },
  // ---- advisory ----
  "advisory.gst_required": {
    en: "Turnover ₹{turnover} exceeds the ₹{threshold} {kind} threshold — registration required. I can walk you through it; small traders can opt for the composition scheme (~1% of turnover, simpler returns).",
    hi: "टर्नओवर ₹{turnover} ₹{threshold} {kind} सीमा से ऊपर है — रजिस्ट्रेशन ज़रूरी है। मैं मदद कर सकता हूँ; छोटे व्यापारी कंपोज़िशन स्कीम (~1% टर्नओवर, आसान रिटर्न) चुन सकते हैं।",
    hinglish: "Turnover ₹{turnover} ₹{threshold} {kind} limit se upar hai — registration zaroori hai. Main guide kar sakta hoon; chhote traders composition scheme (~1% turnover, aasaan returns) le sakte hain.",
  },
  "advisory.gst_not_required": {
    en: "Turnover ₹{turnover} is below the ₹{threshold} {kind} threshold — registration optional. You can still register voluntarily if your buyers want input credit.",
    hi: "टर्नओवर ₹{turnover} ₹{threshold} {kind} सीमा से नीचे है — रजिस्ट्रेशन ज़रूरी नहीं। अगर खरीदार इनपुट क्रेडिट चाहें तो आप स्वेच्छा से रजिस्टर कर सकते हैं।",
    hinglish: "Turnover ₹{turnover} ₹{threshold} {kind} limit se neeche hai — registration optional hai. Agar buyers input credit chahein to aap voluntarily register kar sakte ho.",
  },
  "advisory.presumptive_yes": {
    en: "Yes — at ₹{gross} you're within the {scheme} cap (₹{cap}), so you can use presumptive taxation.",
    hi: "हाँ — ₹{gross} पर आप {scheme} सीमा (₹{cap}) के अंदर हैं, तो आप प्रिज़म्प्टिव टैक्सेशन इस्तेमाल कर सकते हैं।",
    hinglish: "Haan — ₹{gross} par aap {scheme} cap (₹{cap}) ke andar ho, to presumptive taxation use kar sakte ho.",
  },
  "advisory.presumptive_no": {
    en: "No — ₹{gross} exceeds the {scheme} cap (₹{cap}). You'll need books (income − expenses) and likely a tax audit.",
    hi: "नहीं — ₹{gross} {scheme} सीमा (₹{cap}) से ऊपर है। आपको बही-खाता (आय − खर्च) रखना होगा और शायद ऑडिट भी।",
    hinglish: "Nahi — ₹{gross} {scheme} cap (₹{cap}) se upar hai. Aapko books (income − expense) rakhni hongi aur shaayad audit bhi.",
  },
  // ---- proactive insights ----
  "insights.gst": {
    en: "⚠️ GST: turnover ₹{turnover} crosses the ₹{threshold} {kind} threshold — registration likely required. I can guide you.",
    hi: "⚠️ GST: टर्नओवर ₹{turnover} ₹{threshold} {kind} सीमा पार करता है — रजिस्ट्रेशन ज़रूरी हो सकता है। मैं मदद कर सकता हूँ।",
    hinglish: "⚠️ GST: turnover ₹{turnover} ₹{threshold} {kind} limit cross karta hai — registration zaroori ho sakta hai. Main guide kar sakta hoon.",
  },
  "insights.near_cap": {
    en: "📈 You're close to the {scheme} presumptive cap (₹{cap}) — crossing it means books + audit.",
    hi: "📈 आप {scheme} प्रिज़म्प्टिव सीमा (₹{cap}) के क़रीब हैं — पार करने पर बही-खाता + ऑडिट ज़रूरी।",
    hinglish: "📈 Aap {scheme} presumptive cap (₹{cap}) ke kareeb ho — cross karne par books + audit.",
  },
  "insights.advance_tax": {
    en: "🗓️ Advance tax ≈ ₹{tax} this year — pay 100% by 15 March (presumptive). I'll remind you before the date.",
    hi: "🗓️ इस साल एडवांस टैक्स ≈ ₹{tax} — 15 मार्च तक 100% भरें (प्रिज़म्प्टिव)। मैं तारीख़ से पहले याद दिला दूँगा।",
    hinglish: "🗓️ Is saal advance tax ≈ ₹{tax} — 15 March tak 100% bharo (presumptive). Main date se pehle yaad dila dunga.",
  },
  "kind.goods": { en: "goods", hi: "सामान", hinglish: "goods" },
  "kind.services": { en: "services", hi: "सेवाओं", hinglish: "services" },
};

/** Render a catalog key in the given language with {var} substitution. */
export function t(key: string, lang: Lang, vars: Record<string, string | number> = {}): string {
  const entry = CATALOG[key];
  const template = entry?.[lang] ?? entry?.en ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** True if we have a catalog entry for this key (used by the router). */
export function hasKey(key: string): boolean {
  return key in CATALOG;
}
