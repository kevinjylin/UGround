import { assertSupabaseConfig, env } from "./env";
import type {
  AlertRecord,
  AlertType,
  DiscoveredEvent,
  EventRecord,
  NormalizedEvent,
  NotificationSettingsRecord,
  PollJob,
  SourceStatus,
  SnapshotRecord,
  VenueSuggestion,
  WatchArtist,
  WatchRule,
} from "./types";

export interface VenueRecord {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  source_refs: Record<string, string>;
}

interface CreateWatchArtistInput {
  userId: string;
  name: string;
  spotifyId?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface CreateAlertInput {
  userId: string;
  eventId: string;
  alertType: AlertType;
  message: string;
  payload?: Record<string, unknown>;
  sentChannels: string[];
  sentAt: string | null;
  idempotencyKey?: string;
}

interface UpsertNotificationSettingsInput {
  userId: string;
  discordWebhookEncrypted?: string | null;
  emailEncrypted?: string | null;
  phoneEncrypted?: string | null;
  discordEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  emailConfirmedAt?: string | null;
  smsConfirmedAt?: string | null;
  emailConfirmationHash?: string | null;
  emailConfirmationExpiresAt?: string | null;
  smsConfirmationHash?: string | null;
  smsConfirmationExpiresAt?: string | null;
  emailConfirmationAttempts?: number;
  smsConfirmationAttempts?: number;
  confirmationSentAt?: string | null;
}

const getBaseUrl = (): string => {
  assertSupabaseConfig();
  return `${env.supabaseUrl}/rest/v1`;
};

const getAuthHeaders = (): HeadersInit => {
  assertSupabaseConfig();

  return {
    apikey: env.supabaseServiceKey as string,
    Authorization: `Bearer ${env.supabaseServiceKey as string}`,
  };
};

export const supabaseRequest = async <T>(
  path: string,
  init: RequestInit = {},
  acceptSingle = false,
): Promise<T> => {
  const headers = new Headers(init.headers);
  const authHeaders = getAuthHeaders();

  Object.entries(authHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  });

  headers.set("Content-Type", "application/json");
  if (acceptSingle) {
    headers.set("Accept", "application/vnd.pgrst.object+json");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
};

export const rpcRequest = async <T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> =>
  supabaseRequest<T>(`/rpc/${encodeURIComponent(functionName)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const listWatchArtists = async (
  userId?: string,
): Promise<WatchArtist[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  const userFilter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";

  return supabaseRequest<WatchArtist[]>(
    `/watch_artists?select=*&order=created_at.desc${userFilter}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const createWatchArtist = async (
  input: CreateWatchArtistInput,
): Promise<WatchArtist> => {
  const payload = {
    user_id: input.userId,
    name: input.name,
    spotify_id: input.spotifyId ?? null,
    city: input.city ?? "",
    state: input.state ?? "",
    country: input.country ?? "US",
  };

  const saved = await supabaseRequest<WatchArtist>(
    "/watch_artists?select=*&on_conflict=user_id,name,city,country",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    true,
  );
  const artist = await supabaseRequest<{ id: string }>(
    "/artists?select=id&on_conflict=normalized_name",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        name: saved.name,
        normalized_name: saved.name.trim().toLowerCase(),
        spotify_id: saved.spotify_id,
      }),
    },
    true,
  );
  const rule = await supabaseRequest<WatchRule>(
    "/watch_rules?select=*&on_conflict=legacy_watch_artist_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: input.userId,
        kind: "artist",
        artist_id: artist.id,
        label: saved.name,
        city: saved.city || null,
        state: saved.state || null,
        country: saved.country,
        legacy_watch_artist_id: saved.id,
      }),
    },
    true,
  );
  await enqueuePollJobsForRule(rule, input.userId);
  return saved;
};

