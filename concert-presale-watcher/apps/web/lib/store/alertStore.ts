/** Database helpers for the alert pipeline (reminders, preferences, deliveries). */
import type { AlertChannel, NotificationPreferencesRecord } from "../alertPreferences";
import type { VenueTime } from "../alertMessages";
import { rpcRequest, supabaseRequest } from "../supabase";
import type { AlertType, EventRecord, SaleWindow } from "../types";

const enc = encodeURIComponent;
const inList = (values: string[]) => enc(`(${values.map((value) => `"${value.replace(/["\\]/g, "")}"`).join(",")})`);

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export const getNotificationPreferences = async (
  userId: string,
): Promise<NotificationPreferencesRecord | null> => {
  const rows = await supabaseRequest<NotificationPreferencesRecord[]>(
    `/notification_preferences?select=*&user_id=eq.${enc(userId)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const listNotificationPreferences = async (
  userIds: string[],
): Promise<NotificationPreferencesRecord[]> => {
  if (userIds.length === 0) return [];
  const results: NotificationPreferencesRecord[] = [];
  for (let start = 0; start < userIds.length; start += 100) {
    results.push(
      ...(await supabaseRequest<NotificationPreferencesRecord[]>(
        `/notification_preferences?select=*&user_id=in.${inList(userIds.slice(start, start + 100))}`,
      )),
    );
  }
  return results;
};

export const upsertNotificationPreferences = async (
  userId: string,
  fields: Partial<Omit<NotificationPreferencesRecord, "user_id">>,
): Promise<NotificationPreferencesRecord> =>
  supabaseRequest<NotificationPreferencesRecord>(
    "/notification_preferences?select=*&on_conflict=user_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ user_id: userId, ...fields, updated_at: new Date().toISOString() }),
    },
    true,
  );

/** Unsubscribe link target: email alerts off, address kept. */
export const disableEmailAlerts = async (userId: string): Promise<void> => {
  await supabaseRequest<void>(`/notification_settings?user_id=eq.${enc(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ email_enabled: false }),
  });
};

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderCandidateRow {
  event_id: string;
  user_id: string;
  sale_window: SaleWindow;
  starts_at: string;
}

export const listSaleWindowReminders = async (
  from: Date,
  to: Date,
  limit = 500,
): Promise<ReminderCandidateRow[]> =>
  rpcRequest<ReminderCandidateRow[]>("list_sale_window_reminders", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_limit: limit,
  });

export interface AnnouncementRow {
  event_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** Announcement alerts created since `since` for these events, with their window keys. */
export const listRecentAnnouncements = async (
  eventIds: string[],
  since: Date,
): Promise<AnnouncementRow[]> => {
  const results: AnnouncementRow[] = [];
  for (let start = 0; start < eventIds.length; start += 100) {
    results.push(
      ...(await supabaseRequest<AnnouncementRow[]>(
        `/alerts?select=event_id,payload,created_at&event_id=in.${inList(eventIds.slice(start, start + 100))}&alert_type=in.(new_event,presale_announced,presale_opened,public_sale_announced,public_sale_opened)&created_at=gte.${enc(since.toISOString())}`,
      )),
    );
  }
  return results;
};

/** Which of these idempotency keys already have an alert. */
export const listExistingAlertKeys = async (keys: string[]): Promise<Set<string>> => {
  const found = new Set<string>();
  for (let start = 0; start < keys.length; start += 100) {
    const rows = await supabaseRequest<Array<{ idempotency_key: string }>>(
      `/alerts?select=idempotency_key&idempotency_key=in.${inList(keys.slice(start, start + 100))}`,
    );
    for (const row of rows) found.add(row.idempotency_key);
  }
  return found;
};

export const listEventsByIds = async (ids: string[]): Promise<EventRecord[]> => {
  const results: EventRecord[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    results.push(
      ...(await supabaseRequest<EventRecord[]>(`/events?select=*&id=in.${inList(ids.slice(start, start + 100))}`)),
    );
  }
  return results;
};

// ---------------------------------------------------------------------------
// Artist baseline
// ---------------------------------------------------------------------------

export interface ArtistRuleBaseline {
  id: string;
  baseline_sources: string[] | null;
}

export const getArtistRuleBaseline = async (
  watchArtistId: string,
): Promise<ArtistRuleBaseline | null> => {
  const rows = await supabaseRequest<ArtistRuleBaseline[]>(
    `/watch_rules?select=id,baseline_sources&legacy_watch_artist_id=eq.${enc(watchArtistId)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const markArtistSourceBaselined = async (ruleId: string, source: string): Promise<void> => {
  await rpcRequest<void>("mark_artist_source_baselined", { p_rule_id: ruleId, p_source: source });
};

/** After an inline first check, push the queued jobs for those sources out a full cadence. */
export const postponeArtistJobs = async (
  userId: string,
  watchArtistId: string,
  sources: string[],
  cadenceSeconds: number,
): Promise<void> => {
  if (sources.length === 0) return;
  await supabaseRequest<void>(
    `/poll_jobs?target_type=eq.legacy_user&target_id=eq.${enc(`${userId}:${watchArtistId}`)}&source_slug=in.${inList(sources)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        next_poll_at: new Date(Date.now() + cadenceSeconds * 1000).toISOString(),
        cadence_seconds: cadenceSeconds,
      }),
    },
  );
};

// ---------------------------------------------------------------------------
// Message context
// ---------------------------------------------------------------------------

interface SnapshotTimeRow {
  tz: string | null;
  venue_tz: string | null;
  local_date: string | null;
  date_time: string | null;
  time_tba: string | null;
  no_time: string | null;
}

