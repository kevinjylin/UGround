import type { EventRecord, EventStatus } from "../../lib/types";
import styles from "../dashboard/dashboard.module.css";

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

const cx = (...classes: Array<string | undefined>): string =>
  classes.filter(Boolean).join(" ");

const statusBadgeClass: Record<EventStatus, string | undefined> = {
  onsale: styles.statusBadgeOnsale,
  offsale: "",
  cancelled: styles.statusBadgeCancelled,
  postponed: styles.statusBadgePostponed,
  rescheduled: styles.statusBadgeRescheduled,
  scheduled: "",
  unknown: "",
};

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown date";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface EventListProps {
  events: EventRecord[];
  loading?: boolean;
}

export default function EventList({ events, loading }: EventListProps) {
  return (
    <article className={`${styles.panel} ${styles.eventPanel}`}>
      <h2>Events</h2>
      <ul className={styles.list}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className={`${styles.listItem} ${styles.skeleton} ${styles.skeletonRow}`}
                aria-hidden="true"
              />
            ))
          : events.map((event) => (
              <li
                key={event.id}
                className={`${styles.listItem} ${styles.eventItem}`}
              >
                <div className={styles.eventItemBody}>
                  <div className={styles.eventItemTop}>
                    <strong className={styles.eventArtist}>
                      {event.artist_name}
                    </strong>
                    <span
                      className={cx(
                        styles.statusBadge,
                        statusBadgeClass[event.status],
                      )}
                    >
                      {statusLabel[event.status]}
                    </span>
                  </div>
                  <p className={styles.eventTitle}>{event.title}</p>
                  <p className={styles.eventMeta}>
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
                    className={styles.ticketLink}
                    aria-label={`Tickets for ${event.title} (opens in new tab)`}
                  >
                    Tickets →
                  </a>
                ) : null}
              </li>
            ))}
        {!loading && events.length === 0 ? (
          <li className={styles.emptyState}>
            <span className={styles.emptyStateTitle}>
              No events tracked yet
            </span>
            <span className={styles.emptyStateHint}>
              Run a poll to start tracking presales for your followed artists.
            </span>
          </li>
        ) : null}
      </ul>
    </article>
  );
}
