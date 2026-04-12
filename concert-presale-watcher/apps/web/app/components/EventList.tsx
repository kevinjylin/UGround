import type { EventRecord } from "../../lib/types";

const sourceLabel: Record<EventRecord["source_slug"], string> = {
  ticketmaster: "Ticketmaster",
  eventbrite: "Eventbrite",
  manual: "Manual",
};

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
};

interface EventListProps {
  events: EventRecord[];
  loading?: boolean;
}

export default function EventList({ events, loading }: EventListProps) {
  return (
    <article className="panel">
      <h2>Events</h2>
      <ul className="list">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="listItem skeleton skeleton--row" aria-hidden="true" />
            ))
          : events.map((event) => (
              <li key={event.id} className="listItem">
                <div>
                  <strong>{event.artist_name}</strong>
                  <p>
                    {event.title} · {event.venue ?? "Unknown venue"}
                  </p>
                  <p>
                    {event.city ?? "Unknown city"} · {shortDate(event.start_time)} ·{" "}
                    {sourceLabel[event.source_slug]} · {event.status}
                  </p>
                </div>
                <a
                  href={event.ticket_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Tickets for ${event.title} (opens in new tab)`}
                >
                  Ticket
                </a>
              </li>
            ))}
        {!loading && events.length === 0 ? (
          <li className="emptyState">No events tracked yet.</li>
        ) : null}
      </ul>
    </article>
  );
}