export const createWatchRule = async (input: {
  userId: string;
  kind: "artist" | "venue" | "location";
  label: string;
  spotifyId?: string;
  city?: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  /** The Ticketmaster venue a venue rule follows. */
  venue?: VenueSuggestion;
}): Promise<WatchRule> => {
  let artistId: string | null = null;
  let venueId: string | null = null;
  const normalizedLabel = input.label.trim().toLowerCase();

  if (input.kind === "artist") {
    const artist = await supabaseRequest<{ id: string }>(
      "/artists?select=id&on_conflict=normalized_name",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          name: input.label.trim(),
          normalized_name: normalizedLabel,
          spotify_id: input.spotifyId ?? null,
        }),
      },
      true,
    );
    artistId = artist.id;
  }

  if (input.kind === "venue") {
    venueId = await findOrCreateVenue({
      name: input.label.trim(),
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country,
      ticketmaster: input.venue,
    });
  }

  const rule = await supabaseRequest<WatchRule>(
    "/watch_rules?select=*",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: input.userId,
        kind: input.kind,
        artist_id: artistId,
        venue_id: venueId,
        label: input.label.trim(),
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        radius_miles: input.radiusMiles ?? null,
      }),
    },
    true,
  );

  await enqueuePollJobsForRule(rule, input.userId);
  return rule;
};

