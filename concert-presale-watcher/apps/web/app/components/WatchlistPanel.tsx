import { FormEvent, useId, useState } from "react";
import type { PollResult, WatchArtist } from "../../lib/types";

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
};

const formatWatchLocation = (artist: WatchArtist): string => {
  const city = artist.city?.trim() || "";
  const state = artist.state?.trim() || "";
  const country = artist.country?.trim() || "US";

  if (city && state) return `${city}, ${state}, ${country}`;
  if (city) return `${city}, ${country}`;
  if (state) return `Any city in ${state}, ${country}`;
  return `Any city, ${country}`;
};

interface WatchlistPanelProps {
  artists: WatchArtist[];
  busy: boolean;
  city: string;
  stateRegion: string;
  country: string;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onAdd: (name: string) => Promise<void>;
  onImportSpotify: (ids: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onPoll: (secret: string) => Promise<void>;
  polling: boolean;
  lastPoll: PollResult | null;
}

export default function WatchlistPanel({
  artists,
  busy,
  city,
  stateRegion,
  country,
  onCityChange,
  onStateChange,
  onCountryChange,
  onAdd,
  onImportSpotify,
  onRemove,
  onPoll,
  polling,
  lastPoll,
}: WatchlistPanelProps) {
  const [artistName, setArtistName] = useState("");
  const [spotifyIds, setSpotifyIds] = useState("");
  const [pollSecret, setPollSecret] = useState("");
  const uid = useId();

  const handleAddArtist = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onAdd(artistName);
    setArtistName("");
  };

  const handleImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onImportSpotify(spotifyIds);
    setSpotifyIds("");
  };

  const handlePoll = async () => {
    await onPoll(pollSecret);
  };

  return (
    <>
      <article className="panel">
        <h2>Follow Artist</h2>

        <fieldset className="fieldsetSection">
          <legend>Add Artist</legend>
          <form className="stack" onSubmit={handleAddArtist}>
            <label htmlFor={`${uid}-artist`} className="srOnly">Artist name</label>
            <input
              id={`${uid}-artist`}
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Artist name"
              required
            />
            <div className="inlineInputs">
              <div>
                <label htmlFor={`${uid}-city`} className="srOnly">City</label>
                <input
                  id={`${uid}-city`}
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  placeholder="City (optional)"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-state`} className="srOnly">State</label>
                <input
                  id={`${uid}-state`}
                  value={stateRegion}
                  onChange={(e) => onStateChange(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-country`} className="srOnly">Country</label>
                <input
                  id={`${uid}-country`}
                  value={country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
            <button type="submit" disabled={busy}>Add to Watchlist</button>
          </form>
        </fieldset>

        <fieldset className="fieldsetSection">
          <legend>Spotify Import</legend>
          <form className="stack" onSubmit={handleImport}>
            <label htmlFor={`${uid}-spotify`} className="srOnly">Spotify artist IDs</label>
            <textarea
              id={`${uid}-spotify`}
              value={spotifyIds}
              onChange={(e) => setSpotifyIds(e.target.value)}
              placeholder="Paste Spotify artist IDs (comma or newline separated)"
              rows={4}
            />
            <button type="submit" disabled={busy}>Import from Spotify</button>
          </form>
        </fieldset>

        <details className="advancedSection">
          <summary>Advanced</summary>
          <div className="pollBox">
            <label htmlFor={`${uid}-secret`} className="srOnly">Poll secret</label>
            <input
              id={`${uid}-secret`}
              value={pollSecret}
              onChange={(e) => setPollSecret(e.target.value)}
              placeholder="Poll secret (only if configured)"
            />
            <button type="button" onClick={handlePoll} disabled={polling}>
              {polling ? "Polling..." : "Run Poll Now"}
            </button>
          </div>
          {lastPoll ? (
            <p className="helpText">
              Last poll: {lastPoll.dedupedEvents} deduped events, {lastPoll.alertsCreated} alerts,
              ended at {shortDate(lastPoll.endedAt)}.
            </p>
          ) : null}
        </details>
      </article>

      <article className="panel">
        <h2>Watchlist</h2>
        <ul className="list">
          {artists.map((artist) => (
            <li key={artist.id} className="listItem">
              <div>
                <strong>{artist.name}</strong>
                <p>
                  {formatWatchLocation(artist)}
                  {artist.spotify_id ? ` · Spotify: ${artist.spotify_id}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn--danger"
                onClick={() => void onRemove(artist.id)}
                aria-label={`Remove ${artist.name}`}
              >
                Remove
              </button>
            </li>
          ))}
          {artists.length === 0 ? (
            <li className="emptyState">No followed artists yet.</li>
          ) : null}
        </ul>
      </article>
    </>
  );
}
