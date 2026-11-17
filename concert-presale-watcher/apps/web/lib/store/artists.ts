import { supabaseRequest } from "../supabase";

/**
 * Remember which Ticketmaster attraction an artist watch resolved to, or that
 * none matched (`attractionId` null). Either way the lookup time is saved so
 * an unmatched artist isn't searched again on every poll.
 */
export const saveArtistAttraction = async (
  artistId: string,
  attractionId: string | null,
  checkedAt = new Date(),
): Promise<void> => {
  await supabaseRequest<void>(`/watch_artists?id=eq.${encodeURIComponent(artistId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ticketmaster_attraction_id: attractionId,
      ticketmaster_attraction_checked_at: checkedAt.toISOString(),
    }),
  });
};