export const listWatchRules = async (userId: string): Promise<WatchRule[]> =>
  supabaseRequest<WatchRule[]>(
    `/watch_rules?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
  );

export const deleteWatchRule = async (id: string, userId: string): Promise<void> => {
  const encodedId = encodeURIComponent(id);
  const encodedUser = encodeURIComponent(userId);
  // Remove the shows only this rule found. Ones an artist watch also covers stay.
  // This runs first because deleting the rule clears events.watch_rule_id.
  await supabaseRequest<void>(
    `/events?watch_rule_id=eq.${encodedId}&user_id=eq.${encodedUser}&watch_artist_id=is.null`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  // An area job belongs to one rule. A venue job is shared, and the dispatcher
  // removes it once nobody follows the venue.
  await supabaseRequest<void>(
    `/poll_jobs?target_type=eq.location&target_id=eq.${encodedId}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  await supabaseRequest<void>(
    `/watch_rules?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
};

const POLL_JOB_SOURCES = ["ticketmaster", "eventbrite", "songkick", "bandsintown", "axs", "dice"];

/** Only Ticketmaster can search by venue or by area. */
export const RULE_JOB_SOURCES = ["ticketmaster"];

/** Venues change slowly; areas cost a heavier query, so they run less often. */
const RULE_CADENCE_SECONDS = { venue: 1800, location: 3 * 3600 } as const;

type PollJobRule = Pick<WatchRule, "id" | "user_id" | "kind" | "artist_id" | "venue_id" | "legacy_watch_artist_id">;

interface PollJobRow {
  source_slug: string;
  target_type: PollJob["target_type"];
  target_id: string;
  user_id: string | null;
  priority: number;
  next_poll_at: string;
  cadence_seconds: number;
  lease_owner: null;
  lease_expires_at: null;
}

const pollJobRow = (
  fields: Pick<PollJobRow, "source_slug" | "target_type" | "target_id" | "user_id" | "priority" | "cadence_seconds">,
): PollJobRow => ({
  ...fields,
  next_poll_at: new Date().toISOString(),
  lease_owner: null,
  lease_expires_at: null,
});

const buildPollJobRows = (rule: PollJobRule, priority: number): PollJobRow[] => {
  if (rule.legacy_watch_artist_id) {
    return POLL_JOB_SOURCES.map((sourceSlug) =>
      pollJobRow({
        source_slug: sourceSlug,
        target_type: "legacy_user",
        target_id: `${rule.user_id}:${rule.legacy_watch_artist_id}`,
        user_id: rule.user_id,
        priority,
        cadence_seconds: 1800,
      }),
    );
  }

  // One job per venue, shared by everyone who follows it, so it has no owner.
  if (rule.kind === "venue" && rule.venue_id) {
    return RULE_JOB_SOURCES.map((sourceSlug) =>
      pollJobRow({
        source_slug: sourceSlug,
        target_type: "venue",
        target_id: rule.venue_id as string,
        user_id: null,
        priority,
        cadence_seconds: RULE_CADENCE_SECONDS.venue,
      }),
    );
  }

  if (rule.kind === "location") {
    return RULE_JOB_SOURCES.map((sourceSlug) =>
      pollJobRow({
        source_slug: sourceSlug,
        target_type: "location",
        target_id: rule.id,
        user_id: rule.user_id,
        priority,
        cadence_seconds: RULE_CADENCE_SECONDS.location,
      }),
    );
  }

  // Artist rules without a legacy watchlist row have nothing to run.
  return [];
};

// "merge" re-queues existing jobs to run now; "ignore" only adds missing ones.
const upsertPollJobs = async (
  rows: PollJobRow[],
  resolution: "merge" | "ignore",
): Promise<void> => {
  if (rows.length === 0) return;
  await supabaseRequest<void>(
    "/poll_jobs?on_conflict=source_slug,target_type,target_id",
    {
      method: "POST",
      headers: {
        Prefer: `resolution=${resolution === "merge" ? "merge-duplicates" : "ignore-duplicates"},return=minimal`,
      },
      body: JSON.stringify(rows),
    },
  );
};

export const enqueuePollJobsForRule = async (
  rule: WatchRule,
  userId: string,
): Promise<void> => {
  await upsertPollJobs(buildPollJobRows({ ...rule, user_id: userId }, 10), "merge");
};

/**
 * Add poll jobs for every followed artist, venue, and area that doesn't have
 * them yet. Rules created before the job queue existed never got any, so the
 * dispatcher had nothing to run for them. Existing jobs are left alone.
 */
export const syncPollJobs = async (): Promise<number> => {
  const pageSize = 500;
  let synced = 0;
  for (let offset = 0; ; offset += pageSize) {
    const rules = await supabaseRequest<PollJobRule[]>(
      `/watch_rules?select=id,user_id,kind,artist_id,venue_id,legacy_watch_artist_id&or=(legacy_watch_artist_id.not.is.null,kind.in.(venue,location))&order=id&limit=${pageSize}&offset=${offset}`,
    );
    await upsertPollJobs(rules.flatMap((rule) => buildPollJobRows(rule, 10)), "ignore");
    synced += rules.length;
    if (rules.length < pageSize) return synced;
  }
};

export const queueUserRefresh = async (userId: string): Promise<number> => {
  const rules = await listWatchRules(userId);
  if (rules.length === 0) {
    const artists = await listWatchArtists(userId);
    await supabaseRequest<void>(
      "/poll_jobs?on_conflict=source_slug,target_type,target_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(
          artists.flatMap((artist) =>
            ["ticketmaster", "eventbrite"].map((sourceSlug) => ({
              source_slug: sourceSlug,
              target_type: "legacy_user",
              target_id: `${userId}:${artist.id}`,
              user_id: userId,
              priority: 100,
              next_poll_at: new Date().toISOString(),
              cadence_seconds: 1800,
              lease_owner: null,
              lease_expires_at: null,
            })),
          ),
        ),
      },
    );
    return artists.length * 2;
  }

  // Upsert rather than PATCH so rules with no jobs yet get them too.
  const rows = rules.flatMap((rule) => buildPollJobRows(rule, 100));
  await upsertPollJobs(rows, "merge");
  return rows.length;
};

export const claimPollJobs = async (
  workerId: string,
  limit = 10,
): Promise<PollJob[]> =>
  rpcRequest<PollJob[]>("claim_poll_jobs", {
    p_worker: workerId,
    p_limit: limit,
    p_lease_seconds: 120,
  });

export const completePollJob = async (
  job: PollJob,
  error?: string,
): Promise<void> => {
  const now = new Date();
  const next = new Date(now.getTime() + job.cadence_seconds * 1000).toISOString();
  await supabaseRequest<void>(`/poll_jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      next_poll_at: error
        ? new Date(now.getTime() + Math.min(3600, 60 * 2 ** Math.min(job.attempts, 5)) * 1000).toISOString()
        : next,
      lease_owner: null,
      lease_expires_at: null,
      last_error: error?.slice(0, 1000) ?? null,
    }),
  });
};

