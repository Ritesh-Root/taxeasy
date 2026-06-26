/**
 * Indian small-business personas for the client simulation. Each has a profile,
 * the language they speak, goals (what a real CA should help them with), and a
 * scripted journey (onboarding answers in their voice + their real concerns).
 *
 * The scripted journey runs with no API key. With GEMINI_API_KEY + --llm the
 * persona is instead role-played live by Gemini Flash (emergent behaviour).
 */
export type Lang = "en" | "hi" | "hinglish";

export interface Persona {
  id: string;
  name: string;
  blurb: string;
  lang: Lang;
  /** What a good "agentic CA" should proactively help them with. */
  goals: string[];
  /** Scripted turns (first ~5 answer onboarding, rest are their real concerns). */
  script: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "lakshmi",
    name: "Lakshmi (kirana store)",
    blurb: "kirana/grocery shop owner, ₹60L turnover, mostly cash, low tech literacy, speaks Hindi (Devanagari)",
    lang: "hi",
    goals: ["does she need GST registration", "fear of a tax notice", "keep it simple"],
    script: [
      "नमस्ते", "किराना दुकान", "60 लाख", "कैश", "income",
      "मुझे जीएसटी लेना पड़ेगा क्या?",
      "अगर नहीं लिया तो नोटिस आएगा?",
      "ये सब मुझे समझ नहीं आता, आप ही सँभाल लो",
    ],
  },
  {
    id: "ravi",
    name: "Ravi (freelance dev)",
    blurb: "freelance software developer, ₹18L from foreign clients (Upwork/US), speaks Hinglish",
    lang: "hinglish",
    goals: ["foreign income tax", "LUT for exports", "advance tax", "is ₹0 tax really correct"],
    script: [
      "hii bhai", "freelance software developer", "18 lakh", "digital", "all",
      "mera client US me hai, foreign income pe tax kaise lagega?",
      "LUT kya hota hai, mujhe lena chahiye?",
      "advance tax kab bharu?",
    ],
  },
  {
    id: "drmehta",
    name: "Dr. Mehta (doctor)",
    blurb: "private-practice doctor, ₹40L receipts, bought an ₹8L ultrasound machine, speaks English",
    lang: "en",
    goals: ["depreciation on equipment", "how to legally save tax", "advance tax schedule"],
    script: [
      "hello", "doctor private practice", "40 lakh", "digital", "all",
      "I bought an ultrasound machine for 8 lakh this year, can I claim it?",
      "how can I reduce my tax legally?",
      "remind me about my advance tax please",
    ],
  },
  {
    id: "arjun",
    name: "Arjun (gig worker)",
    blurb: "Rapido bike-taxi captain, ₹4.5L/year, low income, price-sensitive, low tech, Hinglish",
    lang: "hinglish",
    goals: ["do I even owe tax", "is paying ₹200 worth it for me", "simple reassurance"],
    script: [
      "hii", "rapido bike taxi captain", "4.5 lakh", "digital", "income",
      "mujhe tax dena hai ya nahi?",
      "to fir mai aapko 200 rupay kyu du har mahine?",
      "koi sarkari paisa milta hai kya humein?",
    ],
  },
  {
    id: "priya",
    name: "Priya (creator)",
    blurb: "Instagram creator, ₹25L from brand deals + AdSense, wants invoicing help, English",
    lang: "en",
    goals: ["invoice brands + chase payment", "GST on her services", "spotting a duplicate bill"],
    script: [
      "hey", "instagram content creator", "25 lakh", "digital", "all",
      "I need to send an invoice to Mamaearth for a brand deal, can you help?",
      "do I need to charge GST to them?",
      "I think I logged the same 60000 bill twice, can you check?",
    ],
  },
  {
    id: "suresh",
    name: "Suresh (wholesaler)",
    blurb: "garments wholesaler, ₹1.2Cr turnover, GST-registered, wants ITC netting, English",
    lang: "en",
    goals: ["ITC input-output netting", "multi-GSTIN", "is he above presumptive limit"],
    script: [
      "hello", "garments wholesale trader", "1.2 cr", "digital", "all",
      "how much GST do I actually pay after input credit?",
      "I have shops in two states, can you handle both GSTINs?",
      "can I use the presumptive scheme at my turnover?",
    ],
  },
];
