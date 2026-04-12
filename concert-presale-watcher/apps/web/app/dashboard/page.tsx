"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { AlertRecord, EventRecord, HealthResponse, PollResult, WatchArtist } from "../../lib/types";
import ErrorBanner from "../components/ErrorBanner";
import StatCard from "../components/StatCard";
import WatchlistPanel from "../components/WatchlistPanel";
import EventList from "../components/EventList";
import AlertList from "../components/AlertList";
import IntegrationsPanel from "../components/IntegrationsPanel";

export default function DashboardPage() {
  const [artists, setArtists] = useState<WatchArtist[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);

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
      const [watchlistRes, eventsRes, alertsRes, healthRes] = await Promise.all([
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/events?limit=80", { cache: "no-store" }),
        fetch("/api/alerts?limit=60", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
      ]);
      const watchlistJson = (await watchlistRes.json()) as { artists?: WatchArtist[]; error?: string };
      const eventsJson = (await eventsRes.json()) as { events?: EventRecord[]; error?: string };
      const alertsJson = (await alertsRes.json()) as { alerts?: AlertRecord[]; error?: string };
      const healthJson = (await healthRes.json()) as HealthResponse;

      if (watchlistJson.error || eventsJson.error || alertsJson.error) {
        throw new Error(watchlistJson.error ?? eventsJson.error ?? alertsJson.error);
      }
      setArtists(watchlistJson.artists ?? []);
      setEvents(eventsJson.events ?? []);
      setAlerts(alertsJson.alerts ?? []);
      setHealth(healthJson);
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

  return (
    <div className="pageShell" aria-busy={busy}>
      <header className="hero">
        <div className="heroTop">
          <span className="wordmark">UGround</span>
          <button type="button" className="btn--secondary btn--small" onClick={() => void signOut({ callbackUrl: "/login" })}>
            Log Out
          </button>
        </div>
        <h1>get there first.</h1>
        <p>Follow artists. Get alerts the moment presales drop.</p>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid statsRow">
        <StatCard label="Followed Artists" value={artists.length} loading={busy} accent="var(--accent)" />
        <StatCard label="Tracked Events" value={events.length} loading={busy} accent="var(--accent-2)" />
        <StatCard label="Recent Alerts" value={alerts.length} loading={busy} accent="var(--warning)" />
      </section>

      <section className="grid twoCol">
        <WatchlistPanel
          artists={artists}
          busy={busy}
          city={city}
          stateRegion={stateRegion}
          country={country}
          onCityChange={setCity}
          onStateChange={setStateRegion}
          onCountryChange={setCountry}
          onAdd={addArtist}
          onImportSpotify={importFromSpotify}
          onRemove={removeArtist}
          onPoll={runPoll}
          polling={polling}
          lastPoll={lastPoll}
        />
      </section>

      <section className="grid twoCol">
        <EventList events={events} loading={busy} />
        <AlertList alerts={alerts} loading={busy} />
      </section>

      <IntegrationsPanel health={health} />
    </div>
  );
}
