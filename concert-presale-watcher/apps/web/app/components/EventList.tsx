import type { EventRecord, EventStatus } from "../../lib/types";

const sourceLabel: Record<EventRecord["source_slug"], string> = {
  ticketmaster: "Ticketmaster",
  eventbrite: "Eventbrite",
  manual: "Manual",
};

const statusLabel: Record<EventStatus, string> = {
  onsale: "On Sale",
  offsale: "Off Sale",
  cancelled: "Cancelled",
  postponed: "Postponed",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
  unknown: "Unknown",
};

const statusBadgeClass: Record<EventStatus, string> = {
  onsale: "statusBadge--onsale",
  offsale: "statusBadge--offsale",
  cancelled: "statusBadge--cancelled",
  postponed: "statusBadge--postponed",
  rescheduled: "statusBadge--rescheduled",
  scheduled: "statusBadge--scheduled",
  unknown: "statusBadge--unknown",
};

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown date";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

interface EventListProps {
  events: EventRecord[];
  loading?: boolean;
}

export default function EventList({ events, loading }: EventListProps) {
  return (
    <article className="panel eventPanel">
      <h2>Events</h2>
      <ul className="list">
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="listItem skeleton skeleton--row" aria-hidden="true" />
            ))
          : events.map((event) => (
              <li key={event.id} className="listItem eventItem">
                <div className="eventItemBody">
                  <div className="eventItemTop">
                    <strong className="eventArtist">{event.artist_name}</strong>
                    <span className={`statusBadge ${statusBadgeClass[event.status]}`}>
                      {statusLabel[event.status]}
                    </span>
                  </div>
                  <p className="eventTitle">{event.title}</p>
                  <p className="eventMeta">
                    {[
                      event.venue ?? "Unknown venue",
                      event.city ?? null,
                      shortDate(event.start_time),
                      sourceLabel[event.source_slug],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {event.ticket_url ? (
                  <a
                    href={event.ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ticketLink"
                    aria-label={`Tickets for ${event.title} (opens in new tab)`}
                  >
                    Tickets →
                  </a>
                ) : null}
              </li>
            ))}
        {!loading && events.length === 0 ? (
          <li className="emptyState">
            <span className="emptyStateTitle">No events tracked yet</span>
            <span className="emptyStateHint">Run a poll to start tracking presales for your followed artists.</span>
          </li>
        ) : null}
      </ul>
    </article>
  );
}
