import { z } from "zod";
import { DEFAULT_RADIUS_MILES, marketCenter, milesBetween } from "./locations";
import { normalizeState } from "./state";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

/** A city/state/country with an optional radius. Empty city and state mean anywhere. */
const locationFields = {
  city: optionalText(120),
  state: optionalText(80),
  country: z.string().trim().length(2).default("US"),
  radiusMiles: z.number().int().min(1).max(500).optional(),
};

export const profileSchema = z.object(locationFields);
export const watchArtistUpdateSchema = z.object(locationFields);

export interface ArtistLocation {
  city: string;
  state: string;
  country: string;
  /** Null when there's no city, since a radius needs a center. */
  radiusMiles: number | null;
}

/** Normalize a parsed location the way watch_artists stores it (empty strings, not null). */
export const toArtistLocation = (input: z.infer<typeof watchArtistUpdateSchema>): ArtistLocation => {
  const city = input.city?.trim() ?? "";
  return {
    city,
    state: normalizeState(input.state) ?? "",
    country: input.country.trim().toUpperCase() || "US",
    radiusMiles: city ? (input.radiusMiles ?? DEFAULT_RADIUS_MILES) : null,
  };
};

const same = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export const locationChanged = (
  before: { city: string | null; state: string | null; country: string; radius_miles?: number | null },
  after: ArtistLocation,
): boolean =>
  !same(before.city, after.city) ||
  !same(normalizeState(before.state), after.state) ||
  !same(before.country, after.country) ||
  (before.radius_miles ?? null) !== after.radiusMiles;

/**
 * Whether a saved show clearly falls outside an artist's new location. Shows
 * we can't place (unlisted city, missing fields) are kept, since the next
 * check refreshes them either way.
 */
export const isOutsideLocation = (
  event: { city: string | null; state: string | null; country: string | null },
  location: ArtistLocation,
): boolean => {
  if (event.country && location.country && !same(event.country, location.country)) return true;

  if (location.city) {
    const center = marketCenter(location.city, location.state || null);
    // Unlisted cities are matched by name, the way the Ticketmaster check does it.
    if (!center) return Boolean(event.city) && !same(event.city, location.city);
    if (same(event.city, location.city) && (!event.state || !location.state || same(normalizeState(event.state), location.state))) {
      return false;
    }
    const eventCenter = marketCenter(event.city, event.state);
    if (!eventCenter) return false;
    return milesBetween(center, eventCenter) > (location.radiusMiles ?? DEFAULT_RADIUS_MILES);
  }

  if (location.state) {
    const eventState = normalizeState(event.state);
    return Boolean(eventState) && eventState !== location.state;
  }

  return false;
};
