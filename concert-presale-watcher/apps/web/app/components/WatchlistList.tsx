import type { WatchArtist } from "../../lib/types";
import styles from "../dashboard/dashboard.module.css";

const formatWatchLocation = (artist: WatchArtist): string => {
  const city = artist.city?.trim() || "";
  const state = artist.state?.trim() || "";
  const country = artist.country?.trim() || "US";

  if (city && state) return `${city}, ${state}, ${country}`;
  if (city) return `${city}, ${country}`;
  if (state) return `Any city in ${state}, ${country}`;
  return `Any city, ${country}`;
};

interface WatchlistListProps {
  artists: WatchArtist[];
  onRemove: (id: string) => Promise<void>;
  loading?: boolean;
}

export default function WatchlistList({
  artists,
  onRemove,
  loading,
}: WatchlistListProps) {
  return (
    <ul className={`${styles.list} ${styles.watchlistGrid}`}>
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className={`${styles.listItem} ${styles.skeleton} ${styles.skeletonRow}`}
              aria-hidden="true"
            />
          ))
        : artists.map((artist) => (
            <li key={artist.id} className={styles.listItem}>
              <div>
                <strong>{artist.name}</strong>
                <p>{formatWatchLocation(artist)}</p>
                {artist.spotify_id ? (
                  <p className={styles.spotifyId}>
                    Spotify · {artist.spotify_id}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void onRemove(artist.id)}
                aria-label={`Remove ${artist.name}`}
              >
                Remove
              </button>
            </li>
          ))}
      {!loading && artists.length === 0 ? (
        <li className={styles.emptyState}>
          <span className={styles.emptyStateTitle}>No artists followed yet</span>
          <span className={styles.emptyStateHint}>Add artists using the form above.</span>
        </li>
      ) : null}
    </ul>
  );
}
