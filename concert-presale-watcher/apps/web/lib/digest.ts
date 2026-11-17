/** Daily email digest: one email with the alerts held for it. */
import {
  isChannelReady,
  listUnsubscribeHeaders,
  loadDeliveryContext,
  renderAlertContent,
  unsubscribeUrlFor,
} from "./alerts";
import { type AlertContent, buildDigestEmail } from "./alertMessages";
import { isDigestDue, quietHoursEndAt } from "./alertPreferences";
import { logger } from "./logger";
import { getBaseAppUrl } from "./notificationSettings";
import { sendEmailMessage } from "./notificationDelivery";
import { dispatchIntervalMs } from "./reminders";
import {
  addAlertSentChannel,
  listAlertsByIds,
  listDigestDeliveries,
  listEventsByIds,
  markDeliveriesSent,
  releaseDigestDeliveries,
  upsertNotificationPreferences,
} from "./store/alertStore";

const MAX_DIGEST_ITEMS = 50;

const dateLabel = (now: Date, timeZone: string | null): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone ?? "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);

export const runDigestPass = async (
  now = new Date(),
): Promise<{ users: number; sent: number; errors: number }> => {
  const rows = await listDigestDeliveries();
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const userId = row.alerts?.user_id;
    if (!userId) continue;
    byUser.set(userId, [...(byUser.get(userId) ?? []), row]);
  }

  let sent = 0;
  let errors = 0;
  for (const [userId, userRows] of byUser) {
    try {
      const context = await loadDeliveryContext(userId);
      if (!context.preferences.emailDigest) {
        await releaseDigestDeliveries(userId);
        continue;
      }
      if (!isChannelReady(context, "email")) {
        // Email was turned off or removed: hand the rows to the queue, which drops them.
        await releaseDigestDeliveries(userId);
        continue;
      }
      if (quietHoursEndAt(now, context.preferences)) continue;
      if (
        !isDigestDue({
          now,
          timeZone: context.preferences.timeZone,
          lastSentAt: context.preferences.digestLastSentAt,
          oldestPendingAt: userRows
            .map((row) => row.alerts?.created_at ?? now.toISOString())
            .reduce((a, b) => (a < b ? a : b)),
          dispatchIntervalMs: dispatchIntervalMs(),
        })
      ) {
        continue;
      }

      const batch = userRows.slice(0, MAX_DIGEST_ITEMS);
      const alerts = await listAlertsByIds(batch.map((row) => row.alert_id));
      const events = new Map(
        (await listEventsByIds([...new Set(alerts.map((alert) => alert.event_id))])).map((event) => [event.id, event]),
      );
      const contents: AlertContent[] = [];
      const included: Array<(typeof alerts)[number]> = [];
      for (const alert of alerts.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        const event = events.get(alert.event_id);
        if (!event || event.user_state === "hidden") continue;
        contents.push(await renderAlertContent(alert, event, context.preferences, now));
        included.push(alert);
      }
      // Rows for hidden or deleted shows are cleared along with the sent ones.
      if (contents.length === 0) {
        await markDeliveriesSent(batch.map((row) => row.id));
        continue;
      }
      const unsubscribeUrl = unsubscribeUrlFor(userId);
      const email = buildDigestEmail(
        contents,
        { unsubscribeUrl, manageUrl: `${getBaseAppUrl()}/dashboard` },
        dateLabel(now, context.preferences.timeZone),
      );
      const ok = await sendEmailMessage(context.settings.email as string, email.subject, email.text, {
        html: email.html,
        headers: listUnsubscribeHeaders(unsubscribeUrl),
      });
      if (!ok) {
        errors += 1;
        continue;
      }
      await markDeliveriesSent(batch.map((row) => row.id));
      for (const alert of included) await addAlertSentChannel(alert.id, alert.sent_channels, "email");
      await upsertNotificationPreferences(userId, { digest_last_sent_at: now.toISOString() });
      sent += 1;
    } catch (error) {
      errors += 1;
      logger.error(`[digest] failed for user ${userId}`, error);
    }
  }
  return { users: byUser.size, sent, errors };
};
