"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { relativeTime } from "../../lib/format";
import {
  FEED_PAGE_SIZE,
  defaultFeedQuery,
  emptyFeedCounts,
  feedSearchParams,
  formatFeedSource,
  parseFeedSource,
  type FeedCounts,
  type FeedQuery,
  type FeedView,
  type UserState,
} from "../../lib/feedQuery";
import type {
  AlertRecord,
  ArtistSuggestion,
  EventRecord,
  NotificationSettingsResponse,
  PollResult,
  SourceStatus,
  WatchArtist,
  WatchRule,
} from "../../lib/types";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import ErrorBanner from "../components/ErrorBanner";
import EventList, { FeedNotice, type FeedNoticeState } from "../components/EventList";
import FeedToolbar, {
  type EventFilter,
  type EventSort,
} from "../components/FeedToolbar";
import OnSaleHero from "../components/OnSaleHero";
import SettingsDrawer from "../components/SettingsDrawer";
import { useHomeLocation, useSpotifyReturn } from "../components/useHomeLocation";
import { type LocationValue, locationRequestFields } from "@/lib/locations";
import AppSidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

type SettingsTab = "watchlist" | "notifications" | "account";

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

interface FeedResponse {
  events?: EventRecord[];
  alerts?: AlertRecord[];
  hasMore?: boolean;
  counts?: FeedCounts;
  error?: string;
}

const HERO_SIZE = 6;
const SEARCH_DEBOUNCE_MS = 250;

/** Fetches one page of the feed. Paging, sort, search and counts all run on the server. */
const fetchFeedPage = async (
  query: FeedQuery,
  page: { limit: number; offset?: number; counts?: boolean },
): Promise<FeedResponse> => {
  const response = await fetch(`/api/events?${feedSearchParams(query, page).toString()}`, {
    cache: "no-store",
  });
  const body = (await response.json()) as FeedResponse;
  if (!response.ok || body.error) throw new Error(body.error ?? "Could not load shows");
  return body;
};

const patchUserState = async (
  eventId: string,
  state: UserState | null,
): Promise<EventRecord> => {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  const body = (await response.json()) as { event?: EventRecord; error?: string };
  if (!response.ok || body.error || !body.event) {
    throw new Error(body.error ?? "Could not update the show");
  }
  return body.event;
};

const showName = (event: EventRecord): string =>
  event.venue ? `${event.artist_name} at ${event.venue}` : event.artist_name;

