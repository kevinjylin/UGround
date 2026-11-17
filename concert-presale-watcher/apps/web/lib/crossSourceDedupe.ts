import { supabaseRequest } from "./supabase";
import type { AlertType, DiscoveredEvent, EventRecord, NormalizedEvent } from "./types";
import { foldText, SOURCE_PRIORITY } from "./utils";

/**
 * The dispatcher polls one source per job and rows are keyed by
 * (user, source, source event id), so the same show from Ticketmaster and
 * Songkick would otherwise be saved, and alerted, twice. Before saving a show
 * a user doesn't have yet from this source, look for the same show from
 * another source and decide:
 *
 * - `skip`: a source at least as trusted already has it.
 * - `replace`: a less trusted source has it. Rewrite that row in place as
 *   this source's (keeping its id, alerts and the user's interested/going
 *   mark) and diff against it, so it isn't announced as a new show.
 * - `save`: nobody has it; save as new.
 */
export type CrossSourceDecision =
  | { action: "save" }
  | { action: "skip"; existing: EventRecord }
  | { action: "replace"; existing: EventRecord };

type ShowFields = Pick<EventRecord, "source_slug" | "venue" | "city" | "start_time" | "dedupe_key">;

/** Two sources' clocks for the same show can differ by a time zone offset. */
const SAME_SHOW_MAX_DRIFT_MS = 12 * 3600 * 1000;
/** Candidate window: a date-only listing (midnight UTC) vs an evening show in the Americas. */
const CANDIDATE_WINDOW_MS = 36 * 3600 * 1000;

const keyParts = (key: string): { artist: string; day: string } => {
  const parts = key.split("::");
  return { artist: parts[0] ?? "", day: parts[parts.length - 1] ?? "" };
};

const VENUE_STOPWORDS = new Set(["the", "at", "and", "of"]);
const VENUE_SYNONYMS: Record<string, string> = { theatre: "theater", centre: "center", ctr: "center" };

const venueTokens = (venue: string): Set<string> =>
  new Set(
    foldText(venue)
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token && !VENUE_STOPWORDS.has(token))
      .map((token) => VENUE_SYNONYMS[token] ?? token),
  );

/**
 * Venue names differ between sources ("The Fillmore" vs "Fillmore
 * Auditorium", "Brooklyn Steel - NY"). They match when one's words are all
 * in the other's, or most of their words are shared.
 */
export const venuesMatch = (a: string, b: string): boolean => {
  const left = venueTokens(a);
  const right = venueTokens(b);
  if (left.size === 0 || right.size === 0) return false;
  const shared = [...left].filter((token) => right.has(token)).length;
  const smaller = Math.min(left.size, right.size);
  if (shared === smaller) return true;
  return shared / (left.size + right.size - shared) >= 0.6;
};

const timeOf = (value: string | null): number | null => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

/** Same artist, same day (or close enough in time), same venue (or city when a venue is missing). */
export const isSameShow = (a: ShowFields, b: ShowFields): boolean => {
  const left = keyParts(a.dedupe_key);
  const right = keyParts(b.dedupe_key);
  if (!left.artist || left.artist !== right.artist) return false;

  const leftTime = timeOf(a.start_time);
  const rightTime = timeOf(b.start_time);
  const sameDay = left.day === right.day && left.day !== "unknown-day";
  // Rows saved before keys used the local date carry the UTC day, so fall
  // back to the clock; 12 hours keeps consecutive nights of a run apart.
  const closeInTime =
    leftTime !== null && rightTime !== null && Math.abs(leftTime - rightTime) <= SAME_SHOW_MAX_DRIFT_MS;
  if (!sameDay && !closeInTime) return false;

  if (a.venue && b.venue) return venuesMatch(a.venue, b.venue);
  if (a.city && b.city) return foldText(a.city).trim() === foldText(b.city).trim();
  return true;
};

const priorityOf = (slug: EventRecord["source_slug"]): number => SOURCE_PRIORITY[slug] ?? 0;

/** Pure decision over rows already fetched. Rows from the event's own source are ignored. */
export const decideCrossSource = (event: ShowFields, candidates: EventRecord[]): CrossSourceDecision => {
  const matches = candidates
    .filter((row) => row.source_slug !== event.source_slug && isSameShow(event, row))
    .sort(
      (a, b) =>
        priorityOf(b.source_slug) - priorityOf(a.source_slug) ||
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );
  const best = matches[0];
  if (!best) return { action: "save" };
  // Equal priority (Songkick vs Bandsintown): the first one saved keeps it.
  if (priorityOf(best.source_slug) >= priorityOf(event.source_slug)) return { action: "skip", existing: best };
  return { action: "replace", existing: best };
};