/** Release a job the dispatcher can't run yet and push it out of the way. */
export const deferPollJob = async (
  job: PollJob,
  reason: string,
  delaySeconds = 86400,
): Promise<void> => {
  await supabaseRequest<void>(`/poll_jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      next_poll_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      lease_owner: null,
      lease_expires_at: null,
      last_error: reason.slice(0, 1000),
    }),
  });
};

export const deletePollJob = async (jobId: string): Promise<void> => {
  await supabaseRequest<void>(`/poll_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
};

export const getWatchRuleById = async (id: string): Promise<WatchRule | null> => {
  const rows = await supabaseRequest<WatchRule[]>(
    `/watch_rules?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const listVenueWatchRules = async (venueId: string): Promise<WatchRule[]> => {
  const rows = await supabaseRequest<WatchRule[]>(
    `/watch_rules?select=*&kind=eq.venue&venue_id=eq.${encodeURIComponent(venueId)}`,
  );
  return rows.filter((rule) => rule.kind === "venue" && rule.venue_id === venueId);
};

export const markRuleBaselined = async (ruleId: string): Promise<void> => {
  await supabaseRequest<void>(`/watch_rules?id=eq.${encodeURIComponent(ruleId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ baseline_at: new Date().toISOString() }),
  });
};

export const getVenueById = async (id: string): Promise<VenueRecord | null> => {
  const rows = await supabaseRequest<VenueRecord[]>(
    `/venues?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const saveVenueTicketmasterRef = async (
  venue: VenueRecord,
  ticketmaster: VenueSuggestion,
): Promise<void> => {
  await supabaseRequest<void>(`/venues?id=eq.${encodeURIComponent(venue.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      source_refs: { ...(venue.source_refs ?? {}), ticketmaster: ticketmaster.id },
      latitude: venue.latitude ?? ticketmaster.latitude,
      longitude: venue.longitude ?? ticketmaster.longitude,
    }),
  });
};

const findOrCreateVenue = async (input: {
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  ticketmaster?: VenueSuggestion;
}): Promise<string> => {
  const tm = input.ticketmaster;
  const lookup = tm
    ? `/venues?select=id&source_refs->>ticketmaster=eq.${encodeURIComponent(tm.id)}&limit=1`
    : `/venues?select=id&normalized_name=eq.${encodeURIComponent(input.name.toLowerCase())}&city=eq.${encodeURIComponent(input.city ?? "")}&limit=1`;
  const existing = await supabaseRequest<Array<{ id: string }>>(lookup);
  if (existing[0]) return existing[0].id;

  const name = tm?.name ?? input.name;
  const venue = await supabaseRequest<{ id: string }>(
    "/venues?select=id",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name,
        normalized_name: name.trim().toLowerCase(),
        city: tm?.city ?? input.city,
        state: tm?.state ?? input.state,
        country: tm?.country ?? input.country,
        latitude: tm?.latitude ?? null,
        longitude: tm?.longitude ?? null,
        source_refs: tm ? { ticketmaster: tm.id } : {},
      }),
    },
    true,
  );
  return venue.id;
};

const SOURCE_ID_CHUNK = 100;

/** A user's stored events for these source ids, fetched in URL-sized chunks. */
export const listEventsBySourceIds = async (
  userId: string,
  sourceSlug: string,
  sourceEventIds: string[],
): Promise<EventRecord[]> => {
  const results: EventRecord[] = [];
  for (let start = 0; start < sourceEventIds.length; start += SOURCE_ID_CHUNK) {
    const chunk = sourceEventIds.slice(start, start + SOURCE_ID_CHUNK);
    const list = `(${chunk.map((id) => `"${id.replace(/["\\]/g, "")}"`).join(",")})`;
    const rows = await supabaseRequest<EventRecord[]>(
      `/events?select=*&user_id=eq.${encodeURIComponent(userId)}&source_slug=eq.${encodeURIComponent(sourceSlug)}&source_event_id=in.${encodeURIComponent(list)}`,
    );
    results.push(...rows);
  }
  return results;
};

