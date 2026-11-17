/**
 * The show feed's query: which shows, in what order, and which page. Shared by
 * the dashboard (to build the URL) and GET /api/events (to read it back), so
 * it has no server-only imports.
 */

export const FEED_VIEWS = ["upcoming", "past", "hidden"] as const;
export const FEED_FILTERS = ["all", "onsale", "changed_today", "scheduled", "saved"] as const;
export const FEED_SORTS = ["recent_change", "date_soonest", "artist_az"] as const;
export const USER_STATES = ["interested", "going", "hidden"] as const;

export type FeedView = (typeof FEED_VIEWS)[number];
export type FeedFilter = (typeof FEED_FILTERS)[number];
export type FeedSort = (typeof FEED_SORTS)[number];
export type UserState = (typeof USER_STATES)[number];

/** What found a show: any artist watch, one artist watch, or one venue or area watch. */
export type FeedSource =
  | { kind: "artist"; id: string | null }
  | { kind: "rule"; id: string };

export interface FeedQuery {
  view: FeedView;
  filter: FeedFilter;
  sort: FeedSort;
  /** Matches artist, venue or city. */
  q: string;
  source: FeedSource | null;
}

export const FEED_PAGE_SIZE = 50;
export const FEED_MAX_PAGE_SIZE = 200;
export const FEED_QUERY_MAX_LENGTH = 100;

export const defaultFeedQuery: FeedQuery = {
  view: "upcoming",
  filter: "all",
  sort: "recent_change",
  q: "",
  source: null,
};

/** Counts the server returns alongside a page. */
export interface FeedCounts {
  all: number;
  onsale: number;
  scheduled: number;
  changed_today: number;
  saved: number;
  upcoming: number;
  past: number;
  hidden: number;
  /** Upcoming shows with no search or source filter, for the page headline. */
  upcoming_total: number;
  onsale_total: number;
}

export const emptyFeedCounts: FeedCounts = {
  all: 0,
  onsale: 0,
  scheduled: 0,
  changed_today: 0,
  saved: 0,
  upcoming: 0,
  past: 0,
  hidden: 0,
  upcoming_total: 0,
  onsale_total: 0,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (options as readonly string[]).includes(value) ? (value as T) : fallback;

/** "artist", "artist:<uuid>" or "rule:<uuid>". */
export const formatFeedSource = (source: FeedSource | null): string | null => {
  if (!source) return null;
  if (source.kind === "artist") return source.id ? `artist:${source.id}` : "artist";
  return `rule:${source.id}`;
};

export const parseFeedSource = (value: string | null): FeedSource | null => {
  if (!value) return null;
  if (value === "artist") return { kind: "artist", id: null };
  const [kind, id] = value.split(":", 2);
  if (!id || !isUuid(id)) return null;
  if (kind === "artist") return { kind: "artist", id };
  if (kind === "rule") return { kind: "rule", id };
  return null;
};

export class FeedQueryError extends Error {}

const parseCount = (value: string | null, fallback: number, max: number): number => {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new FeedQueryError("Invalid paging value.");
  const parsed = Number(value);
  if (parsed > max) throw new FeedQueryError("Invalid paging value.");
  return parsed;
};

export interface ParsedFeedRequest extends FeedQuery {
  limit: number;
  offset: number;
}

/**
 * Reads the feed query from a URL. Unknown view, filter and sort values fall
 * back to the defaults; bad paging throws FeedQueryError.
 */
export const parseFeedRequest = (params: URLSearchParams): ParsedFeedRequest => {
  const q = (params.get("q") ?? "").trim().slice(0, FEED_QUERY_MAX_LENGTH);
  const limit = parseCount(params.get("limit"), FEED_PAGE_SIZE, FEED_MAX_PAGE_SIZE);
  return {
    view: oneOf(FEED_VIEWS, params.get("view"), defaultFeedQuery.view),
    filter: oneOf(FEED_FILTERS, params.get("filter"), defaultFeedQuery.filter),
    sort: oneOf(FEED_SORTS, params.get("sort"), defaultFeedQuery.sort),
    q,
    source: parseFeedSource(params.get("source")),
    limit: Math.max(limit, 1),
    offset: parseCount(params.get("offset"), 0, 100_000),
  };
};

/** Query string for GET /api/events. Defaults are left out to keep URLs short. */
export const feedSearchParams = (
  query: FeedQuery,
  page: { limit?: number; offset?: number; counts?: boolean } = {},
): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.view !== defaultFeedQuery.view) params.set("view", query.view);
  if (query.filter !== defaultFeedQuery.filter) params.set("filter", query.filter);
  if (query.sort !== defaultFeedQuery.sort) params.set("sort", query.sort);
  const q = query.q.trim();
  if (q) params.set("q", q);
  const source = formatFeedSource(query.source);
  if (source) params.set("source", source);
  if (page.limit !== undefined) params.set("limit", String(page.limit));
  if (page.offset) params.set("offset", String(page.offset));
  if (page.counts) params.set("counts", "1");
  return params;
};

/** Reads the PATCH /api/events/:id body. Returns undefined when it isn't valid. */
export const parseUserStateBody = (body: unknown): UserState | null | undefined => {
  if (!body || typeof body !== "object" || !("state" in body)) return undefined;
  const { state } = body as { state: unknown };
  if (state === null) return null;
  if (typeof state === "string" && (USER_STATES as readonly string[]).includes(state)) {
    return state as UserState;
  }
  return undefined;
};
