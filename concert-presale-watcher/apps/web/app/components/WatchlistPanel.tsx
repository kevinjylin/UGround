import { FormEvent, useId, useState } from "react";
import type { PollResult } from "../../lib/types";
import styles from "../dashboard/dashboard.module.css";

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
};

interface WatchlistPanelProps {
  busy: boolean;
  city: string;
  stateRegion: string;
  country: string;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onAdd: (name: string) => Promise<void>;
  onImportSpotify: (ids: string) => Promise<void>;
  onPoll: (secret: string) => Promise<void>;
  polling: boolean;
  lastPoll: PollResult | null;
}

export default function WatchlistPanel({
  busy,
  city,
  stateRegion,
  country,
  onCityChange,
  onStateChange,
  onCountryChange,
  onAdd,
  onImportSpotify,
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
    <article className={styles.panel}>
      <h2>Follow Artist</h2>

      <fieldset className={styles.fieldsetSection}>
        <legend>Add Artist</legend>
        <form className={styles.stack} onSubmit={handleAddArtist}>
          <label htmlFor={`${uid}-artist`} className="srOnly">
            Artist name
          </label>
          <input
            id={`${uid}-artist`}
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Artist name"
            required
          />
          <div className={styles.inlineInputs}>
            <div>
              <label htmlFor={`${uid}-city`} className="srOnly">
                City
              </label>
              <input
                id={`${uid}-city`}
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                placeholder="City (optional)"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-state`} className="srOnly">
                State
              </label>
              <input
                id={`${uid}-state`}
                value={stateRegion}
                onChange={(e) => onStateChange(e.target.value)}
                placeholder="State"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-country`} className="srOnly">
                Country
              </label>
              <input
                id={`${uid}-country`}
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
                placeholder="Country"
              />
            </div>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={busy}
          >
            Add to Watchlist
          </button>
        </form>
      </fieldset>

      <fieldset className={styles.fieldsetSection}>
        <legend>Spotify Import</legend>
        <form className={styles.stack} onSubmit={handleImport}>
          <label htmlFor={`${uid}-spotify`} className="srOnly">
            Spotify artist IDs
          </label>
          <textarea
            id={`${uid}-spotify`}
            value={spotifyIds}
            onChange={(e) => setSpotifyIds(e.target.value)}
            placeholder="Paste Spotify artist IDs (comma or newline separated)"
            rows={3}
          />
          <button
            className={styles.secondaryButton}
            type="submit"
            disabled={busy}
          >
            Import from Spotify
          </button>
        </form>
      </fieldset>

      <details className={styles.advancedSection}>
        <summary>Advanced</summary>
        <div className={styles.pollBox}>
          <label htmlFor={`${uid}-secret`} className="srOnly">
            Poll secret
          </label>
          <input
            id={`${uid}-secret`}
            value={pollSecret}
            onChange={(e) => setPollSecret(e.target.value)}
            placeholder="Poll secret (only if configured)"
          />
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handlePoll}
            disabled={polling}
          >
            {polling ? "Polling..." : "Run Poll Now"}
          </button>
        </div>
        {lastPoll ? (
          <p className={styles.helpText}>
            Last poll: {lastPoll.dedupedEvents} deduped events,{" "}
            {lastPoll.alertsCreated} alerts, ended at{" "}
            {shortDate(lastPoll.endedAt)}.
          </p>
        ) : null}
      </details>
    </article>
  );
}