/** The pick within a batch of candidate rows, for callers that fetched them in bulk. */
export const findCrossSourceMatch = (event: ShowFields, candidates: EventRecord[]): EventRecord | null => {
  const decision = decideCrossSource(event, candidates);
  return decision.action === "save" ? null : decision.existing;
};

/** A user's rows for this show's artist around its date, from other sources. */
export const listCrossSourceCandidates = async (
  event: Pick<NormalizedEvent, "user_id" | "source_slug" | "start_time" | "dedupe_key">,
): Promise<EventRecord[]> => {
  const { artist } = keyParts(event.dedupe_key);
  if (!artist || artist === "unknown") return [];
  const time = timeOf(event.start_time);
  const when =
    time === null
      ? `&dedupe_key=eq.${encodeURIComponent(event.dedupe_key)}`
      : `&dedupe_key=like.${encodeURIComponent(`${artist}::*`)}` +
        `&start_time=gte.${encodeURIComponent(new Date(time - CANDIDATE_WINDOW_MS).toISOString())}` +
        `&start_time=lte.${encodeURIComponent(new Date(time + CANDIDATE_WINDOW_MS).toISOString())}`;
  return supabaseRequest<EventRecord[]>(
    `/events?select=*&user_id=eq.${encodeURIComponent(event.user_id)}` +
      `&source_slug=neq.${encodeURIComponent(event.source_slug)}${when}&limit=20`,
  );
};

/** Look up and decide for one event about to be saved as new. */
export const resolveCrossSource = async (event: NormalizedEvent): Promise<CrossSourceDecision> =>
  decideCrossSource(event, await listCrossSourceCandidates(event));

/**
 * A user's rows from sources other than `sourceSlug` starting in a window,
 * fetched once for a whole batch (venue and area checks).
 */
export const listCrossSourceCandidatesInWindow = async (
  userId: string,
  sourceSlug: string,
  events: Array<Pick<DiscoveredEvent, "start_time">>,
): Promise<EventRecord[]> => {
  const times = events.map((event) => timeOf(event.start_time)).filter((time): time is number => time !== null);
  if (times.length === 0) return [];
  const from = new Date(Math.min(...times) - CANDIDATE_WINDOW_MS).toISOString();
  const to = new Date(Math.max(...times) + CANDIDATE_WINDOW_MS).toISOString();
  return supabaseRequest<EventRecord[]>(
    `/events?select=*&user_id=eq.${encodeURIComponent(userId)}&source_slug=neq.${encodeURIComponent(sourceSlug)}` +
      `&start_time=gte.${encodeURIComponent(from)}&start_time=lte.${encodeURIComponent(to)}&limit=1000`,
  );
};

/**
 * Rewrite a lower-priority source's row as this event, in place. The row
 * keeps its id (so its alerts, snapshots and the user's mark stay with it)
 * and its watch_rule_id. Call only when this source has no row of its own
 * for the event yet, or the (user, source, source_event_id) key collides.
 */
export const replaceCrossSourceRow = async (
  existing: EventRecord,
  normalized: NormalizedEvent,
): Promise<EventRecord> =>
  supabaseRequest<EventRecord>(
    `/events?select=*&id=eq.${encodeURIComponent(existing.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
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
        image_url: normalized.image_url ?? existing.image_url ?? null,
        price_min: normalized.price_min ?? null,
        price_max: normalized.price_max ?? null,
        price_currency: normalized.price_currency ?? null,
        lineup: normalized.lineup ?? existing.lineup ?? [],
        dedupe_key: normalized.dedupe_key,
        last_seen_at: new Date().toISOString(),
      }),
    },
    true,
  );

const REAL_STATUS_CHANGES = new Set(["cancelled", "postponed", "rescheduled"]);

/**
 * Alerts worth sending when a show moves to a better source. The show isn't
 * new, its ticket link changes only because the source did, and lower
 * sources report most shows as plain "scheduled", so only a cancellation,
 * postponement or reschedule counts as a status change. Sale windows the
 * lower source didn't know about still alert.
 */
export const alertTypesForReplacement = (
  alertTypes: AlertType[],
  next: Pick<NormalizedEvent, "status">,
): AlertType[] =>
  alertTypes.filter((type) => {
    if (type === "new_event" || type === "ticket_url_changed") return false;
    if (type === "status_changed") return REAL_STATUS_CHANGES.has(next.status);
    return true;
  });
