/**
 * Indian states/UTs by GST state code (the first two digits of a GSTIN).
 * Used to capture the user's state at onboarding and, for bills/invoices, to
 * tell intra-state (CGST+SGST) from inter-state (IGST) supplies.
 */
export interface IndianState {
  code: string;
  name: string;
  hi: string;
}

export const IN_STATES: readonly IndianState[] = [
  { code: "01", name: "Jammu and Kashmir", hi: "जम्मू और कश्मीर" },
  { code: "02", name: "Himachal Pradesh", hi: "हिमाचल प्रदेश" },
  { code: "03", name: "Punjab", hi: "पंजाब" },
  { code: "04", name: "Chandigarh", hi: "चंडीगढ़" },
  { code: "05", name: "Uttarakhand", hi: "उत्तराखंड" },
  { code: "06", name: "Haryana", hi: "हरियाणा" },
  { code: "07", name: "Delhi", hi: "दिल्ली" },
  { code: "08", name: "Rajasthan", hi: "राजस्थान" },
  { code: "09", name: "Uttar Pradesh", hi: "उत्तर प्रदेश" },
  { code: "10", name: "Bihar", hi: "बिहार" },
  { code: "11", name: "Sikkim", hi: "सिक्किम" },
  { code: "12", name: "Arunachal Pradesh", hi: "अरुणाचल प्रदेश" },
  { code: "13", name: "Nagaland", hi: "नागालैंड" },
  { code: "14", name: "Manipur", hi: "मणिपुर" },
  { code: "15", name: "Mizoram", hi: "मिज़ोरम" },
  { code: "16", name: "Tripura", hi: "त्रिपुरा" },
  { code: "17", name: "Meghalaya", hi: "मेघालय" },
  { code: "18", name: "Assam", hi: "असम" },
  { code: "19", name: "West Bengal", hi: "पश्चिम बंगाल" },
  { code: "20", name: "Jharkhand", hi: "झारखंड" },
  { code: "21", name: "Odisha", hi: "ओडिशा" },
  { code: "22", name: "Chhattisgarh", hi: "छत्तीसगढ़" },
  { code: "23", name: "Madhya Pradesh", hi: "मध्य प्रदेश" },
  { code: "24", name: "Gujarat", hi: "गुजरात" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", hi: "दादरा और नगर हवेली और दमन और दीव" },
  { code: "27", name: "Maharashtra", hi: "महाराष्ट्र" },
  { code: "29", name: "Karnataka", hi: "कर्नाटक" },
  { code: "30", name: "Goa", hi: "गोवा" },
  { code: "31", name: "Lakshadweep", hi: "लक्षद्वीप" },
  { code: "32", name: "Kerala", hi: "केरल" },
  { code: "33", name: "Tamil Nadu", hi: "तमिलनाडु" },
  { code: "34", name: "Puducherry", hi: "पुडुचेरी" },
  { code: "35", name: "Andaman and Nicobar Islands", hi: "अंडमान और निकोबार" },
  { code: "36", name: "Telangana", hi: "तेलंगाना" },
  { code: "37", name: "Andhra Pradesh", hi: "आंध्र प्रदेश" },
  { code: "38", name: "Ladakh", hi: "लद्दाख" },
  { code: "97", name: "Other Territory", hi: "अन्य क्षेत्र" },
];

const ALIASES: Record<string, string> = { orissa: "21", "new delhi": "07", up: "09", mp: "23", tn: "33", wb: "19", pondicherry: "34" };

/** GSTIN shape: 2-digit state code, PAN, entity number, "Z", check character. */
export const GSTIN_RX = /\b(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i;

export const stateByCode = (code: string) => IN_STATES.find((s) => s.code === code);

/** Find a state named in free text (English or Hindi; longest name wins). */
export function matchState(text: string): IndianState | undefined {
  const s = text.toLowerCase();
  const byLength = [...IN_STATES].sort((a, b) => b.name.length - a.name.length);
  const hit = byLength.find((st) => s.includes(st.name.toLowerCase()) || text.includes(st.hi));
  if (hit) return hit;
  const alias = Object.keys(ALIASES).find((a) => new RegExp(`\\b${a}\\b`).test(s));
  return alias ? stateByCode(ALIASES[alias]!) : undefined;
}
