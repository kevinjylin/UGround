import { deliverAlert } from "./alerts";
import { env } from "./env";
import {
  createAlert,
  createSnapshot,
  getEventBySourceId,
  getLatestSnapshot,
  listWatchArtists,
  upsertEvent,
} from "./supabase";
import { fetchEventbriteEvents } from "./sources/eventbrite";
import { fetchTicketmasterEvents } from "./sources/ticketmaster";
import type { AlertType, EventRecord, NormalizedEvent, PollResult } from "./types";
import { dedupeEvents, hashJson, movedEarlier } from "./utils";

const buildAlertMessage = (alertType: AlertType, previous: EventRecord | null, next: EventRecord): string => {
  if (alertType === "new_event") {
    return `New event found: ${next.artist_name} at ${next.venue ?? "Unknown venue"}`;
  }

  if (alertType === "status_changed") {
    return `Status changed from ${previous?.status ?? "unknown"} to ${next.status}`;
  }

  if (alertType === "ticket_url_changed") {
    return "Ticket URL changed";
  }

  return `On-sale moved earlier (${previous?.on_sale_start ?? "unknown"} -> ${next.on_sale_start ?? "unknown"})`;
};

const getAlertTypes = (previous: EventRecord | null, next: NormalizedEvent): AlertType[] => {
  if (!previous) {
    return ["new_event"];
  }

  const alerts: AlertType[] = [];

  if (next.status !== previous.status) {
    alerts.push("status_changed");
  }

  if (next.ticket_url && next.ticket_url !== previous.ticket_url) {
    alerts.push("ticket_url_changed");
  }

  if (movedEarlier(previous.on_sale_start, next.on_sale_start)) {
    alerts.push("on_sale_moved_earlier");
  }

  return alerts;
};

const fetchAllSourcesForArtist = async (artistId: string): Promise<NormalizedEvent[]> => {
  const artists = await listWatchArtists();
  const artist = artists.find((item) => item.id === artistId);

  if (!artist) {
    return [];
  }

  const [ticketmasterEvents, eventbriteEvents] = await Promise.all([
    fetchTicketmasterEvents(artist),
    fetchEventbriteEvents(artist),
  ]);

  return [...ticketmasterEvents, ...eventbriteEvents];
};

const fetchAllEvents = async (city?: string): Promise<NormalizedEvent[]> => {
  const artists = await listWatchArtists();
  const events: NormalizedEvent[] = [];

  for (const artist of artists) {
    if (city && artist.city && artist.city.toLowerCase() !== city.toLowerCase()) {
      continue;
    }

    const [ticketmasterEvents, eventbriteEvents] = await Promise.all([
      fetchTicketmasterEvents(artist),
      fetchEventbriteEvents(artist),
    ]);

    events.push(...ticketmasterEvents, ...eventbriteEvents);
  }

  return events;
};

export const runPollCycle = async (city?: string): Promise<PollResult> => {
  const startedAt = new Date().toISOString();
  const artists = await listWatchArtists();

  if (artists.length === 0) {
    return {
      checkedArtists: 0,
      fetchedEvents: 0,
      dedupedEvents: 0,
      newEvents: 0,
      changedEvents: 0,
      alertsCreated: 0,
      startedAt,
      endedAt: new Date().toISOString(),
    };
  }

  const fetchedEvents = await fetchAllEvents(city ?? env.defaultCity);
  const deduped = dedupeEvents(fetchedEvents);

  let newEvents = 0;
  let changedEvents = 0;
  let alertsCreated = 0;

  for (const normalized of deduped) {
    const existing = await getEventBySourceId(normalized.source_slug, normalized.source_event_id);
    const alertTypes = getAlertTypes(existing, normalized);

    const savedEvent = await upsertEvent(normalized);
    const rawHash = hashJson(normalized.raw_json);
    const latestSnapshot = await getLatestSnapshot(savedEvent.id);

    if (!latestSnapshot || latestSnapshot.raw_json_hash !== rawHash) {
      await createSnapshot(savedEvent.id, rawHash, normalized.raw_json);
    }

    if (!existing) {
      newEvents += 1;
    } else if (alertTypes.length > 0) {
      changedEvents += 1;
    }

    for (const alertType of alertTypes) {
      const message = buildAlertMessage(alertType, existing, savedEvent);
      const delivery = await deliverAlert(alertType, savedEvent);

      await createAlert({
        eventId: savedEvent.id,
        alertType,
        message,
        payload: {
          source: savedEvent.source_slug,
          source_event_id: savedEvent.source_event_id,
          delivery_errors: delivery.errors,
        },
        sentChannels: delivery.channels,
        sentAt: new Date().toISOString(),
      });

      alertsCreated += 1;
    }
  }

  return {
    checkedArtists: artists.length,
    fetchedEvents: fetchedEvents.length,
    dedupedEvents: deduped.length,
    newEvents,
    changedEvents,
    alertsCreated,
    startedAt,
    endedAt: new Date().toISOString(),
  };
};

export const runPollForArtist = async (artistId: string): Promise<PollResult> => {
  const startedAt = new Date().toISOString();
  const events = dedupeEvents(await fetchAllSourcesForArtist(artistId));

  let alertsCreated = 0;

  for (const normalized of events) {
    const existing = await getEventBySourceId(normalized.source_slug, normalized.source_event_id);
    const alertTypes = getAlertTypes(existing, normalized);

    const savedEvent = await upsertEvent(normalized);
    const latestSnapshot = await getLatestSnapshot(savedEvent.id);
    const rawHash = hashJson(normalized.raw_json);

    if (!latestSnapshot || latestSnapshot.raw_json_hash !== rawHash) {
      await createSnapshot(savedEvent.id, rawHash, normalized.raw_json);
    }

    for (const alertType of alertTypes) {
      const message = buildAlertMessage(alertType, existing, savedEvent);
      const delivery = await deliverAlert(alertType, savedEvent);

      await createAlert({
        eventId: savedEvent.id,
        alertType,
        message,
        payload: {
          source: savedEvent.source_slug,
          source_event_id: savedEvent.source_event_id,
          delivery_errors: delivery.errors,
        },
        sentChannels: delivery.channels,
        sentAt: new Date().toISOString(),
      });

      alertsCreated += 1;
    }
  }

  return {
    checkedArtists: 1,
    fetchedEvents: events.length,
    dedupedEvents: events.length,
    newEvents: 0,
    changedEvents: 0,
    alertsCreated,
    startedAt,
    endedAt: new Date().toISOString(),
  };
};
