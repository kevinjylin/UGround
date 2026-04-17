"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { AlertRecord, EventRecord, NotificationSettingsResponse, PollResult, WatchArtist } from "../../lib/types";
import ErrorBanner from "../components/ErrorBanner";
import StatCard from "../components/StatCard";
import WatchlistPanel from "../components/WatchlistPanel";
import WatchlistList from "../components/WatchlistList";
import EventList from "../components/EventList";
import AlertList from "../components/AlertList";
import NotificationSettingsPanel from "../components/NotificationSettingsPanel";

export default function DashboardPage() {
  const [artists, setArtists] = useState<WatchArtist[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsResponse | null>(null);

  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [country, setCountry] = useState("US");

  const [busy, setBusy] = useState(true);
  const [polling, setPolling] = useState(false);
  const [lastPoll, setLastPoll] = useState<PollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const [watchlistRes, eventsRes, alertsRes, notificationSettingsRes] = await Promise.all([
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/events?limit=80", { cache: "no-store" }),
        fetch("/api/alerts?limit=60", { cache: "no-store" }),
        fetch("/api/notification-settings", { cache: "no-store" }),
      ]);
      const watchlistJson = (await watchlistRes.json()) as { artists?: WatchArtist[]; error?: string };
      const eventsJson = (await eventsRes.json()) as { events?: EventRecord[]; error?: string };
      const alertsJson = (await alertsRes.json()) as { alerts?: AlertRecord[]; error?: string };
      const notificationSettingsJson = (await notificationSettingsRes.json()) as { settings?: NotificationSettingsResponse; error?: string };

      if (watchlistJson.error || eventsJson.error || alertsJson.error || notificationSettingsJson.error) {
        throw new Error(watchlistJson.error ?? eventsJson.error ?? alertsJson.error ?? notificationSettingsJson.error);
      }
      setArtists(watchlistJson.artists ?? []);
      setEvents(eventsJson.events ?? []);
      setAlerts(alertsJson.alerts ?? []);
      setNotificationSettings(notificationSettingsJson.settings ?? null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const addArtist = async (name: string) => {
    setError(null);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, city: city || undefined, state: stateRegion || undefined, country: country || "US" }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to add artist");
    await refreshAll();
  };

  const removeArtist = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to remove artist");
    await refreshAll();
  };

  const importFromSpotify = async (ids: string) => {
    setError(null);
    const res = await fetch("/api/watchlist/import-spotify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistIds: ids, city: city || undefined, state: stateRegion || undefined, country: country || "US" }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Spotify import failed");
    await refreshAll();
  };

  const runPoll = async (secret: string) => {
    setPolling(true);
    setError(null);
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { "x-poll-secret": secret } : {}) },
        body: JSON.stringify({ city: city || undefined }),
      });
      const json = (await res.json()) as { result?: PollResult; error?: string };
      if (!res.ok || json.error || !json.result) throw new Error(json.error ?? "Poll run failed");
      setLastPoll(json.result);
      await refreshAll();
    } finally {
      setPolling(false);
    }
  };

  const saveNotificationSettings = async (input: {
    discordWebhook?: string;
    discordEnabled: boolean;
    email?: string;
    emailEnabled: boolean;
    phone?: string;
    smsEnabled: boolean;
  }) => {
    setError(null);
    try {
      const res = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as { settings?: NotificationSettingsResponse; error?: string };
      if (!res.ok || json.error || !json.settings) throw new Error(json.error ?? "Failed to save alert destinations");
      setNotificationSettings(json.settings);
    } catch (caught) {
      setError((caught as Error).message);
      throw caught;
    }
  };

  const runNotificationAction = async (path: string, body?: Record<string, unknown>) => {
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { settings?: NotificationSettingsResponse; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Notification action failed");
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

  return (
    <div className="pageShell" aria-busy={busy}>
      <header className="hero">
        <div className="heroTop">
          <span className="wordmark">UGround</span>
          <button type="button" className="btn--secondary btn--small" onClick={() => void signOut({ callbackUrl: "/login" })}>
            Log Out
          </button>
        </div>
        <h1>dont miss out.</h1>
        <p>Follow artists. Get alerts the moment presales drop.</p>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid statsRow">
        <StatCard label="Followed Artists" value={artists.length} loading={busy} accent="var(--accent)" />
        <StatCard label="Tracked Events" value={events.length} loading={busy} accent="var(--accent-2)" />
        <StatCard label="Recent Alerts" value={alerts.length} loading={busy} accent="var(--warning)" />
      </section>

      {/* Main 60/40 two-column layout */}
      <div className="mainGrid">
        <EventList events={events} loading={busy} />
        <div className="sideStack">
          <AlertList alerts={alerts} loading={busy} />
          <WatchlistPanel
            busy={busy}
            city={city}
            stateRegion={stateRegion}
            country={country}
            onCityChange={setCity}
            onStateChange={setStateRegion}
            onCountryChange={setCountry}
            onAdd={addArtist}
            onImportSpotify={importFromSpotify}
            onPoll={runPoll}
            polling={polling}
            lastPoll={lastPoll}
          />
        </div>
      </div>

      {/* Alert destinations — full width */}
      <NotificationSettingsPanel
        settings={notificationSettings}
        busy={busy}
        onSave={saveNotificationSettings}
        onTestDiscord={() => runNotificationAction("/api/notification-settings/test-discord")}
        onSendEmailConfirmation={() => runNotificationAction("/api/notification-settings/send-email-confirmation")}
        onSendSmsConfirmation={() => runNotificationAction("/api/notification-settings/send-sms-confirmation")}
        onConfirmSms={(code) => runNotificationAction("/api/notification-settings/confirm-sms", { code })}
      />

      {/* Full-width collapsible watchlist */}
      <details className="watchlistDrawer">
        <summary className="watchlistDrawerSummary">
          <span>Followed Artists</span>
          {!busy && <span className="drawerCount">{artists.length}</span>}
        </summary>
        <WatchlistList artists={artists} onRemove={removeArtist} loading={busy} />
      </details>
    </div>
  );
}
