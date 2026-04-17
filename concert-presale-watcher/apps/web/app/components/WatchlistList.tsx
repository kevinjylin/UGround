import type { WatchArtist } from "../../lib/types";

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

export default function WatchlistList({ artists, onRemove, loading }: WatchlistListProps) {
  return (
    <ul className="list watchlistGrid">
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="listItem skeleton skeleton--row" aria-hidden="true" />
          ))
        : artists.map((artist) => (
            <li key={artist.id} className="listItem">
              <div>
                <strong>{artist.name}</strong>
                <p>{formatWatchLocation(artist)}</p>
                {artist.spotify_id ? (
                  <p className="spotifyId">Spotify · {artist.spotify_id}</p>
                ) : null}
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
      {!loading && artists.length === 0 ? (
        <li className="emptyState">
          No artists followed yet. Add artists using the form above.
        </li>
      ) : null}
    </ul>
  );
}
