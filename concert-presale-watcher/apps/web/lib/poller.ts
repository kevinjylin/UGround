import { createAndDeliverAlert } from "./alerts";
import { saleWindowKey } from "./alertMessages";
import { alertTypesForReplacement, replaceCrossSourceRow, resolveCrossSource } from "./crossSourceDedupe";
import { logger } from "./logger";
import { artistCadenceSeconds, runnableArtistSources } from "./pollCadence";
import {
  createSnapshot,
  getEventBySourceId,
  getLatestSnapshot,
  listWatchArtists,
  recordSourceHealth,
  upsertEvent,
} from "./supabase";
import { bandsintownAdapter } from "./sources/bandsintown";
import { eventbriteAdapter } from "./sources/eventbrite";
import { songkickAdapter } from "./sources/songkick";
import { ticketmasterAdapter } from "./sources/ticketmaster";
import {
  getArtistRuleBaseline,
  markArtistSourceBaselined,
  postponeArtistJobs,
  type ArtistRuleBaseline,
} from "./store/alertStore";
import type { AlertType, EventRecord, NormalizedEvent, PollResult, SaleWindow, WatchArtist } from "./types";
import { dedupeEvents, hashJson, movedEarlier } from "./utils";

/**
 * Stable idempotency key per (event, alert_type, change signature).
 * Two polls that observe the same underlying change produce the same key,
 * so `create_alert_with_deliveries` dedupes the second write. Without this,
 * overlapping cron runs double-notify users.
 */
const buildIdempotencyKey = (alertType: AlertType, eventId: string, next: EventRecord): string => {
  switch (alertType) {
    case "new_event":
      return `new_event::${eventId}`;
    case "status_changed":
      return `status_changed::${eventId}::${next.status}`;
    case "ticket_url_changed":
      return `ticket_url_changed::${eventId}::${next.ticket_url ?? ""}`;
    case "on_sale_moved_earlier":
      return `on_sale_moved_earlier::${eventId}::${next.on_sale_start ?? ""}`;
    case "presale_announced":
    case "presale_opened":
    case "public_sale_announced":
    case "public_sale_opened":
    case "sale_opens_soon":
    case "sale_open_now":
      return `${alertType}::${eventId}::${hashJson(next.sale_windows ?? [])}`;
  }
};

type ChangeFields = Pick<NormalizedEvent, "status" | "ticket_url" | "on_sale_start" | "sale_windows">;

/** Sale windows in `next` that `previous` didn't have. */
export const newSaleWindows = (
  previous: Pick<EventRecord, "sale_windows"> | null,
  next: Pick<ChangeFields, "sale_windows">,
): SaleWindow[] => {
  const previousKeys = new Set((previous?.sale_windows ?? []).map(saleWindowKey));
  return (next.sale_windows ?? []).filter((window) => !previousKeys.has(saleWindowKey(window)));
};

export const getAlertTypes = (previous: EventRecord | null, next: ChangeFields): AlertType[] => {
  if (!previous) {
    return ["new_event"];
  }

  const alerts: AlertType[] = [];

  if (next.status !== previous.status) {
    alerts.push("status_changed");
  }

  if (next.ticket_url && next.ticket_url !== previous.ticket_url) {
    alerts.push("ticket_url_changed");
  }

  if (movedEarlier(previous.on_sale_start, next.on_sale_start)) {
    alerts.push("on_sale_moved_earlier");
  }

  for (const window of newSaleWindows(previous, next)) {
    const opened = window.starts_at
      ? new Date(window.starts_at).getTime() <= Date.now()
      : false;
    if (window.kind === "presale") {
      alerts.push(opened ? "presale_opened" : "presale_announced");
    } else {
      alerts.push(opened ? "public_sale_opened" : "public_sale_announced");
    }
  }

  return alerts;
};

const sourceAdapters = [
  ticketmasterAdapter,
  eventbriteAdapter,
  songkickAdapter,
  bandsintownAdapter,
];

/** True when this source has an adapter with credentials, so a job for it can run. */
export const isSourceRunnable = (slug: string): boolean =>
  sourceAdapters.some((adapter) => adapter.slug === slug && adapter.configured());

