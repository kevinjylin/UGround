/** Shared by the Spotify connect routes and the watchlist panel. Safe to import in the browser. */

/** Result codes passed back to the dashboard as `?spotify=<code>`. */
export type SpotifyConnectResult =
  | "connected"
  | "denied"
  | "expired"
  | "state"
  | "unavailable"
  | "forbidden"
  | "error";

/** Messages for each result code, shown in the watchlist panel. */
export const SPOTIFY_RESULT_MESSAGES: Record<Exclude<SpotifyConnectResult, "connected">, string> = {
  denied: "Spotify access wasn't granted, so nothing was imported.",
  expired: "The Spotify connection expired. Connect again to pick artists.",
  state: "That Spotify sign-in couldn't be verified. Connect again from this page.",
  unavailable: "Spotify import isn't set up on this site yet.",
  forbidden:
    "Spotify didn't allow access for this account. While the app is in Spotify's development mode, only accounts the site owner has added can connect.",
  error: "Spotify didn't finish connecting. Try again in a minute.",
};

export const isSpotifyConnectResult = (value: string | null): value is SpotifyConnectResult =>
  value !== null && (value === "connected" || Object.hasOwn(SPOTIFY_RESULT_MESSAGES, value));
