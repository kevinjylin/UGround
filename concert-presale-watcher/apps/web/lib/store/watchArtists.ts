import { enqueuePollJobsForRule, supabaseRequest } from "../supabase";
import type { WatchArtist, WatchRule } from "../types";
import { type ArtistLocation, isOutsideLocation, locationChanged } from "../watchlistLocation";

export class WatchArtistConflictError extends Error {
  constructor(name: string) {
    super(`You already follow ${name} with that location.`);
  }
}

const DELETE_CHUNK = 100;

/**
 * Change where an artist is watched. Keeps the watch_artists row and its
 * mirrored watch_rules row in step, removes saved shows that clearly fall
 * outside the new location, and queues the artist to be checked again.
 * Returns null when the artist doesn't exist or isn't the user's.
 */
export const updateWatchArtistLocation = async (
  id: string,
  userId: string,
  location: ArtistLocation,
): Promise<WatchArtist | null> => {
  const encodedId = encodeURIComponent(id);
  const encodedUser = encodeURIComponent(userId);
  const [before] = await supabaseRequest<WatchArtist[]>(
    `/watch_artists?select=*&id=eq.${encodedId}&user_id=eq.${encodedUser}&limit=1`,
  );
  if (!before) return null;
  if (!locationChanged(before, location)) return before;

  let saved: WatchArtist | undefined;
  try {
    [saved] = await supabaseRequest<WatchArtist[]>(
      `/watch_artists?select=*&id=eq.${encodedId}&user_id=eq.${encodedUser}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          city: location.city,
          state: location.state,
          country: location.country,
          radius_miles: location.radiusMiles,
          updated_at: new Date().toISOString(),
        }),
      },
    );
  } catch (error) {
    // The (user_id, name, city, country) unique index: the same artist is
    // already followed at that location.
    if (error instanceof Error && error.message.includes("(409)")) {
      throw new WatchArtistConflictError(before.name);
    }
    throw error;
  }
  if (!saved) return null;

  const [rule] = await supabaseRequest<WatchRule[]>(
    `/watch_rules?select=*&legacy_watch_artist_id=eq.${encodedId}&user_id=eq.${encodedUser}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        city: saved.city || null,
        state: saved.state || null,
        country: saved.country,
        radius_miles: saved.radius_miles ?? null,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  const events = await supabaseRequest<
    Array<{ id: string; city: string | null; state: string | null; country: string | null }>
  >(`/events?select=id,city,state,country&user_id=eq.${encodedUser}&watch_artist_id=eq.${encodedId}`);
  const outside = events.filter((event) => isOutsideLocation(event, location)).map((event) => event.id);
  for (let index = 0; index < outside.length; index += DELETE_CHUNK) {
    const ids = outside.slice(index, index + DELETE_CHUNK).map(encodeURIComponent).join(",");
    await supabaseRequest<void>(`/events?user_id=eq.${encodedUser}&id=in.(${ids})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  if (rule) await enqueuePollJobsForRule(rule, userId);
  return saved;
};
