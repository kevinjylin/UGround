import { rpcRequest, supabaseRequest } from "../supabase";
import type { FeedCounts, FeedQuery, FeedSource, UserState } from "../feedQuery";
import { emptyFeedCounts } from "../feedQuery";
import type { AlertRecord, EventRecord } from "../types";

/**
 * Feed reads and per-show actions. Paging, filtering, search and counts run in
 * the database (supabase/migrations/20261116000200_event_user_state.sql), so
 * counts and sort order cover every show, not just the loaded page.
 */

const sourceParams = (source: FeedSource | null) => ({
  p_source: source?.kind ?? null,
  p_source_id: source?.id ?? null,
});

export const listFeedEvents = async (
  userId: string,
  query: FeedQuery,
  page: { limit: number; offset: number },
): Promise<EventRecord[]> =>
  rpcRequest<EventRecord[]>("list_feed_events", {
    p_user_id: userId,
    p_view: query.view,
    p_filter: query.filter,
    p_query: query.q || null,
    ...sourceParams(query.source),
    p_sort: query.sort,
    p_limit: page.limit,
    p_offset: page.offset,
  });

export const countFeedEvents = async (
  userId: string,
  query: Pick<FeedQuery, "view" | "q" | "source">,
): Promise<FeedCounts> => {
  const counts = await rpcRequest<Partial<FeedCounts> | null>("feed_event_counts", {
    p_user_id: userId,
    p_view: query.view,
    p_query: query.q || null,
    ...sourceParams(query.source),
  });
  return { ...emptyFeedCounts, ...(counts ?? {}) };
};

const ID_CHUNK = 100;

/** The user's alerts for these shows, newest first. */
export const listAlertsForEvents = async (
  userId: string,
  eventIds: string[],
): Promise<AlertRecord[]> => {
  const results: AlertRecord[] = [];
  for (let start = 0; start < eventIds.length; start += ID_CHUNK) {
    const list = `(${eventIds.slice(start, start + ID_CHUNK).join(",")})`;
    const rows = await supabaseRequest<AlertRecord[]>(
      `/alerts?select=*&user_id=eq.${encodeURIComponent(userId)}&event_id=in.${encodeURIComponent(list)}&order=created_at.desc&limit=1000`,
    );
    results.push(...rows);
  }
  return results;
};

export const getUserEvent = async (
  eventId: string,
  userId: string,
): Promise<EventRecord | null> => {
  const rows = await supabaseRequest<EventRecord[]>(
    `/events?select=*&id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return rows[0] ?? null;
};

/** Returns the updated show, or null when the user has no such show. */
export const setEventUserState = async (
  eventId: string,
  userId: string,
  state: UserState | null,
): Promise<EventRecord | null> => {
  const rows = await supabaseRequest<EventRecord[]>(
    `/events?select=*&id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_state: state }),
    },
  );
  return rows[0] ?? null;
};
