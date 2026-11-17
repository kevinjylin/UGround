/**
 * Sale-window reminders, driven by each stored window's starts_at.
 *
 * The pass runs on every dispatcher call and must work whether that's once a
 * day (GitHub Actions today) or every minute (pg_cron later):
 *
 * - "opens soon" goes out on the first run where the start is within
 *   max(the user's lead time, the time until the next run is expected), so a
 *   daily dispatcher still warns about a presale that opens before tomorrow's
 *   run. The message always states the actual start time.
 * - "open now" goes out only if the window opened recently: within the gap
 *   between runs, capped at 12 hours, so yesterday's opening isn't announced.
 *
 * Each (event, window, kind) alerts once, through the idempotency key.
 */
import { createAndDeliverAlert } from "./alerts";
import { saleWindowKey } from "./alertMessages";
import { DEFAULT_REMINDER_LEAD_MINUTES, REMINDER_LEAD_OPTIONS, toAlertPreferences } from "./alertPreferences";
import { env } from "./env";
import { logger } from "./logger";
import {
  listEventsByIds,
  listExistingAlertKeys,
  listNotificationPreferences,
  listRecentAnnouncements,
  listSaleWindowReminders,
} from "./store/alertStore";
import type { SaleWindow } from "./types";
import { hashJson } from "./utils";

export type ReminderKind = "sale_opens_soon" | "sale_open_now";

