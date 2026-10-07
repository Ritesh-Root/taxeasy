/**
 * Account commands — exact, keyword-style messages that change the user's own
 * settings (consent, turnover, …). Matched before the router, never sent to the
 * AI. Each returns the reply plus the updated user; the agent persists it.
 */
import type { StoredUser } from "../ports/types.ts";
import { parseConsentCommand, applyConsentChange, consentSummary } from "./consent.ts";
import { parseAmount } from "./onboarding.ts";
import { t } from "./i18n.ts";
import type { Lang } from "./i18n.ts";

export interface CommandResult {
  text: string;
  user: StoredUser;
}

const TURNOVER_RX = /^(turnover|टर्नओवर)\s+(.+)$/i;
const REMINDERS_OFF_RX = /^(stop reminders?|reminders? band karo|रिमाइंडर बंद करो)$/i;
const REMINDERS_ON_RX = /^(start reminders?|reminders? chalu karo|रिमाइंडर चालू करो)$/i;

export async function runCommand(user: StoredUser, message: string, lang: Lang): Promise<CommandResult | null> {
  const text = message.trim();

  const consent = parseConsentCommand(text);
  if (consent) {
    if (consent.kind === "status") {
      return { text: t("consent.status", lang, { list: consentSummary(user.profile) }), user };
    }
    const profile = applyConsentChange(user.profile, consent);
    const needsTurnover = consent.kind === "share" && consent.categories.includes("income") && profile.grossReceipts == null;
    const reply = t("consent.updated", lang, { list: consentSummary(profile) });
    return { text: needsTurnover ? `${reply}\n\n${t("consent.turnover_hint", lang)}` : reply, user: { ...user, profile } };
  }

  const turnover = text.match(TURNOVER_RX);
  if (turnover) {
    const amount = parseAmount(turnover[2]!);
    if (amount == null || amount <= 0) return { text: t("onboard.turnover_reask", lang), user };
    return {
      text: t("profile.turnover_set", lang, { amount: amount.toLocaleString("en-IN") }),
      user: { ...user, profile: { ...user.profile, grossReceipts: amount } },
    };
  }

  if (REMINDERS_OFF_RX.test(text) || REMINDERS_ON_RX.test(text)) {
    const off = REMINDERS_OFF_RX.test(text);
    return { text: t(off ? "reminders.off" : "reminders.on", lang), user: { ...user, reminders: { ...user.reminders, off } } };
  }

  return null;
}