/** Save events found by a venue or area rule in one request. */
export const upsertRuleEvents = async (
  rows: Array<DiscoveredEvent & { user_id: string; watch_rule_id: string | null }>,
): Promise<EventRecord[]> => {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  return supabaseRequest<EventRecord[]>(
    "/events?select=*&on_conflict=user_id,source_slug,source_event_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      // watch_artist_id is left out so an artist watch's claim on a row survives.
      body: JSON.stringify(
        rows.map((row) => ({
          user_id: row.user_id,
          source_slug: row.source_slug,
          source_event_id: row.source_event_id,
          watch_rule_id: row.watch_rule_id,
          artist_name: row.artist_name,
          title: row.title,
          venue: row.venue,
          city: row.city,
          state: row.state,
          country: row.country,
          start_time: row.start_time,
          ticket_url: row.ticket_url,
          status: row.status,
          on_sale_start: row.on_sale_start,
          sale_windows: row.sale_windows ?? [],
          dedupe_key: row.dedupe_key,
          last_seen_at: now,
        })),
      ),
    },
  );
};

export const createSnapshots = async (
  rows: Array<{ eventId: string; rawJsonHash: string; rawJson: unknown }>,
): Promise<void> => {
  if (rows.length === 0) return;
  await supabaseRequest<void>("/snapshots", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      rows.map((row) => ({ event_id: row.eventId, raw_json_hash: row.rawJsonHash, raw_json: row.rawJson })),
    ),
  });
};

// Sources are polled once a day, and the scheduled run can drift by hours,
// so a source only counts as stale after a missed day plus slack.
const MIN_STALE_AFTER_SECONDS = 36 * 3600;

export const listSourceStatuses = async (): Promise<SourceStatus[]> => {
  const rows = await supabaseRequest<Omit<SourceStatus, "stale">[]>(
    "/source_health?select=*&order=source_slug",
  );
  const now = Date.now();
  return rows.map((row) => {
    const enabledByConfig: Record<string, boolean> = {
      ticketmaster: Boolean(env.ticketmasterApiKey),
      eventbrite: Boolean(env.eventbriteToken && env.eventbritePublicIngestionEnabled),
      songkick: Boolean(env.songkickApiKey),
      bandsintown: Boolean(env.bandsintownAppId),
      axs: env.axsPublicIngestionEnabled,
      dice: env.dicePublicIngestionEnabled,
    };
    return {
    ...row,
    enabled: enabledByConfig[row.source_slug] ?? row.enabled,
    stale:
      !row.last_success_at ||
      now - new Date(row.last_success_at).getTime() >
        Math.max(row.stale_after_seconds, MIN_STALE_AFTER_SECONDS) * 1000,
    };
  });
};

