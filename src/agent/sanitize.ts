/**
 * Neutralise untrusted free text before it ever touches a prompt or a single-line
 * context string. Strips control characters + newlines (so it can't break out of
 * the line it's embedded in or inject structure) and caps length so a long
 * injection payload is truncated. Defends against stored prompt injection via
 * user-supplied fields like `profession` (review breach #1).
 */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]+", "g");

export function sanitizeText(s: string, maxLen = 80): string {
  return (s ?? "")
    .replace(CONTROL_CHARS, " ") // newlines / tabs / other control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