/** Slugs of the adapters that are configured, for checking pollCadence's list. */
export const configuredAdapterSlugs = (): string[] =>
  sourceAdapters.filter((adapter) => adapter.configured()).map((adapter) => adapter.slug);

/**
 * Fetch events for one artist from the selected sources concurrently.
 * Failures in individual sources are logged but don't stop the others.
 */
const fetchSelectedSourcesForArtist = async (
  artist: WatchArtist,
  sourceSlugs?: string[],
): Promise<{ events: NormalizedEvent[]; errors: string[]; succeeded: string[] }> => {
  const selected = sourceAdapters.filter(
    (adapter) =>
      adapter.configured() &&
      (!sourceSlugs || sourceSlugs.length === 0 || sourceSlugs.includes(adapter.slug)),
  );
  const settled = await Promise.allSettled(
    selected.map((adapter) => adapter.fetchForArtist(artist)),
  );
  const normalized: NormalizedEvent[] = [];
  const errors: string[] = [];
  const succeeded: string[] = [];
  for (const [index, result] of settled.entries()) {
    const slug = selected[index]?.slug ?? "source";
    if (result.status === "fulfilled") {
      normalized.push(...result.value);
      succeeded.push(slug);
      await recordSourceHealth(slug, { success: true });
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.error(`[poll] ${slug} failed for ${artist.name}`, result.reason);
      await recordSourceHealth(slug, { success: false, error: message });
      errors.push(message);
    }
  }
  return { events: normalized, errors, succeeded };
};

