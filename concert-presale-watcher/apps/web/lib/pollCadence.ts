/**
 * Which sources a poll job can run for, and how often.
 *
 * Kept free of the source adapters on purpose: lib/supabase.ts builds jobs
 * from this, and the adapters import database helpers, so importing them
 * here would make an import cycle. `pollCadence.test.ts` checks this list
 * against the adapters' own `configured()`.
 */
import { env } from "./env";

/** Sources that can check one followed artist, when they have credentials. */
export const runnableArtistSources = (): string[] =>
  [
    env.ticketmasterApiKey ? "ticketmaster" : null,
    env.eventbriteToken && env.eventbritePublicIngestionEnabled ? "eventbrite" : null,
    env.songkickApiKey ? "songkick" : null,
    env.bandsintownAppId ? "bandsintown" : null,
  ].filter((slug): slug is string => Boolean(slug));

/**
 * Ticketmaster allows 5000 calls a day. Each job is about one call per run,
 * so a 12 hour default keeps a few thousand follows inside the quota even
 * with a per-minute dispatcher. Shows with a sale in the next three days get
 * checked every 3 hours so a moved or added presale is caught sooner.
 */
export const DEFAULT_CADENCE_SECONDS = 12 * 3600;
export const SALE_SOON_CADENCE_SECONDS = 3 * 3600;
export const SALE_SOON_WINDOW_MS = 3 * 86400_000;

export const artistCadenceSeconds = (
  saleStarts: Array<string | null | undefined>,
  now = new Date(),
): number => {
  const soon = saleStarts.some((value) => {
    if (!value) return false;
    const start = new Date(value).getTime();
    return start > now.getTime() && start - now.getTime() <= SALE_SOON_WINDOW_MS;
  });
  return soon ? SALE_SOON_CADENCE_SECONDS : DEFAULT_CADENCE_SECONDS;
};
