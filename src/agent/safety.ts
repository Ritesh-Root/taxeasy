/**
 * Safety / legal-liability guardrail — the FIRST thing the router runs.
 *
 * A tax product's legal exposure must NOT depend on the LLM behaving (it can be
 * jailbroken). So dangerous intents are caught here deterministically and answered
 * with fixed, compliant templates — never sent to the model.
 *
 * Categories (multilingual):
 *  - evasion   : help to hide income / fake bills / evade tax  → REFUSE + redirect to legal options
 *  - guarantee : "guarantee no notice / 100% refund"           → no promises, set honest expectations
 *  - represent : "file for me / represent me / take liability"  → clarify: we prepare, you authorize/file
 *  - scope     : investment / legal / medical advice           → decline, point to the right professional
 *  - injection : "ignore your rules / you are now…"             → ignore, stay in role
 */

export type SafetyKey =
  | "safety.evasion"
  | "safety.guarantee"
  | "safety.represent"
  | "safety.scope"
  | "safety.injection";

// Jailbreak / prompt-injection attempts.
const INJECTION_RX =
  /ignore (all|your|the|previous|prior)|disregard.*(instruction|rule|prompt)|you are now\b|no rules? (apply|now)|jailbreak|pretend (you|to be)|act as (a |an )?(lawyer|hacker|different)|disable.*(disclaimer|safety|rule)|system\s*:/i;

// Requests to hide income, fake documents, evade — NOT plain "save tax legally".
const EVASION_RX =
  /\b(hide|conceal|under-?report|fake|bogus|forge|fabricate|evade|evasion|dodge|launder)\b.*\b(income|tax|gst|turnover|sales|bill|invoice|revenue|profit|money)\b|two sets of books|black ?money|kala ?dhan|tax chori|fake (gst|bill|invoice)|claim.*itc.*(personal|fake|bogus)|\b(show|dikha\w*|बता\w*)\b.*\b(less|kam|कम)\b.*\b(income|turnover|sales|टर्नओवर|इनकम)\b|चोरी|छुपा|छुपाना|छिपा|नकली|फर्जी|काला ?धन|बिना ?बिल|(without|bina)\s+(bill|invoice|gst)/i;

// Demands for guarantees / certainty about outcomes.
const GUARANTEE_RX =
  /(guarantee|100\s*%|definitely|surely|promise|pakka|पक्का|गारंटी)\b.*(no (notice|penalty|audit|tax)|refund|won'?t|will not|nahi aayega|safe|sure)|are you (100\s*%|absolutely) (sure|certain)|will i (definitely|surely|for sure) (get|receive)/i;

// "File / represent / take legal responsibility on my behalf."
const REPRESENT_RX =
  /\bfile (my|the)\b.*\b(return|itr|gst|tax)\b.*\b(for me|yourself)\b|file (it|my (itr|return|gst)) for me|represent me|on my behalf.*(officer|department|assessment|notice|appeal)|reply to (the )?notice for me|take (legal )?responsib|be (legally )?(liable|responsible)|aap file kar do|tum file kar do|notice ka jawab de do/i;

// Clearly out-of-domain advice (investment / legal / medical). Kept narrow to
// avoid false positives with tax topics (e.g. a "medical store" expense).
const SCOPE_RX =
  /should i (invest|buy|sell)\b.*(stock|share|crypto|mutual fund|property|gold|bitcoin)|stock tip|share market tip|\bmutual fund\b.*(recommend|best)|legal advice|kanooni salah|कानूनी सलाह|is (this|the) (contract|agreement|deed).*(legal|valid)|\b(sue|lawsuit|court case|criminal case|divorce)\b|which medicine|medical advice/i;

/** Returns the safe-response key for a dangerous message, or null to continue. */
export function safetyCheck(text: string): SafetyKey | null {
  if (INJECTION_RX.test(text)) return "safety.injection";
  if (EVASION_RX.test(text)) return "safety.evasion";
  if (REPRESENT_RX.test(text)) return "safety.represent";
  if (GUARANTEE_RX.test(text)) return "safety.guarantee";
  if (SCOPE_RX.test(text)) return "safety.scope";
  return null;
}