export const recordSourceHealth = async (
  sourceSlug: string,
  input: { success: boolean; error?: string },
): Promise<void> => {
  await supabaseRequest<void>(
    `/source_health?source_slug=eq.${encodeURIComponent(sourceSlug)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        enabled: true,
        last_success_at: input.success ? new Date().toISOString() : undefined,
        last_failure_at: input.success ? undefined : new Date().toISOString(),
        last_error: input.success ? null : input.error?.slice(0, 1000) ?? "Unknown source error",
        updated_at: new Date().toISOString(),
      }),
    },
  );
};

export const deleteWatchArtist = async (
  id: string,
  userId: string,
): Promise<void> => {
  await supabaseRequest<void>(
    `/watch_artists?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    },
  );
  await supabaseRequest<void>(
    `/poll_jobs?target_type=eq.legacy_user&target_id=eq.${encodeURIComponent(`${userId}:${id}`)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
};

export const listEvents = async (
  limit = 100,
  userId?: string,
): Promise<EventRecord[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  const userFilter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";

  return supabaseRequest<EventRecord[]>(
    `/events?select=*&order=updated_at.desc&limit=${encodeURIComponent(String(limit))}${userFilter}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const getEventBySourceId = async (
  sourceSlug: string,
  sourceEventId: string,
  userId: string,
): Promise<EventRecord | null> => {
  const encodedSource = encodeURIComponent(sourceSlug);
  const encodedId = encodeURIComponent(sourceEventId);
  const encodedUserId = encodeURIComponent(userId);

  const records = await supabaseRequest<EventRecord[]>(
    `/events?select=*&user_id=eq.${encodedUserId}&source_slug=eq.${encodedSource}&source_event_id=eq.${encodedId}&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return records[0] ?? null;
};

export const getEventById = async (eventId: string): Promise<EventRecord | null> => {
  const rows = await supabaseRequest<EventRecord[]>(
    `/events?select=*&id=eq.${encodeURIComponent(eventId)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const upsertEvent = async (
  normalized: NormalizedEvent,
): Promise<EventRecord> => {
  const payload = {
    user_id: normalized.user_id,
    source_slug: normalized.source_slug,
    source_event_id: normalized.source_event_id,
    watch_artist_id: normalized.watch_artist_id,
    artist_name: normalized.artist_name,
    title: normalized.title,
    venue: normalized.venue,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    start_time: normalized.start_time,
    ticket_url: normalized.ticket_url,
    status: normalized.status,
    on_sale_start: normalized.on_sale_start,
    sale_windows: normalized.sale_windows ?? [],
    dedupe_key: normalized.dedupe_key,
    last_seen_at: new Date().toISOString(),
  };

  return supabaseRequest<EventRecord>(
    "/events?select=*&on_conflict=user_id,source_slug,source_event_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    true,
  );
};

export const getLatestSnapshot = async (
  eventId: string,
): Promise<SnapshotRecord | null> => {
  const encodedEventId = encodeURIComponent(eventId);

  const snapshots = await supabaseRequest<SnapshotRecord[]>(
    `/snapshots?select=*&event_id=eq.${encodedEventId}&order=checked_at.desc&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return snapshots[0] ?? null;
};

export const createSnapshot = async (
  eventId: string,
  rawJsonHash: string,
  rawJson: unknown,
): Promise<SnapshotRecord> => {
  return supabaseRequest<SnapshotRecord>(
    "/snapshots?select=*",
    {
      method: "POST",
      body: JSON.stringify({
        event_id: eventId,
        raw_json_hash: rawJsonHash,
        raw_json: rawJson,
      }),
    },
    true,
  );
};

export const listAlerts = async (
  limit = 50,
  userId?: string,
): Promise<AlertRecord[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  const userFilter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";

  return supabaseRequest<AlertRecord[]>(
    `/alerts?select=*&order=created_at.desc&limit=${encodeURIComponent(String(limit))}${userFilter}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const alertExistsByIdempotencyKey = async (
  idempotencyKey: string,
): Promise<boolean> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return false;
  }

  const encodedKey = encodeURIComponent(idempotencyKey);
  const records = await supabaseRequest<Array<{ id: string }>>(
    `/alerts?select=id&payload->>idempotency_key=eq.${encodedKey}&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return records.length > 0;
};

export const createAlert = async (
  input: CreateAlertInput,
): Promise<AlertRecord> => {
  const payload: Record<string, unknown> = { ...(input.payload ?? {}) };
  if (input.idempotencyKey) {
    payload.idempotency_key = input.idempotencyKey;
  }

  return supabaseRequest<AlertRecord>(
    "/alerts?select=*",
    {
      method: "POST",
      body: JSON.stringify({
        event_id: input.eventId,
        user_id: input.userId,
        alert_type: input.alertType,
        message: input.message,
        payload,
        sent_channels: input.sentChannels,
        sent_at: input.sentAt,
      }),
    },
    true,
  );
};

export const getAlertById = async (alertId: string): Promise<AlertRecord | null> => {
  const rows = await supabaseRequest<AlertRecord[]>(
    `/alerts?select=*&id=eq.${encodeURIComponent(alertId)}&limit=1`,
  );
  return rows[0] ?? null;
};

export const createAlertWithDeliveries = async (
  input: Omit<CreateAlertInput, "sentChannels" | "sentAt"> & {
    idempotencyKey: string;
    channels: string[];
  },
): Promise<{ alertId: string; created: boolean }> => {
  const rows = await rpcRequest<Array<{ alert_id: string; created: boolean }>>("create_alert_with_deliveries", {
    p_user_id: input.userId,
    p_event_id: input.eventId,
    p_alert_type: input.alertType,
    p_message: input.message,
    p_payload: input.payload ?? {},
    p_idempotency_key: input.idempotencyKey,
    p_channels: input.channels,
  });
  const result = rows[0];
  if (!result) throw new Error("Alert creation returned no result.");
  return { alertId: result.alert_id, created: result.created };
};

export const updateAlertDeliveryResult = async (
  alertId: string,
  channels: string[],
  errors: string[],
): Promise<void> => {
  await supabaseRequest<void>(`/alerts?id=eq.${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      sent_channels: channels,
      sent_at: channels.length > 0 ? new Date().toISOString() : null,
      delivery_status:
        errors.length === 0 ? "sent" : channels.length > 0 ? "partial" : "failed",
    }),
  });
  const eligible = await supabaseRequest<Array<{ channel: "discord" | "email" | "sms" }>>(
    `/notification_deliveries?select=channel&alert_id=eq.${encodeURIComponent(alertId)}`,
  );
  await Promise.all(
    eligible.map((delivery) => {
      const error = errors.find((item) => item.startsWith(`${delivery.channel}:`));
      return supabaseRequest<void>(
        `/notification_deliveries?alert_id=eq.${encodeURIComponent(alertId)}&channel=eq.${delivery.channel}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: channels.includes(delivery.channel) ? "sent" : "failed",
            attempts: 1,
            sent_at: channels.includes(delivery.channel) ? new Date().toISOString() : null,
            last_error: error ?? null,
            next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }),
        },
      );
    }),
  );
};

export const listPendingDeliveries = async (limit = 25) =>
  supabaseRequest<Array<{
    id: string;
    alert_id: string;
    channel: "discord" | "email" | "sms";
    attempts: number;
  }>>(
    `/notification_deliveries?select=id,alert_id,channel,attempts&status=in.(pending,failed)&attempts=lt.5&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&order=next_attempt_at&limit=${limit}`,
  );

export const updateDelivery = async (
  id: string,
  input: { sent: boolean; error?: string; attempts?: number },
): Promise<void> => {
  await supabaseRequest<void>(
    `/notification_deliveries?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: input.sent ? "sent" : "failed",
        attempts: input.attempts,
        sent_at: input.sent ? new Date().toISOString() : null,
        last_error: input.error?.slice(0, 1000) ?? null,
        next_attempt_at: input.sent
          ? new Date().toISOString()
          : new Date(
              Date.now() +
                Math.min(60, 5 * 2 ** Math.max(0, (input.attempts ?? 1) - 1)) *
                  60 *
                  1000,
            ).toISOString(),
      }),
    },
  );
};

export const exportUserData = async (userId: string): Promise<Record<string, unknown>> => {
  const [watchArtists, watchRules, events, alerts] = await Promise.all([
    listWatchArtists(userId),
    listWatchRules(userId),
    listEvents(500, userId),
    listAlerts(500, userId),
  ]);
  return { watchArtists, watchRules, events, alerts };
};

export const deleteUserData = async (userId: string): Promise<void> => {
  await Promise.all([
    supabaseRequest<void>(`/watch_rules?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
    supabaseRequest<void>(`/events?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
    supabaseRequest<void>(`/alerts?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
    supabaseRequest<void>(`/notification_settings?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
    supabaseRequest<void>(`/watch_artists?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
  ]);
  const response = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase auth deletion failed (${response.status})`);
  }
};

export const getNotificationSettings = async (
  userId: string,
): Promise<NotificationSettingsRecord | null> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return null;
  }

  const encodedUserId = encodeURIComponent(userId);
  const settings = await supabaseRequest<NotificationSettingsRecord[]>(
    `/notification_settings?select=*&user_id=eq.${encodedUserId}&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return settings[0] ?? null;
};

export const upsertNotificationSettings = async (
  input: UpsertNotificationSettingsInput,
): Promise<NotificationSettingsRecord> => {
  const existing = await getNotificationSettings(input.userId);
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    discord_webhook_encrypted: existing?.discord_webhook_encrypted ?? null,
    email_encrypted: existing?.email_encrypted ?? null,
    phone_encrypted: existing?.phone_encrypted ?? null,
    discord_enabled: existing?.discord_enabled ?? false,
    email_enabled: existing?.email_enabled ?? false,
    sms_enabled: existing?.sms_enabled ?? false,
    email_confirmed_at: existing?.email_confirmed_at ?? null,
    sms_confirmed_at: existing?.sms_confirmed_at ?? null,
    email_confirmation_hash: existing?.email_confirmation_hash ?? null,
    email_confirmation_expires_at:
      existing?.email_confirmation_expires_at ?? null,
    sms_confirmation_hash: existing?.sms_confirmation_hash ?? null,
    sms_confirmation_expires_at: existing?.sms_confirmation_expires_at ?? null,
    email_confirmation_attempts: existing?.email_confirmation_attempts ?? 0,
    sms_confirmation_attempts: existing?.sms_confirmation_attempts ?? 0,
    confirmation_sent_at: existing?.confirmation_sent_at ?? null,
  };

  if ("discordWebhookEncrypted" in input) {
    payload.discord_webhook_encrypted = input.discordWebhookEncrypted;
  }

  if ("emailEncrypted" in input) {
    payload.email_encrypted = input.emailEncrypted;
  }

  if ("phoneEncrypted" in input) {
    payload.phone_encrypted = input.phoneEncrypted;
  }

  if ("discordEnabled" in input) {
    payload.discord_enabled = input.discordEnabled;
  }

  if ("emailEnabled" in input) {
    payload.email_enabled = input.emailEnabled;
  }

  if ("smsEnabled" in input) {
    payload.sms_enabled = input.smsEnabled;
  }

  if ("emailConfirmedAt" in input) {
    payload.email_confirmed_at = input.emailConfirmedAt;
  }

  if ("smsConfirmedAt" in input) {
    payload.sms_confirmed_at = input.smsConfirmedAt;
  }

  if ("emailConfirmationHash" in input) {
    payload.email_confirmation_hash = input.emailConfirmationHash;
  }

  if ("emailConfirmationExpiresAt" in input) {
    payload.email_confirmation_expires_at = input.emailConfirmationExpiresAt;
  }

  if ("smsConfirmationHash" in input) {
    payload.sms_confirmation_hash = input.smsConfirmationHash;
  }

  if ("smsConfirmationExpiresAt" in input) {
    payload.sms_confirmation_expires_at = input.smsConfirmationExpiresAt;
  }
  if ("emailConfirmationAttempts" in input) {
    payload.email_confirmation_attempts = input.emailConfirmationAttempts;
  }
  if ("smsConfirmationAttempts" in input) {
    payload.sms_confirmation_attempts = input.smsConfirmationAttempts;
  }
  if ("confirmationSentAt" in input) {
    payload.confirmation_sent_at = input.confirmationSentAt;
  }

  return supabaseRequest<NotificationSettingsRecord>(
    "/notification_settings?select=*&on_conflict=user_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    true,
  );
};

export const consumeEmailConfirmationToken = async (
  hash: string,
): Promise<string | null> => {
  const value = await rpcRequest<string | null>("confirm_email_token", {
    p_token_hash: hash,
  });
  return value;
};

export const consumeSmsConfirmationCode = async (
  userId: string,
  hash: string,
): Promise<boolean> =>
  rpcRequest<boolean>("confirm_sms_code", {
    p_user_id: userId,
    p_code_hash: hash,
  });
