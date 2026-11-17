import type { AlertType } from "./types";

export const ALERT_CHANNELS = ["email", "push", "sms", "discord"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALL_ALERT_TYPES: AlertType[] = [
  "new_event",
  "presale_announced",
  "presale_opened",
  "public_sale_announced",
  "public_sale_opened",
  "sale_opens_soon",
  "sale_open_now",
  "on_sale_moved_earlier",
  "status_changed",
  "ticket_url_changed",
];

/** Lead times offered in settings, in minutes. */
export const REMINDER_LEAD_OPTIONS = [15, 30, 60, 180, 720, 1440] as const;
export const DEFAULT_REMINDER_LEAD_MINUTES = 60;

export interface AlertPreferences {
  /** IANA zone from the user's browser. Null until they save settings once. */
  timeZone: string | null;
  reminderLeadMinutes: number;
  quietHours: { enabled: boolean; start: number; end: number };
  emailDigest: boolean;
  /** Alert types per channel. A channel left out gets every type. */
  channelAlertTypes: Partial<Record<AlertChannel, AlertType[]>>;
  digestLastSentAt: string | null;
}

export interface NotificationPreferencesRecord {
  user_id: string;
  time_zone: string | null;
  reminder_lead_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  email_digest: boolean;
  channel_alert_types: Record<string, unknown> | null;
  digest_last_sent_at: string | null;
}

export const defaultAlertPreferences = (): AlertPreferences => ({
  timeZone: null,
  reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,
  quietHours: { enabled: false, start: 22 * 60, end: 8 * 60 },
  emailDigest: false,
  channelAlertTypes: {},
  digestLastSentAt: null,
});

export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const isAlertType = (value: unknown): value is AlertType =>
  typeof value === "string" && (ALL_ALERT_TYPES as string[]).includes(value);

const isChannel = (value: string): value is AlertChannel =>
  (ALERT_CHANNELS as readonly string[]).includes(value);

export const toAlertPreferences = (
  record: NotificationPreferencesRecord | null,
): AlertPreferences => {
  const defaults = defaultAlertPreferences();
  if (!record) return defaults;
  const channelAlertTypes: AlertPreferences["channelAlertTypes"] = {};
  for (const [channel, types] of Object.entries(record.channel_alert_types ?? {})) {
    if (!isChannel(channel) || !Array.isArray(types)) continue;
    channelAlertTypes[channel] = types.filter(isAlertType);
  }
  return {
    timeZone: isValidTimeZone(record.time_zone) ? record.time_zone : null,
    reminderLeadMinutes: record.reminder_lead_minutes ?? defaults.reminderLeadMinutes,
    quietHours: {
      enabled: Boolean(record.quiet_hours_enabled),
      start: record.quiet_hours_start ?? defaults.quietHours.start,
      end: record.quiet_hours_end ?? defaults.quietHours.end,
    },
    emailDigest: Boolean(record.email_digest),
    channelAlertTypes,
    digestLastSentAt: record.digest_last_sent_at,
  };
};

/** True when the user wants this alert type on this channel. */
export const channelWantsAlert = (
  preferences: AlertPreferences,
  channel: AlertChannel,
  alertType: AlertType,
): boolean => {
  const allowed = preferences.channelAlertTypes[channel];
  return !allowed || allowed.includes(alertType);
};

/** Minutes after local midnight in a time zone. */
export const localMinutes = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
};

const inRange = (minute: number, start: number, end: number): boolean =>
  start <= end ? minute >= start && minute < end : minute >= start || minute < end;

/**
 * When quiet hours end, or null when they aren't in effect right now.
 * Quiet hours may wrap past midnight (22:00 to 08:00).
 */
export const quietHoursEndAt = (
  now: Date,
  preferences: Pick<AlertPreferences, "quietHours" | "timeZone">,
): Date | null => {
  const { enabled, start, end } = preferences.quietHours;
  if (!enabled || start === end) return null;
  const timeZone = preferences.timeZone ?? "UTC";
  const current = localMinutes(now, timeZone);
  if (!inRange(current, start, end)) return null;
  const wait = (end - current + 1440) % 1440;
  const flooredNow = Math.floor(now.getTime() / 60_000) * 60_000;
  let candidate = new Date(flooredNow + wait * 60_000);
  // A DST change inside the wait shifts the wall clock; correct by the drift.
  const drift = localMinutes(candidate, timeZone) - end;
  if (drift !== 0 && Math.abs(drift) <= 120) {
    candidate = new Date(candidate.getTime() - drift * 60_000);
  }
  return candidate;
};

/** Hour of the day, in the user's zone, the daily digest goes out. */
export const DIGEST_LOCAL_HOUR = 9;

/**
 * Whether the daily digest should go out on this dispatch run. It goes out
 * at the first run at or after 9:00 local time with alerts held since before
 * then, or earlier on a run when the next run is expected after 9:00 (so a
 * once-a-day dispatcher still sends one digest a day instead of a day late).
 */
export const isDigestDue = (input: {
  now: Date;
  timeZone: string | null;
  lastSentAt: string | null;
  /** When the oldest held alert was created. */
  oldestPendingAt: string;
  dispatchIntervalMs: number;
}): boolean => {
  const { now, lastSentAt, dispatchIntervalMs } = input;
  const timeZone = input.timeZone ?? "UTC";
  if (lastSentAt && now.getTime() - new Date(lastSentAt).getTime() < 20 * 3600_000) {
    return false;
  }
  const sinceDigestHour = (localMinutes(now, timeZone) - DIGEST_LOCAL_HOUR * 60 + 1440) % 1440;
  const lastDigestHour = now.getTime() - sinceDigestHour * 60_000 - (now.getTime() % 60_000);
  if (new Date(input.oldestPendingAt).getTime() <= lastDigestHour) return true;
  return (1440 - sinceDigestHour) * 60_000 <= dispatchIntervalMs;
};

const minutePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseClockTime = (value: string): number | null => {
  const match = minutePattern.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const formatClockTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
