"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AlertRecord, EventRecord, PollResult, WatchArtist } from "../lib/types";

interface HealthResponse {
  databaseConfigured: boolean;
  sourceKeysConfigured: {
    ticketmaster: boolean;
    eventbrite: boolean;
    spotify: boolean;
  };
  alertChannelsConfigured: {
    discord: boolean;
    email: boolean;
    sms: boolean;
  };
}

const sourceLabel: Record<EventRecord["source_slug"], string> = {
  ticketmaster: "Ticketmaster",
  eventbrite: "Eventbrite",
  manual: "Manual",
};

const shortDate = (value: string | null): string => {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
};

export default function Home() {
  const [artists, setArtists] = useState<WatchArtist[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [artistName, setArtistName] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [country, setCountry] = useState("US");
  const [spotifyIds, setSpotifyIds] = useState("");
  const [pollSecret, setPollSecret] = useState("");

  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastPoll, setLastPoll] = useState<PollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = async () => {
    setBusy(true);
    setError(null);

    try {
      const [watchlistResponse, eventsResponse, alertsResponse, healthResponse] = await Promise.all([
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/events?limit=80", { cache: "no-store" }),
        fetch("/api/alerts?limit=60", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
      ]);

      const watchlistJson = (await watchlistResponse.json()) as { artists?: WatchArtist[]; error?: string };
      const eventsJson = (await eventsResponse.json()) as { events?: EventRecord[]; error?: string };
      const alertsJson = (await alertsResponse.json()) as { alerts?: AlertRecord[]; error?: string };
      const healthJson = (await healthResponse.json()) as HealthResponse;

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

  const addArtist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: artistName,
          city: city || undefined,
          state: stateRegion || undefined,
          country: country || "US",
        }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Failed to add artist");
      }

      setArtistName("");
      await refreshAll();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const removeArtist = async (artistId: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/watchlist/${artistId}`, {
        method: "DELETE",
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Failed to remove artist");
      }

      await refreshAll();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const importFromSpotify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/watchlist/import-spotify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artistIds: spotifyIds,
          city: city || undefined,
          state: stateRegion || undefined,
          country: country || "US",
        }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Spotify import failed");
      }

      setSpotifyIds("");
      await refreshAll();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const runPoll = async () => {
    setPolling(true);
    setError(null);

    try {
      const response = await fetch("/api/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pollSecret ? { "x-poll-secret": pollSecret } : {}),
        },
        body: JSON.stringify({
          city: city || undefined,
        }),
      });

      const json = (await response.json()) as { result?: PollResult; error?: string };
      if (!response.ok || json.error || !json.result) {
        throw new Error(json.error ?? "Poll run failed");
      }

      setLastPoll(json.result);
      await refreshAll();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="pageShell">
      <header className="hero">
        <p className="kicker">Concert Presale Watcher</p>
        <h1>Watch artists and alert fast when listings change.</h1>
        <p>
          Focused MVP: follow artists, poll Ticketmaster/Eventbrite on a schedule, detect updates, then send
          alerts through Discord, email, and SMS.
        </p>
      </header>

      {error ? <p className="errorBanner">{error}</p> : null}

      <section className="grid statsRow">
        <article className="panel statPanel">
          <span>Followed Artists</span>
          <strong>{artists.length}</strong>
        </article>
        <article className="panel statPanel">
          <span>Tracked Events</span>
          <strong>{events.length}</strong>
        </article>
        <article className="panel statPanel">
          <span>Recent Alerts</span>
          <strong>{alerts.length}</strong>
        </article>
      </section>

      <section className="grid twoCol">
        <article className="panel">
          <h2>Follow Artist</h2>
          <form className="stack" onSubmit={addArtist}>
            <input
              value={artistName}
              onChange={(event) => setArtistName(event.target.value)}
              placeholder="Artist name"
              required
            />
            <div className="inlineInputs">
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City (optional)"
              />
              <input
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                placeholder="State"
              />
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Country"
              />
            </div>
            <button type="submit" disabled={busy}>
              Add to Watchlist
            </button>
          </form>

          <h3>Spotify ID Import</h3>
          <form className="stack" onSubmit={importFromSpotify}>
            <textarea
              value={spotifyIds}
              onChange={(event) => setSpotifyIds(event.target.value)}
              placeholder="Paste Spotify artist IDs (comma or newline separated)"
              rows={4}
            />
            <button type="submit" disabled={busy}>
              Import from Spotify
            </button>
          </form>

          <div className="pollBox">
            <input
              value={pollSecret}
              onChange={(event) => setPollSecret(event.target.value)}
              placeholder="Poll secret (only if configured)"
            />
            <button type="button" onClick={runPoll} disabled={polling}>
              {polling ? "Polling..." : "Run Poll Now"}
            </button>
          </div>

          {lastPoll ? (
            <p className="muted">
              Last poll: {lastPoll.dedupedEvents} deduped events, {lastPoll.alertsCreated} alerts, ended at{" "}
              {shortDate(lastPoll.endedAt)}.
            </p>
          ) : null}
        </article>

        <article className="panel">
          <h2>Watchlist</h2>
          <ul className="list">
            {artists.map((artist) => (
              <li key={artist.id} className="listItem">
                <div>
                  <strong>{artist.name}</strong>
                  <p>
                    {(artist.city || "Any city") + ", " + (artist.country || "US")}
                    {artist.spotify_id ? ` · Spotify: ${artist.spotify_id}` : ""}
                  </p>
                </div>
                <button type="button" className="dangerButton" onClick={() => void removeArtist(artist.id)}>
                  Remove
                </button>
              </li>
            ))}
            {artists.length === 0 ? <li className="emptyState">No followed artists yet.</li> : null}
          </ul>
        </article>
      </section>

      <section className="grid twoCol">
        <article className="panel">
          <h2>Events</h2>
          <ul className="list">
            {events.map((event) => (
              <li key={event.id} className="listItem">
                <div>
                  <strong>{event.artist_name}</strong>
                  <p>
                    {event.title} · {event.venue ?? "Unknown venue"}
                  </p>
                  <p>
                    {event.city ?? "Unknown city"} · {shortDate(event.start_time)} · {sourceLabel[event.source_slug]} ·
                    {" "}
                    {event.status}
                  </p>
                </div>
                <a href={event.ticket_url ?? "#"} target="_blank" rel="noreferrer">
                  Ticket
                </a>
              </li>
            ))}
            {events.length === 0 ? <li className="emptyState">No events tracked yet.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <h2>Alerts</h2>
          <ul className="list">
            {alerts.map((alert) => (
              <li key={alert.id} className="listItem">
                <div>
                  <strong>{alert.alert_type}</strong>
                  <p>{alert.message}</p>
                  <p>{shortDate(alert.created_at)}</p>
                </div>
                <span className="pill">{alert.sent_channels.join(", ") || "stored"}</span>
              </li>
            ))}
            {alerts.length === 0 ? <li className="emptyState">No alerts fired yet.</li> : null}
          </ul>
        </article>
      </section>

      <section className="panel healthPanel">
        <h2>Integrations</h2>
        {health ? (
          <div className="healthGrid">
            <p>DB: {health.databaseConfigured ? "ready" : "missing config"}</p>
            <p>Ticketmaster key: {health.sourceKeysConfigured.ticketmaster ? "yes" : "no"}</p>
            <p>Eventbrite key: {health.sourceKeysConfigured.eventbrite ? "yes" : "no"}</p>
            <p>Spotify keypair: {health.sourceKeysConfigured.spotify ? "yes" : "no"}</p>
            <p>Discord alerts: {health.alertChannelsConfigured.discord ? "yes" : "no"}</p>
            <p>Email alerts: {health.alertChannelsConfigured.email ? "yes" : "no"}</p>
            <p>SMS alerts: {health.alertChannelsConfigured.sms ? "yes" : "no"}</p>
          </div>
        ) : (
          <p className="muted">Loading integration status...</p>
        )}
      </section>
    </div>
  );
}
