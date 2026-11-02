"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { relativeTime } from "../../lib/format";
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
import EventList from "../components/EventList";
import FeedToolbar, {
  type EventFilter,
  type EventSort,
} from "../components/FeedToolbar";
import OnSaleHero from "../components/OnSaleHero";
import SettingsDrawer from "../components/SettingsDrawer";
import AppSidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

const DAY_MS = 24 * 60 * 60 * 1000;
type SettingsTab = "watchlist" | "notifications" | "account";

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const latestActivityTime = (
  event: EventRecord,
  alertsByEventId: Map<string, AlertRecord[]>,
): number => {
  const latestAlertTime = toTimestamp(
    alertsByEventId.get(event.id)?.[0]?.created_at,
  );

  // last_seen_at moves on every check, so it says nothing about change.
  return Math.max(
    latestAlertTime,
    toTimestamp(event.updated_at),
    toTimestamp(event.created_at),
  );
};

const changedWithinDay = (
  event: EventRecord,
  alertsByEventId: Map<string, AlertRecord[]>,
): boolean => {
  const latestAlertAt = toTimestamp(
    alertsByEventId.get(event.id)?.[0]?.created_at,
  );

  return latestAlertAt > 0 && Date.now() - latestAlertAt <= DAY_MS;
};

export default function DashboardPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<WatchArtist[]>([]);
  const [watchRules, setWatchRules] = useState<WatchRule[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettingsResponse | null>(null);

  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [country, setCountry] = useState("US");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [sort, setSort] = useState<EventSort>("recent_change");
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

  const refreshAll = async (isInitialLoad = false) => {
    setBusy(true);
    setError(null);
    try {
      const [watchlistRes, watchRulesRes, eventsRes, alertsRes, notificationSettingsRes] =
        await Promise.all([
          fetch("/api/watchlist", { cache: "no-store" }),
          fetch("/api/watch-rules", { cache: "no-store" }),
          fetch("/api/events?limit=200", { cache: "no-store" }),
          fetch("/api/alerts?limit=60", { cache: "no-store" }),
          fetch("/api/notification-settings", { cache: "no-store" }),
        ]);
      const watchlistJson = (await watchlistRes.json()) as {
        artists?: WatchArtist[];
        error?: string;
      };
      const eventsJson = (await eventsRes.json()) as {
        events?: EventRecord[];
        error?: string;
      };
      const watchRulesJson = (await watchRulesRes.json()) as {
        rules?: WatchRule[];
        error?: string;
      };
      const alertsJson = (await alertsRes.json()) as {
        alerts?: AlertRecord[];
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
        eventsJson.error ||
        alertsJson.error ||
        notificationSettingsJson.error
      ) {
        throw new Error(
            watchlistJson.error ??
            watchRulesJson.error ??
            eventsJson.error ??
            alertsJson.error ??
            notificationSettingsJson.error,
        );
      }
      const fetchedArtists = watchlistJson.artists ?? [];
      const fetchedEvents = eventsJson.events ?? [];

      setArtists(fetchedArtists);
      setWatchRules(watchRulesJson.rules ?? []);
      setEvents(fetchedEvents);
      setAlerts(alertsJson.alerts ?? []);
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
  }, []);

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

  const filterCounts = useMemo(() => {
    let onsale = 0;
    let scheduled = 0;
    let changedToday = 0;

    for (const event of events) {
      if (event.status === "onsale") onsale += 1;
      if (event.status === "scheduled") scheduled += 1;
      if (changedWithinDay(event, alertsByEventId)) changedToday += 1;
    }

    return {
      all: events.length,
      onsale,
      scheduled,
      changed_today: changedToday,
    };
  }, [alertsByEventId, events]);

  const filters = useMemo(
    () => [
      { id: "all" as const, label: "All", count: filterCounts.all },
      {
        id: "onsale" as const,
        label: "On sale",
        count: filterCounts.onsale,
      },
      {
        id: "changed_today" as const,
        label: "Changed today",
        count: filterCounts.changed_today,
      },
      {
        id: "scheduled" as const,
        label: "Upcoming",
        count: filterCounts.scheduled,
      },
    ],
    [filterCounts],
  );

  const filteredSortedEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (filter === "all") return true;
      if (filter === "changed_today") {
        return changedWithinDay(event, alertsByEventId);
      }
      return event.status === filter;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "date_soonest") {
        const aTime = a.start_time
          ? toTimestamp(a.start_time)
          : Number.POSITIVE_INFINITY;
        const bTime = b.start_time
          ? toTimestamp(b.start_time)
          : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;

        return (
          a.artist_name.localeCompare(b.artist_name) ||
          a.title.localeCompare(b.title)
        );
      }

      if (sort === "artist_az") {
        return (
          a.artist_name.localeCompare(b.artist_name) ||
          a.title.localeCompare(b.title)
        );
      }

      return (
        latestActivityTime(b, alertsByEventId) -
          latestActivityTime(a, alertsByEventId) ||
        a.artist_name.localeCompare(b.artist_name)
      );
    });
  }, [alertsByEventId, events, filter, sort]);

  const onSaleEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === "onsale")
        .sort(
          (a, b) =>
            latestActivityTime(b, alertsByEventId) -
              latestActivityTime(a, alertsByEventId) ||
            a.artist_name.localeCompare(b.artist_name),
        )
        .slice(0, 6),
    [alertsByEventId, events],
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

  const addArtist = async (name: string, spotifyId?: string) => {
    setError(null);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        spotifyId,
        city: city || undefined,
        state: stateRegion || undefined,
        country: country || "US",
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

  const importFromSpotify = async (ids: string) => {
    setError(null);
    const res = await fetch("/api/watchlist/import-spotify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistIds: ids,
        city: city || undefined,
        state: stateRegion || undefined,
        country: country || "US",
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
  ) => {
    const res = await fetch("/api/integrations/spotify/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistUrl,
        selectedArtistIds,
        city: city || undefined,
        state: stateRegion || undefined,
        country: country || "US",
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Spotify playlist import failed");
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

  const upcomingCount = filterCounts.all;

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
            {followingSummary && !(busy && events.length === 0) ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="tabular">{upcomingCount}</span>{" "}
                {upcomingCount === 1 ? "show" : "shows"} from {followingSummary}
              </p>
            ) : null}
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <OnSaleHero
            events={onSaleEvents}
            alertsByEventId={alertsByEventId}
            totalCount={filterCounts.onsale}
            onShowAll={() => setFilter("onsale")}
          />

          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as EventFilter)}
            className="min-w-0 gap-4"
          >
            {events.length > 0 || busy ? (
              <FeedToolbar sort={sort} filters={filters} onSortChange={setSort} />
            ) : null}
            <TabsContent value={filter} className="mt-0">
              <EventList
                events={filteredSortedEvents}
                alertsByEventId={alertsByEventId}
                ruleLabelById={ruleLabelById}
                totalEvents={events.length}
                loading={busy && events.length === 0}
                hasArtists={artists.length > 0 || ruleLabelById.size > 0}
                onOpenWatchlist={() => openSettings("watchlist")}
                onClearFilter={() => setFilter("all")}
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
        city={city}
        stateRegion={stateRegion}
        country={country}
        notificationSettings={notificationSettings}
        polling={polling}
        lastPoll={lastPoll}
        onClose={closeSettings}
        onCityChange={setCity}
        onStateChange={setStateRegion}
        onCountryChange={setCountry}
        onAddArtist={addArtist}
        onRemoveArtist={removeArtist}
        onAddWatchRule={addWatchRule}
        onRemoveWatchRule={removeWatchRule}
        onImportSpotify={importFromSpotify}
        onPreviewSpotifyPlaylist={previewSpotifyPlaylist}
        onImportSpotifyPlaylist={importSpotifyPlaylist}
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