/** The venue's zone and printed date from the latest Ticketmaster payload. */
export const getVenueTime = async (eventId: string): Promise<VenueTime | null> => {
  const rows = await supabaseRequest<SnapshotTimeRow[]>(
    `/snapshots?select=tz:raw_json->dates->>timezone,venue_tz:raw_json->_embedded->venues->0->>timezone,local_date:raw_json->dates->start->>localDate,date_time:raw_json->dates->start->>dateTime,time_tba:raw_json->dates->start->>timeTBA,no_time:raw_json->dates->start->>noSpecificTime&event_id=eq.${enc(eventId)}&order=checked_at.desc&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    timeZone: row.tz ?? row.venue_tz ?? null,
    localDate: row.local_date,
    dateOnly: Boolean(row.local_date) && (!row.date_time || row.time_tba === "true" || row.no_time === "true"),
  };
};

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export type HoldReason = "quiet_hours" | "digest";

/** Far enough out that no other reader of the queue sends a digest row alone. */
const DIGEST_PARK_MS = 400 * 86400_000;

export const holdDelivery = async (
  alertId: string,
  channel: AlertChannel,
  reason: HoldReason,
  until: Date | null,
): Promise<void> => {
  await supabaseRequest<void>(
    `/notification_deliveries?alert_id=eq.${enc(alertId)}&channel=eq.${channel}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "pending",
        held_reason: reason,
        next_attempt_at: (until ?? new Date(Date.now() + DIGEST_PARK_MS)).toISOString(),
        last_error: null,
      }),
    },
  );
};

export const holdDeliveryById = async (
  id: string,
  reason: HoldReason,
  until: Date | null,
): Promise<void> => {
  await supabaseRequest<void>(`/notification_deliveries?id=eq.${enc(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "pending",
      held_reason: reason,
      next_attempt_at: (until ?? new Date(Date.now() + DIGEST_PARK_MS)).toISOString(),
    }),
  });
};

export const recordDeliveryOutcome = async (
  alertId: string,
  channel: AlertChannel,
  outcome: { sent: boolean; error?: string },
): Promise<void> => {
  await supabaseRequest<void>(
    `/notification_deliveries?alert_id=eq.${enc(alertId)}&channel=eq.${channel}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: outcome.sent ? "sent" : "failed",
        attempts: 1,
        sent_at: outcome.sent ? new Date().toISOString() : null,
        last_error: outcome.error?.slice(0, 1000) ?? null,
        next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    },
  );
};

export const updateAlertSummary = async (
  alertId: string,
  sentChannels: string[],
  status: "pending" | "sent" | "partial" | "failed",
): Promise<void> => {
  await supabaseRequest<void>(`/alerts?id=eq.${enc(alertId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      sent_channels: sentChannels,
      sent_at: sentChannels.length > 0 ? new Date().toISOString() : null,
      delivery_status: status,
    }),
  });
};

export interface DueDelivery {
  id: string;
  alert_id: string;
  channel: AlertChannel;
  attempts: number;
  held_reason: HoldReason | null;
}

/** Due deliveries (retries and quiet-hours holds), not digest rows. */
export const listDueDeliveries = async (limit = 25): Promise<DueDelivery[]> =>
  supabaseRequest<DueDelivery[]>(
    `/notification_deliveries?select=id,alert_id,channel,attempts,held_reason&status=in.(pending,failed)&attempts=lt.5&or=(held_reason.is.null,held_reason.neq.digest)&next_attempt_at=lte.${enc(new Date().toISOString())}&order=next_attempt_at&limit=${limit}`,
  );

export interface DigestDeliveryRow {
  id: string;
  alert_id: string;
  alerts: { user_id: string; created_at: string } | null;
}

export const listDigestDeliveries = async (userId?: string, limit = 1000): Promise<DigestDeliveryRow[]> =>
  supabaseRequest<DigestDeliveryRow[]>(
    `/notification_deliveries?select=id,alert_id,alerts!inner(user_id,created_at)&channel=eq.email&held_reason=eq.digest&status=eq.pending${userId ? `&alerts.user_id=eq.${enc(userId)}` : ""}&order=created_at&limit=${limit}`,
  );

export const markDeliveriesSent = async (ids: string[]): Promise<void> => {
  for (let start = 0; start < ids.length; start += 100) {
    await supabaseRequest<void>(`/notification_deliveries?id=in.${inList(ids.slice(start, start + 100))}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString(), attempts: 1, last_error: null }),
    });
  }
};

/** Digest turned off: let held emails go out one by one on the next run. */
export const releaseDigestDeliveries = async (userId: string): Promise<void> => {
  const rows = await listDigestDeliveries(userId);
  const ids = rows.map((row) => row.id);
  for (let start = 0; start < ids.length; start += 100) {
    await supabaseRequest<void>(`/notification_deliveries?id=in.${inList(ids.slice(start, start + 100))}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ held_reason: null, next_attempt_at: new Date().toISOString() }),
    });
  }
};

export interface StoredAlertRow {
  id: string;
  event_id: string;
  alert_type: AlertType;
  payload: Record<string, unknown> | null;
  sent_channels: string[] | null;
  created_at: string;
}

export const listAlertsByIds = async (ids: string[]): Promise<StoredAlertRow[]> => {
  const results: StoredAlertRow[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    results.push(
      ...(await supabaseRequest<StoredAlertRow[]>(
        `/alerts?select=id,event_id,alert_type,payload,sent_channels,created_at&id=in.${inList(ids.slice(start, start + 100))}`,
      )),
    );
  }
  return results;
};

export const addAlertSentChannel = async (
  alertId: string,
  current: string[] | null,
  channel: string,
): Promise<void> => {
  const channels = [...new Set([...(current ?? []), channel])];
  await supabaseRequest<void>(`/alerts?id=eq.${enc(alertId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ sent_channels: channels, sent_at: new Date().toISOString() }),
  });
};