export interface ReminderCandidate {
  eventId: string;
  userId: string;
  window: SaleWindow;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Runs drift (GitHub's cron can start late), so allow a quarter extra. */
export const expectedGapMs = (dispatchIntervalMs: number): number => dispatchIntervalMs * 1.25;

/** How long after a window opens an "open now" still makes sense. */
export const openGraceMs = (dispatchIntervalMs: number): number =>
  Math.min(12 * HOUR, Math.max(10 * MINUTE, expectedGapMs(dispatchIntervalMs)));

/** How far ahead "opens soon" can reach for this lead time. */
export const soonHorizonMs = (leadMinutes: number, dispatchIntervalMs: number): number =>
  Math.max(leadMinutes * MINUTE, expectedGapMs(dispatchIntervalMs));

export const reminderKindFor = (
  window: Pick<SaleWindow, "starts_at" | "ends_at">,
  leadMinutes: number,
  now: Date,
  dispatchIntervalMs: number,
): ReminderKind | null => {
  if (!window.starts_at) return null;
  const start = new Date(window.starts_at).getTime();
  if (Number.isNaN(start)) return null;
  const untilStart = start - now.getTime();
  if (untilStart > 0) {
    return untilStart <= soonHorizonMs(leadMinutes, dispatchIntervalMs) ? "sale_opens_soon" : null;
  }
  const ended = window.ends_at ? new Date(window.ends_at).getTime() <= now.getTime() : false;
  return !ended && -untilStart <= openGraceMs(dispatchIntervalMs) ? "sale_open_now" : null;
};

export const reminderIdempotencyKey = (kind: ReminderKind, eventId: string, window: SaleWindow): string =>
  `${kind}::${eventId}::${hashJson(saleWindowKey(window))}`;

/** An announcement that already stated this window's start, and when. */
export interface Announcement {
  eventId: string;
  windowKey: string;
  createdAt: string;
}

export interface SelectedReminder {
  candidate: ReminderCandidate;
  kind: ReminderKind;
  idempotencyKey: string;
}

/**
 * Pick the reminders due on this run. An "opens soon" is skipped when an
 * announcement for the same window went out inside the reminder horizon,
 * since that message already gave the start time.
 */
export const selectReminders = (input: {
  candidates: ReminderCandidate[];
  leadMinutesByUser: Map<string, number>;
  announcements: Announcement[];
  now: Date;
  dispatchIntervalMs: number;
}): SelectedReminder[] => {
  const { now, dispatchIntervalMs } = input;
  const announcedAt = new Map<string, number>();
  for (const item of input.announcements) {
    const key = `${item.eventId}::${item.windowKey}`;
    announcedAt.set(key, Math.max(announcedAt.get(key) ?? 0, new Date(item.createdAt).getTime()));
  }
  const selected: SelectedReminder[] = [];
  for (const candidate of input.candidates) {
    const lead = input.leadMinutesByUser.get(candidate.userId) ?? DEFAULT_REMINDER_LEAD_MINUTES;
    const kind = reminderKindFor(candidate.window, lead, now, dispatchIntervalMs);
    if (!kind) continue;
    if (kind === "sale_opens_soon") {
      const announced = announcedAt.get(`${candidate.eventId}::${saleWindowKey(candidate.window)}`);
      if (announced && now.getTime() - announced <= soonHorizonMs(lead, dispatchIntervalMs)) continue;
    }
    selected.push({
      candidate,
      kind,
      idempotencyKey: reminderIdempotencyKey(kind, candidate.eventId, candidate.window),
    });
  }
  return selected;
};

export const dispatchIntervalMs = (): number => Math.max(1, env.dispatchIntervalMinutes) * MINUTE;

const MAX_REMINDERS_PER_PASS = 100;

/** Find due reminders and create them. Cheap when nothing is due. */
export const runReminderPass = async (
  now = new Date(),
): Promise<{ candidates: number; created: number; errors: number }> => {
  const interval = dispatchIntervalMs();
  const maxLead = Math.max(...REMINDER_LEAD_OPTIONS);
  const rows = await listSaleWindowReminders(
    new Date(now.getTime() - openGraceMs(interval)),
    new Date(now.getTime() + soonHorizonMs(maxLead, interval)),
  );
  if (rows.length === 0) return { candidates: 0, created: 0, errors: 0 };

  const candidates: ReminderCandidate[] = rows.map((row) => ({
    eventId: row.event_id,
    userId: row.user_id,
    window: row.sale_window,
  }));
  const userIds = [...new Set(candidates.map((candidate) => candidate.userId))];
  const eventIds = [...new Set(candidates.map((candidate) => candidate.eventId))];
  const [preferences, announcementRows] = await Promise.all([
    listNotificationPreferences(userIds).catch((error: unknown) => {
      logger.error("[reminders] preference lookup failed; using defaults", error);
      return [];
    }),
    listRecentAnnouncements(eventIds, new Date(now.getTime() - soonHorizonMs(maxLead, interval))),
  ]);
  const leadMinutesByUser = new Map(
    preferences.map((record) => [record.user_id, toAlertPreferences(record).reminderLeadMinutes]),
  );
  const announcements: Announcement[] = announcementRows.flatMap((row) => {
    const keys = Array.isArray(row.payload?.sale_window_keys) ? (row.payload.sale_window_keys as string[]) : [];
    return keys.map((windowKey) => ({ eventId: row.event_id, windowKey, createdAt: row.created_at }));
  });

  const due = selectReminders({ candidates, leadMinutesByUser, announcements, now, dispatchIntervalMs: interval });
  if (due.length === 0) return { candidates: rows.length, created: 0, errors: 0 };
  const existing = await listExistingAlertKeys(due.map((item) => item.idempotencyKey));
  const fresh = due.filter((item) => !existing.has(item.idempotencyKey)).slice(0, MAX_REMINDERS_PER_PASS);
  if (fresh.length === 0) return { candidates: rows.length, created: 0, errors: 0 };

  const events = new Map(
    (await listEventsByIds([...new Set(fresh.map((item) => item.candidate.eventId))])).map((event) => [event.id, event]),
  );
  let created = 0;
  let errors = 0;
  for (const item of fresh) {
    const event = events.get(item.candidate.eventId);
    if (!event) continue;
    try {
      const made = await createAndDeliverAlert({
        event,
        alertType: item.kind,
        idempotencyKey: item.idempotencyKey,
        payload: { sale_window: item.candidate.window, reminder: true },
        now,
      });
      if (made) created += 1;
    } catch (error) {
      errors += 1;
      logger.error(`[reminders] ${item.idempotencyKey} failed`, error);
    }
  }
  return { candidates: rows.length, created, errors };
};
