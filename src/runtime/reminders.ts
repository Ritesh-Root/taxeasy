/**
 * Deadline reminders — the website's "pings before, not after the late fee".
 * Every hour during Indian daytime, each onboarded user gets the reminders due
 * within 7 days that they haven't had yet (proactiveTriggers), on the channel
 * they use. STOP REMINDERS opts out.
 */
import type { Channel } from "../ports/channel.ts";
import type { UserStore } from "../ports/types.ts";
import { proactiveTriggers } from "../agent/advisory.ts";
import { t } from "../agent/i18n.ts";
import { logEvent } from "../observability/log.ts";

const istHour = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();

export async function sendDueReminders(users: UserStore, channels: Channel[], now: Date): Promise<number> {
  if (istHour(now) < 9 || istHour(now) >= 20) return 0; // never ping at night
  let sent = 0;
  for (const u of await users.all()) {
    if (!u.onboarding?.complete || u.reminders?.off) continue;
    // serve() stores users as "<channel>:<raw id>".
    const sep = u.userId.indexOf(":");
    const channel = channels.find((c) => c.name === u.userId.slice(0, sep));
    if (!channel) continue;
    const done = u.reminders?.sent ?? [];
    const fresh = proactiveTriggers(u.profile, now, u.model.language).filter((r) => !done.includes(r.key));
    if (!fresh.length) continue;
    try {
      await channel.send(u.userId.slice(sep + 1), [...fresh.map((r) => r.text), t("reminders.footer", u.model.language)].join("\n\n"));
      const latest = (await users.get(u.userId)) ?? u; // don't overwrite a reply the agent just saved
      await users.put({ ...latest, reminders: { ...latest.reminders, sent: [...done, ...fresh.map((r) => r.key)].slice(-50) } });
      sent++;
    } catch (err) {
      logEvent("ai_error", { userId: u.userId, reminders: String(err) });
    }
  }
  return sent;
}

/** Check now, then every hour. Errors are logged, never thrown. */
export function startReminders(users: UserStore, channels: Channel[], everyMs = 60 * 60 * 1000): ReturnType<typeof setInterval> {
  const tick = () => {
    sendDueReminders(users, channels, new Date()).catch((err) => logEvent("ai_error", { reminders: String(err) }));
  };
  tick();
  return setInterval(tick, everyMs);
}
