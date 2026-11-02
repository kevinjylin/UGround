import { logger } from "./logger";
import { getAlertTypes, persistAndDeliverAlert } from "./poller";
import {
  fetchTicketmasterAreaEvents,
  fetchTicketmasterVenueEvents,
  getTicketmasterVenue,
  pickVenueMatch,
  searchTicketmasterVenues,
} from "./sources/ticketmaster";
import {
  createSnapshots,
  getVenueById,
  getWatchRuleById,
  listEventsBySourceIds,
  listVenueWatchRules,
  markRuleBaselined,
  recordSourceHealth,
  saveVenueTicketmasterRef,
  upsertRuleEvents,
} from "./supabase";
import type { AlertType, DiscoveredEvent, EventRecord, PollJob, VenueSuggestion, WatchRule } from "./types";
import { hashJson } from "./utils";

export type RuleJobOutcome =
  /** The check ran. */
  | { kind: "done"; saved: number; alerts: number }
  /** Nothing follows this target any more, so its job can go. */
  | { kind: "gone"; reason: string }
  /** The target can't be checked yet (for example, no matching venue). */
  | { kind: "unresolved"; reason: string };

/**
 * Find the Ticketmaster venue a rule means: by id when the user picked one
 * from search, otherwise by the best name match.
 */
export const resolveTicketmasterVenue = async (input: {
  venueId?: string | null;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<VenueSuggestion | null> => {
  if (input.venueId) return getTicketmasterVenue(input.venueId);
  const candidates = await searchTicketmasterVenues(input.name, {
    stateCode: input.state,
    countryCode: input.country,
  });
  return pickVenueMatch(input.name, input.city, candidates);
};

const withSourceHealth = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    const result = await run();
    await recordSourceHealth("ticketmaster", { success: true });
    return result;
  } catch (error) {
    await recordSourceHealth("ticketmaster", { success: false, error: (error as Error).message });
    throw error;
  }
};

/** Fields whose change is worth saving even when it isn't worth an alert. */
const differs = (previous: EventRecord, next: DiscoveredEvent): boolean =>
  previous.title !== next.title ||
  previous.venue !== next.venue ||
  previous.artist_name !== next.artist_name ||
  (previous.start_time ? new Date(previous.start_time).getTime() : null) !==
    (next.start_time ? new Date(next.start_time).getTime() : null);

/**
 * Save one rule's search results for its user and alert on what changed.
 *
 * Unchanged rows aren't rewritten, so a big area doesn't push every show to
 * the top of the feed on each check. Rows an artist watch already tracks are
 * left to that watch. The rule's first run saves without alerting.
 */
export const applyRuleEvents = async (
  rule: WatchRule,
  discovered: DiscoveredEvent[],
): Promise<{ saved: number; alerts: number }> => {
  const unique = [...new Map(discovered.map((event) => [event.source_event_id, event])).values()];
  const existing = await listEventsBySourceIds(
    rule.user_id,
    "ticketmaster",
    unique.map((event) => event.source_event_id),
  );
  const previousById = new Map(existing.map((event) => [event.source_event_id, event]));

  const changes: Array<{ event: DiscoveredEvent; previous: EventRecord | null; alertTypes: AlertType[] }> = [];
  for (const event of unique) {
    const previous = previousById.get(event.source_event_id) ?? null;
    if (previous?.watch_artist_id) continue;
    const alertTypes = getAlertTypes(previous, event);
    if (previous && alertTypes.length === 0 && !differs(previous, event)) continue;
    changes.push({ event, previous, alertTypes });
  }

  const saved = await upsertRuleEvents(
    changes.map(({ event, previous }) => ({
      ...event,
      user_id: rule.user_id,
      // Keep the first rule that found a show as its owner.
      watch_rule_id: previous?.watch_rule_id ?? rule.id,
    })),
  );
  const savedById = new Map(saved.map((event) => [event.source_event_id, event]));

  await createSnapshots(
    changes.flatMap(({ event }) => {
      const savedEvent = savedById.get(event.source_event_id);
      return savedEvent
        ? [{ eventId: savedEvent.id, rawJsonHash: hashJson(event.raw_json), rawJson: event.raw_json }]
        : [];
    }),
  );

  let alerts = 0;
  if (rule.baseline_at) {
    for (const { event, previous, alertTypes } of changes) {
      const savedEvent = savedById.get(event.source_event_id);
      if (!savedEvent) continue;
      for (const alertType of alertTypes) {
        if (await persistAndDeliverAlert(alertType, previous, savedEvent)) alerts += 1;
      }
    }
  } else {
    await markRuleBaselined(rule.id);
  }

  return { saved: saved.length, alerts };
};

/** Check one area rule. The job's target is the rule itself. */
export const runLocationJob = async (job: PollJob): Promise<RuleJobOutcome> => {
  const rule = await getWatchRuleById(job.target_id);
  if (!rule || rule.kind !== "location") {
    return { kind: "gone", reason: "The area is no longer followed." };
  }
  if (rule.latitude === null || rule.longitude === null || !rule.radius_miles) {
    return { kind: "unresolved", reason: "The area has no center point or radius." };
  }

  const events = await withSourceHealth(() =>
    fetchTicketmasterAreaEvents({
      latitude: rule.latitude as number,
      longitude: rule.longitude as number,
      radiusMiles: rule.radius_miles as number,
    }),
  );
  return { kind: "done", ...(await applyRuleEvents(rule, events)) };
};

/**
 * Check one venue for everyone who follows it. The venue is fetched once and
 * the results are saved for each follower.
 */
export const runVenueJob = async (job: PollJob): Promise<RuleJobOutcome> => {
  const rules = await listVenueWatchRules(job.target_id);
  if (rules.length === 0) return { kind: "gone", reason: "Nobody follows this venue." };

  const venue = await getVenueById(job.target_id);
  if (!venue) return { kind: "gone", reason: "The venue no longer exists." };

  // Venues followed before venue search existed only have a typed name.
  let ticketmasterId = venue.source_refs?.ticketmaster ?? null;
  if (!ticketmasterId) {
    const match = await withSourceHealth(() =>
      resolveTicketmasterVenue({
        name: venue.name,
        city: venue.city,
        state: venue.state,
        country: venue.country,
      }),
    );
    if (!match) {
      return { kind: "unresolved", reason: `Couldn't find "${venue.name}" on Ticketmaster.` };
    }
    await saveVenueTicketmasterRef(venue, match);
    ticketmasterId = match.id;
  }

  const venueId = ticketmasterId;
  const events = await withSourceHealth(() => fetchTicketmasterVenueEvents(venueId));

  let saved = 0;
  let alerts = 0;
  const errors: string[] = [];
  // One follower's failure shouldn't stop the others from getting updates.
  for (const rule of rules) {
    try {
      const result = await applyRuleEvents(rule, events);
      saved += result.saved;
      alerts += result.alerts;
    } catch (error) {
      logger.error(`[poll] venue ${venue.name} failed for rule ${rule.id}`, error);
      errors.push((error as Error).message);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
  return { kind: "done", saved, alerts };
};