/** The next window that hasn't started: the one a "new show" message names. */
const nextSaleWindow = (event: Pick<EventRecord, "sale_windows">): SaleWindow[] => {
  const now = Date.now();
  const upcoming = (event.sale_windows ?? [])
    .filter((window) => window.starts_at && new Date(window.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime());
  return upcoming.slice(0, 1);
};

export const persistAndDeliverAlert = async (
  alertType: AlertType,
  previous: EventRecord | null,
  savedEvent: EventRecord,
): Promise<boolean> => {
  // Shows the user hid never alert.
  if (savedEvent.user_state === "hidden") return false;
  const announced =
    alertType === "presale_announced" ||
    alertType === "presale_opened" ||
    alertType === "public_sale_announced" ||
    alertType === "public_sale_opened";
  return createAndDeliverAlert({
    event: savedEvent,
    alertType,
    idempotencyKey: buildIdempotencyKey(alertType, savedEvent.id, savedEvent),
    payload: announced
      ? {
          // Lets the message name the window and lets reminders skip an
          // "opens soon" right after the announcement said the same thing.
          sale_window_keys: newSaleWindows(previous, savedEvent)
            .filter((window) => (window.kind === "presale") === alertType.startsWith("presale"))
            .map(saleWindowKey),
        }
      : alertType === "new_event"
        ? { sale_window_keys: nextSaleWindow(savedEvent).map(saleWindowKey) }
        : {},
  });
};

/**
 * Whether a source's results for this artist should alert. Each source's
 * first successful check for an artist rule is quiet: shows are saved, so
 * the feed fills, but following an artist with 30 dates doesn't send 30
 * "new show" messages. A legacy artist with no rule row alerts as before.
 */
export const isQuietSource = (rule: ArtistRuleBaseline | null, source: string): boolean =>
  Boolean(rule) && !(rule?.baseline_sources ?? []).includes(source);

export interface ArtistCheckOutcome {
  result: PollResult;
  /** Sources that answered, so their jobs can be marked done. */
  succeededSources: string[];
  /** Sources whose results were saved without alerts (first check). */
  quietSources: string[];
  /** Poll cadence to use next, given the sale windows just seen. */
  cadenceSeconds: number;
}

/** Check one followed artist on the selected sources and alert on changes. */
export const runArtistCheck = async (
  artist: WatchArtist,
  sourceSlugs?: string[],
): Promise<ArtistCheckOutcome> => {
  const startedAt = new Date().toISOString();
  const rule = await getArtistRuleBaseline(artist.id).catch((error: unknown) => {
    // Before the baseline column exists, behave as before (alerts on).
    logger.error("[poll] artist baseline lookup failed", error);
    return null;
  });
  const { events: fetched, errors, succeeded } = await fetchSelectedSourcesForArtist(artist, sourceSlugs);
  // Surface a source failure (bad key, outage) instead of reporting success.
  if (succeeded.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  const events = dedupeEvents(fetched);
  const quietSources = succeeded.filter((source) => isQuietSource(rule, source));

  let alertsCreated = 0;
  let newEvents = 0;
  let changedEvents = 0;
  for (const normalized of events) {
    let existing = await getEventBySourceId(normalized.source_slug, normalized.source_event_id, normalized.user_id);
    let alertTypes: AlertType[];
    let savedEvent: EventRecord;
    if (existing) {
      alertTypes = getAlertTypes(existing, normalized);
      savedEvent = await upsertEvent(normalized);
    } else {
      // Each source is polled in its own job, so the same show can arrive
      // again from another source after it was already saved.
      const decision = await resolveCrossSource(normalized);
      if (decision.action === "skip") continue;
      if (decision.action === "replace") {
        existing = decision.existing;
        alertTypes = alertTypesForReplacement(getAlertTypes(existing, normalized), normalized);
        savedEvent = await replaceCrossSourceRow(existing, normalized);
      } else {
        alertTypes = getAlertTypes(null, normalized);
        savedEvent = await upsertEvent(normalized);
      }
    }
    const latestSnapshot = await getLatestSnapshot(savedEvent.id);
    const rawHash = hashJson(normalized.raw_json);

    if (!latestSnapshot || latestSnapshot.raw_json_hash !== rawHash) {
      await createSnapshot(savedEvent.id, rawHash, normalized.raw_json);
    }

    if (!existing) newEvents += 1;
    else if (alertTypes.length > 0) changedEvents += 1;

    if (quietSources.includes(normalized.source_slug)) continue;
    for (const alertType of alertTypes) {
      if (await persistAndDeliverAlert(alertType, existing, savedEvent)) alertsCreated += 1;
    }
  }

  if (rule) {
    for (const source of quietSources) await markArtistSourceBaselined(rule.id, source);
  }

  return {
    result: {
      checkedArtists: 1,
      fetchedEvents: fetched.length,
      dedupedEvents: events.length,
      newEvents,
      changedEvents,
      alertsCreated,
      startedAt,
      endedAt: new Date().toISOString(),
    },
    succeededSources: succeeded,
    quietSources,
    cadenceSeconds: artistCadenceSeconds(
      events.flatMap((event) => [
        event.on_sale_start,
        ...(event.sale_windows ?? []).map((window) => window.starts_at),
      ]),
    ),
  };
};

/** Queue path: check one followed artist by id, for the given sources. */
export const runPollForArtist = async (
  artistId: string,
  userId?: string,
  sourceSlugs?: string[],
): Promise<ArtistCheckOutcome | null> => {
  const artists = await listWatchArtists(userId);
  const artist = artists.find((item) => item.id === artistId);
  if (!artist) return null;
  return runArtistCheck(artist, sourceSlugs);
};

/** How long an add request waits for the first check before answering. */
export const FIRST_CHECK_TIMEOUT_MS = 6000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

export type FirstCheckResult =
  | { status: "checked"; saved: number }
  | { status: "skipped" }
  | { status: "failed"; error: string };

/**
 * Run a newly followed artist's first check inline so the feed fills right
 * away. It's quiet (no alerts), bounded to one artist, the configured
 * sources, and a timeout, and it never throws: the queued jobs remain the
 * fallback. Sources that answered have their queued jobs pushed out.
 */
export const runFirstArtistCheck = async (
  artist: WatchArtist,
  timeoutMs = FIRST_CHECK_TIMEOUT_MS,
): Promise<FirstCheckResult> => {
  const sources = runnableArtistSources();
  if (sources.length === 0) return { status: "skipped" };
  try {
    const outcome = await withTimeout(runArtistCheck(artist, sources), timeoutMs);
    await postponeArtistJobs(artist.user_id, artist.id, outcome.succeededSources, outcome.cadenceSeconds).catch(
      (error: unknown) => logger.error("[poll] could not postpone queued jobs after first check", error),
    );
    return { status: "checked", saved: outcome.result.dedupedEvents };
  } catch (error) {
    logger.error(`[poll] first check for ${artist.name} failed`, error);
    return { status: "failed", error: (error as Error).message };
  }
};