export default function DashboardPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<WatchArtist[]>([]);
  const [watchRules, setWatchRules] = useState<WatchRule[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettingsResponse | null>(null);

  // Saved per user; the default location for new artists and imports.
  const { home, saveHome } = useHomeLocation();
  const city = home.city;
  const [feedQuery, setFeedQuery] = useState<FeedQuery>(defaultFeedQuery);
  const [searchInput, setSearchInput] = useState("");
  const [feedCounts, setFeedCounts] = useState<FeedCounts>(emptyFeedCounts);
  const [countsReady, setCountsReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [heroEvents, setHeroEvents] = useState<EventRecord[]>([]);
  const [notice, setNotice] = useState<FeedNoticeState | null>(null);
  const feedRequestId = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState<false | SettingsTab>(false);
  const [refreshQueued, setRefreshQueued] = useState(false);

  const [busy, setBusy] = useState(true);
  const [polling, setPolling] = useState(false);
  const [lastPoll, setLastPoll] = useState<PollResult | null>(null);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Track previous artist count to detect first-artist-added transition.
  const prevArtistCount = useRef<number | null>(null);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsOpen(tab);
  }, []);
  // Back from "Connect Spotify": open the watchlist, where the import continues.
  useSpotifyReturn(useCallback(() => setSettingsOpen("watchlist"), []));

  const mergeAlerts = useCallback((incoming: AlertRecord[] | undefined) => {
    if (!incoming || incoming.length === 0) return;
    setAlerts((current) => {
      const byId = new Map(current.map((alert) => [alert.id, alert]));
      for (const alert of incoming) byId.set(alert.id, alert);
      return [...byId.values()];
    });
  }, []);

  /** Loads the first page for a query (with counts), or the next page when offset is set. */
  const loadFeed = useCallback(
    async (query: FeedQuery, offset = 0) => {
      const requestId = ++feedRequestId.current;
      const append = offset > 0;
      if (append) setLoadingMore(true);
      else setFeedLoading(true);
      try {
        const body = await fetchFeedPage(query, {
          limit: FEED_PAGE_SIZE,
          offset,
          counts: !append,
        });
        if (requestId !== feedRequestId.current) return;
        const page = body.events ?? [];
        setEvents((current) => {
          if (!append) return page;
          const seen = new Set(current.map((event) => event.id));
          return [...current, ...page.filter((event) => !seen.has(event.id))];
        });
        mergeAlerts(body.alerts);
        setHasMore(Boolean(body.hasMore));
        if (body.counts) {
          setFeedCounts(body.counts);
          setCountsReady(true);
        }
      } catch (caught) {
        if (requestId === feedRequestId.current) setError((caught as Error).message);
      } finally {
        if (requestId === feedRequestId.current) {
          setFeedLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [mergeAlerts],
  );

  /** Counts only, after a show changes state. Doesn't touch the loaded page. */
  const refreshCounts = async () => {
    try {
      const body = await fetchFeedPage(feedQuery, { limit: 1, counts: true });
      if (body.counts) setFeedCounts(body.counts);
    } catch {
      // The next full load corrects the counts.
    }
  };

  const loadHero = async () => {
    try {
      const body = await fetchFeedPage(
        { ...defaultFeedQuery, filter: "onsale" },
        { limit: HERO_SIZE },
      );
      setHeroEvents(body.events ?? []);
      mergeAlerts(body.alerts);
    } catch {
      setHeroEvents([]);
    }
  };

  const refreshAll = async (isInitialLoad = false) => {
    setBusy(true);
    setError(null);
    // The first page loads from the feed-query effect on mount.
    if (!isInitialLoad) void loadFeed(feedQuery);
    void loadHero();
    try {
      const [watchlistRes, watchRulesRes, notificationSettingsRes] =
        await Promise.all([
          fetch("/api/watchlist", { cache: "no-store" }),
          fetch("/api/watch-rules", { cache: "no-store" }),
          fetch("/api/notification-settings", { cache: "no-store" }),
        ]);
      const watchlistJson = (await watchlistRes.json()) as {
        artists?: WatchArtist[];
        error?: string;
      };
      const watchRulesJson = (await watchRulesRes.json()) as {
        rules?: WatchRule[];
        error?: string;
      };
      const notificationSettingsJson =
        (await notificationSettingsRes.json()) as {
          settings?: NotificationSettingsResponse;
          error?: string;
        };

      if (
        watchlistJson.error ||
        watchRulesJson.error ||
        notificationSettingsJson.error
      ) {
        throw new Error(
            watchlistJson.error ??
            watchRulesJson.error ??
            notificationSettingsJson.error,
        );
      }
      const fetchedArtists = watchlistJson.artists ?? [];

      setArtists(fetchedArtists);
      setWatchRules(watchRulesJson.rules ?? []);
      setNotificationSettings(notificationSettingsJson.settings ?? null);
      void fetch("/api/source-status", { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { sources?: SourceStatus[] }) =>
          setSourceStatuses(body.sources ?? []),
        )
        .catch(() => setSourceStatuses([]));

      if (isInitialLoad) {
        prevArtistCount.current = fetchedArtists.length;
      }
    } catch (caught) {
      setError((caught as Error).message);
      if (isInitialLoad) {
        prevArtistCount.current = 0;
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshAll(true);
    // Runs once on mount; later refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change to the query reloads the first page and the counts.
  useEffect(() => {
    void loadFeed(feedQuery);
  }, [feedQuery, loadFeed]);

  // Search waits for a pause in typing.
  useEffect(() => {
    const q = searchInput.trim();
    const timer = window.setTimeout(() => {
      setFeedQuery((current) => (current.q === q ? current : { ...current, q }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      void supabase.auth
        .getUser()
        .then(({ data }) => setUserEmail(data.user?.email ?? null))
        .catch(() => setUserEmail(null));
    } catch {
      // Auth isn't configured in this environment; the sidebar falls back to a generic label.
    }
  }, []);

  // When the user goes from 0 artists to 1+, auto-trigger a poll so
  // events appear immediately instead of an empty feed.
  useEffect(() => {
    if (prevArtistCount.current === null) return;
    if (prevArtistCount.current === 0 && artists.length > 0 && !polling) {
      void runPoll();
    }
    prevArtistCount.current = artists.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists.length]);

  const alertsByEventId = useMemo(() => {
    const grouped = new Map<string, AlertRecord[]>();

    for (const alert of alerts) {
      const existing = grouped.get(alert.event_id) ?? [];
      existing.push(alert);
      grouped.set(alert.event_id, existing);
    }

    for (const eventAlerts of grouped.values()) {
      eventAlerts.sort(
        (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at),
      );
    }

    return grouped;
  }, [alerts]);

  const filters = useMemo(
    () => [
      { id: "all" as const, label: "All", count: feedCounts.all },
      { id: "onsale" as const, label: "On sale", count: feedCounts.onsale },
      { id: "changed_today" as const, label: "Changed today", count: feedCounts.changed_today },
      { id: "scheduled" as const, label: "Scheduled", count: feedCounts.scheduled },
      { id: "saved" as const, label: "Saved", count: feedCounts.saved },
    ],
    [feedCounts],
  );

  const setFilter = (filter: EventFilter) =>
    setFeedQuery((current) => (current.filter === filter ? current : { ...current, filter }));
  const setSort = (sort: EventSort) =>
    setFeedQuery((current) => (current.sort === sort ? current : { ...current, sort }));
  const setView = (view: FeedView) =>
    setFeedQuery((current) => (current.view === view ? current : { ...current, view }));
  const setSource = (value: string) =>
    setFeedQuery((current) => ({ ...current, source: parseFeedSource(value || null) }));
  const clearFeedFilters = () => {
    setSearchInput("");
    setFeedQuery((current) => ({ ...current, filter: "all", q: "", source: null }));
  };
  const showAllOnSale = () => {
    setSearchInput("");
    setFeedQuery((current) => ({ ...defaultFeedQuery, sort: current.sort, filter: "onsale" }));
  };

  const feedFiltered =
    feedQuery.q !== "" || feedQuery.source !== null || feedQuery.filter !== "all";
  const hasAnyEvents =
    feedCounts.upcoming_total > 0 || feedCounts.past > 0 || feedCounts.hidden > 0;

  const replaceEvent = (updated: EventRecord) => {
    const swap = (list: EventRecord[]) =>
      list.map((event) => (event.id === updated.id ? updated : event));
    setEvents(swap);
    setHeroEvents(swap);
  };

  /**
   * Marks a show interested, going or hidden (or clears it). A show that
   * leaves the current view goes at once, with an undo that puts it back in
   * the same place.
   */
  const updateUserState = async (event: EventRecord, state: UserState | null) => {
    const previous = event.user_state ?? null;
    if (previous === state) return;
    const leavesView = (feedQuery.view === "hidden") !== (state === "hidden");
    const index = events.findIndex((item) => item.id === event.id);
    const optimistic = { ...event, user_state: state };

    setError(null);
    if (leavesView) {
      setEvents((current) => current.filter((item) => item.id !== event.id));
    } else {
      replaceEvent(optimistic);
    }
    if (state === "hidden") {
      setHeroEvents((current) => current.filter((item) => item.id !== event.id));
    }

    try {
      const saved = await patchUserState(event.id, state);
      if (!leavesView) replaceEvent(saved);
      if (leavesView) {
        setNotice({
          message:
            state === "hidden"
              ? `Hid ${showName(event)}.`
              : `${showName(event)} is back in your feed.`,
          undo: () => void undoUserState(saved, previous, index),
        });
      }
      if (previous === "hidden" || state === "hidden") void loadHero();
      void refreshCounts();
    } catch (caught) {
      if (leavesView) {
        setEvents((current) =>
          current.some((item) => item.id === event.id)
            ? current
            : [...current.slice(0, Math.max(index, 0)), event, ...current.slice(Math.max(index, 0))],
        );
      } else {
        replaceEvent(event);
      }
      setError((caught as Error).message);
    }
  };

  const undoUserState = async (
    event: EventRecord,
    previous: UserState | null,
    index: number,
  ) => {
    setNotice(null);
    setError(null);
    try {
      const restored = await patchUserState(event.id, previous);
      const belongsHere = (feedQuery.view === "hidden") === (previous === "hidden");
      if (belongsHere) {
        setEvents((current) =>
          current.some((item) => item.id === restored.id)
            ? current
            : [...current.slice(0, Math.max(index, 0)), restored, ...current.slice(Math.max(index, 0))],
        );
      }
      void loadHero();
      void refreshCounts();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const venueSources = useMemo(
    () =>
      watchRules
        .filter((rule) => rule.kind === "venue")
        .map((rule) => ({ value: formatFeedSource({ kind: "rule", id: rule.id })!, label: rule.label })),
    [watchRules],
  );
  const areaSources = useMemo(
    () =>
      watchRules
        .filter((rule) => rule.kind === "location")
        .map((rule) => ({ value: formatFeedSource({ kind: "rule", id: rule.id })!, label: rule.label })),
    [watchRules],
  );

  // Last time a source actually checked in. A queued refresh is not a check.
  const lastCheckedTimestamp = useMemo(() => {
    const fromSources = sourceStatuses.reduce(
      (latest, source) => Math.max(latest, toTimestamp(source.last_success_at)),
      0,
    );
    if (fromSources > 0) return fromSources;
    return events.reduce(
      (latest, event) => Math.max(latest, toTimestamp(event.last_seen_at)),
      0,
    );
  }, [events, sourceStatuses]);
  const lastCheckedText =
    lastCheckedTimestamp > 0
      ? `Checked ${relativeTime(new Date(lastCheckedTimestamp).toISOString())}`
      : busy
        ? "Loading"
        : "Not checked yet";

  const ruleLabelById = useMemo(
    () =>
      new Map(
        watchRules
          .filter((rule) => rule.kind !== "artist")
          .map((rule) => [rule.id, rule.kind === "location" ? `${rule.label} area` : rule.label]),
      ),
    [watchRules],
  );

  const followingSummary = useMemo(() => {
    const venues = watchRules.filter((rule) => rule.kind === "venue").length;
    const areas = watchRules.filter((rule) => rule.kind === "location").length;
    const parts = [
      artists.length > 0 ? `${artists.length} ${artists.length === 1 ? "artist" : "artists"}` : null,
      venues > 0 ? `${venues} ${venues === 1 ? "venue" : "venues"}` : null,
      areas > 0 ? `${areas} ${areas === 1 ? "area" : "areas"}` : null,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return null;
    const list =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return `the ${list} you follow`;
  }, [artists.length, watchRules]);

  // Disabled sources are off on purpose, so they don't count against health.
  const enabledSources = sourceStatuses.filter((source) => source.enabled);
  const healthySources = enabledSources.filter((source) => !source.stale).length;
  const sourceSummary =
    enabledSources.length === 0
      ? "Source health unavailable"
      : `${healthySources} of ${enabledSources.length} sources healthy`;
  const sourceHealth =
    enabledSources.length === 0
      ? ("unknown" as const)
      : healthySources === enabledSources.length
        ? ("healthy" as const)
        : ("degraded" as const);

  const addArtist = async (name: string, spotifyId: string | undefined, location: LocationValue = home) => {
    setError(null);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        spotifyId,
        ...locationRequestFields(location),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error)
      throw new Error(json.error ?? "Failed to add artist");
    await refreshAll();
  };

  const removeArtist = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error)
      throw new Error(json.error ?? "Failed to remove artist");
    await refreshAll();
  };

  const updateArtistLocation = async (id: string, location: LocationValue) => {
    const res = await fetch(`/api/watchlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locationRequestFields(location)),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Couldn't change the location");
    await refreshAll();
  };

  const addWatchRule = async (input: Record<string, unknown>) => {
    const response = await fetch("/api/watch-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok || body.error) throw new Error(body.error ?? "Failed to add watch rule");
    await refreshAll();
  };

  const removeWatchRule = async (id: string) => {
    const response = await fetch(`/api/watch-rules/${id}`, { method: "DELETE" });
    const body = (await response.json()) as { error?: string };
    if (!response.ok || body.error) throw new Error(body.error ?? "Failed to remove watch rule");
    await refreshAll();
  };

  const importFromSpotify = async (ids: string, location: LocationValue = home) => {
    setError(null);
    const res = await fetch("/api/watchlist/import-spotify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistIds: ids,
        ...locationRequestFields(location),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error)
      throw new Error(json.error ?? "Spotify import failed");
    await refreshAll();
  };

  const previewSpotifyPlaylist = async (playlistUrl: string): Promise<ArtistSuggestion[]> => {
    const res = await fetch("/api/integrations/spotify/import-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistUrl }),
    });
    const json = (await res.json()) as { artists?: ArtistSuggestion[]; error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Spotify playlist preview failed");
    return json.artists ?? [];
  };

  const importSpotifyPlaylist = async (
    playlistUrl: string,
    selectedArtistIds: string[],
    location: LocationValue = home,
  ) => {
    const res = await fetch("/api/integrations/spotify/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistUrl,
        selectedArtistIds,
        ...locationRequestFields(location),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Spotify playlist import failed");
    await refreshAll();
  };

  const importSpotifyAccount = async (selectedArtistIds: string[], location: LocationValue = home) => {
    const res = await fetch("/api/integrations/spotify/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: true,
        selectedArtistIds,
        ...locationRequestFields(location),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Spotify import failed");
    await refreshAll();
  };

  const runPoll = async () => {
    setPolling(true);
    setError(null);
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city || undefined }),
      });
      const json = (await res.json()) as {
        queued?: boolean;
        queuedJobs?: number;
        error?: string;
      };
      if (!res.ok || json.error || !json.queued)
        throw new Error(json.error ?? "Refresh could not be queued");
      setLastPoll({
        checkedArtists: artists.length,
        fetchedEvents: 0,
        dedupedEvents: 0,
        newEvents: 0,
        changedEvents: 0,
        alertsCreated: 0,
        queuedJobs: json.queuedJobs ?? 0,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      });
      setRefreshQueued(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPolling(false);
    }
  };

  const saveNotificationSettings = async (input: {
    discordWebhook?: string | null;
    discordEnabled: boolean;
    email?: string | null;
    emailEnabled: boolean;
    phone?: string | null;
    smsEnabled: boolean;
  }) => {
    setError(null);
    try {
      const res = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as {
        settings?: NotificationSettingsResponse;
        error?: string;
      };
      if (!res.ok || json.error || !json.settings)
        throw new Error(json.error ?? "Failed to save alert destinations");
      setNotificationSettings(json.settings);
    } catch (caught) {
      setError((caught as Error).message);
      throw caught;
    }
  };

  const runNotificationAction = async (
    path: string,
    body?: Record<string, unknown>,
  ) => {
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as {
        settings?: NotificationSettingsResponse;
        error?: string;
      };
      if (!res.ok || json.error)
        throw new Error(json.error ?? "Notification action failed");
      if (json.settings) {
        setNotificationSettings(json.settings);
      } else {
        await refreshAll();
      }
    } catch (caught) {
      setError((caught as Error).message);
      throw caught;
    }
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const upcomingCount = feedCounts.upcoming_total;

  return (
    <SidebarProvider>
      <a
        href="#event-feed"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to shows
      </a>
      <AppSidebar
        userEmail={userEmail}
        watchCount={artists.length}
        sources={sourceStatuses}
        onOpenSettings={openSettings}
        onLogout={() => void handleSignOut()}
      />

      <SidebarInset aria-busy={busy}>
        <TopBar
          lastCheckedText={lastCheckedText}
          refreshQueued={refreshQueued}
          busy={busy}
          polling={polling}
          onRefresh={() => void runPoll()}
          sourceSummary={sourceSummary}
          sourceHealth={sourceHealth}
        />

        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-8 pb-16 sm:px-6 lg:px-8 [&>*]:min-w-0">
          <div>
            <h1 className="font-display text-[44px] leading-[1.05]">Your shows</h1>
            {followingSummary && countsReady ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="tabular">{upcomingCount}</span> upcoming{" "}
                {upcomingCount === 1 ? "show" : "shows"} from {followingSummary}
              </p>
            ) : null}
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <OnSaleHero
            events={heroEvents}
            alertsByEventId={alertsByEventId}
            totalCount={feedCounts.onsale_total}
            onShowAll={showAllOnSale}
          />

          <Tabs
            value={feedQuery.filter}
            onValueChange={(value) => setFilter(value as EventFilter)}
            className="min-w-0 gap-4"
          >
            {hasAnyEvents || busy || feedLoading || feedFiltered || feedQuery.view !== "upcoming" ? (
              <FeedToolbar
                sort={feedQuery.sort}
                filters={filters}
                onSortChange={setSort}
                search={searchInput}
                onSearchChange={setSearchInput}
                source={formatFeedSource(feedQuery.source) ?? ""}
                venueSources={venueSources}
                areaSources={areaSources}
                hasArtistSource={artists.length > 0}
                onSourceChange={setSource}
                view={feedQuery.view}
                viewCounts={{
                  upcoming: feedCounts.upcoming,
                  past: feedCounts.past,
                  hidden: feedCounts.hidden,
                }}
                onViewChange={setView}
              />
            ) : null}
            <FeedNotice notice={notice} onDismiss={() => setNotice(null)} />
            <TabsContent value={feedQuery.filter} className="mt-0">
              <EventList
                events={events}
                alertsByEventId={alertsByEventId}
                ruleLabelById={ruleLabelById}
                hasAnyEvents={hasAnyEvents}
                matchingCount={feedCounts[feedQuery.filter]}
                view={feedQuery.view}
                filtered={feedFiltered}
                loading={(feedLoading || busy) && events.length === 0}
                hasArtists={artists.length > 0 || ruleLabelById.size > 0}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={() => void loadFeed(feedQuery, events.length)}
                onSetUserState={(event, state) => void updateUserState(event, state)}
                onOpenWatchlist={() => openSettings("watchlist")}
                onClearFilter={clearFeedFilters}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>

      <SettingsDrawer
        open={settingsOpen !== false}
        initialTab={settingsOpen || undefined}
        artists={artists}
        watchRules={watchRules}
        busy={busy}
        home={home}
        notificationSettings={notificationSettings}
        polling={polling}
        lastPoll={lastPoll}
        onClose={closeSettings}
        onSaveHome={saveHome}
        onAddArtist={addArtist}
        onRemoveArtist={removeArtist}
        onUpdateArtistLocation={updateArtistLocation}
        onAddWatchRule={addWatchRule}
        onRemoveWatchRule={removeWatchRule}
        onImportSpotify={importFromSpotify}
        onPreviewSpotifyPlaylist={previewSpotifyPlaylist}
        onImportSpotifyPlaylist={importSpotifyPlaylist}
        onImportSpotifyAccount={importSpotifyAccount}
        onPoll={runPoll}
        onSaveNotificationSettings={saveNotificationSettings}
        onTestDiscord={() =>
          runNotificationAction("/api/notification-settings/test-discord")
        }
        onSendEmailConfirmation={() =>
          runNotificationAction(
            "/api/notification-settings/send-email-confirmation",
          )
        }
        onSendSmsConfirmation={() =>
          runNotificationAction(
            "/api/notification-settings/send-sms-confirmation",
          )
        }
        onConfirmSms={(code) =>
          runNotificationAction("/api/notification-settings/confirm-sms", {
            code,
          })
        }
      />
    </SidebarProvider>
  );
}
