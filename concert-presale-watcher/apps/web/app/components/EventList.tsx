"use client";

import { useState } from "react";
import { alertTypeLabel, channelLabel } from "../../lib/alertFormat";
import { relativeTime, shortDate } from "../../lib/format";
import type {
  AlertRecord,
  AlertType,
  EventRecord,
  EventStatus,
} from "../../lib/types";
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

const alertTypeBadgeClass: Record<AlertType, string | undefined> = {
  new_event: styles.alertBadgeNew,
  status_changed: styles.alertBadgeStatus,
  ticket_url_changed: styles.alertBadgeTicket,
  on_sale_moved_earlier: styles.alertBadgeUrgent,
};

const eventLocation = (event: EventRecord): string => {
  const cityRegion = [event.city, event.state].filter(Boolean).join(", ");

  return [
    event.venue ?? "Unknown venue",
    cityRegion || null,
    shortDate(event.start_time),
    sourceLabel[event.source_slug],
  ]
    .filter(Boolean)
    .join(" · ");
};

interface EventCardProps {
  event: EventRecord;
  alerts: AlertRecord[];
  expanded: boolean;
  onToggleExpanded: () => void;
}

function EventCard({
  event,
  alerts,
  expanded,
  onToggleExpanded,
}: EventCardProps) {
  const latestAlert = alerts[0];
  const updateCount = alerts.length;

  return (
    <li className={styles.eventCard}>
      <div className={styles.eventCardMain}>
        <div className={styles.eventCardTop}>
          <strong className={styles.eventArtist}>{event.artist_name}</strong>
          <span
            className={cx(styles.statusBadge, statusBadgeClass[event.status])}
          >
            {statusLabel[event.status]}
          </span>
        </div>

        <p className={styles.eventTitle}>{event.title}</p>
        <p className={styles.eventMeta}>{eventLocation(event)}</p>

        <div className={styles.activityLine}>
          {latestAlert ? (
            <>
              <span
                className={cx(
                  styles.alertBadge,
                  alertTypeBadgeClass[latestAlert.alert_type],
                )}
              >
                {alertTypeLabel[latestAlert.alert_type]}
              </span>
              <span className={styles.activityMessage}>
                {latestAlert.message}
              </span>
              <span className={styles.alertTime}>
                {relativeTime(latestAlert.created_at)}
              </span>
            </>
          ) : (
            <>
              <span className={styles.activityMuted}>No alert activity yet</span>
              <span className={styles.alertTime}>
                Last seen {relativeTime(event.last_seen_at)}
              </span>
            </>
          )}
        </div>

        {updateCount > 1 ? (
          <button
            type="button"
            className={styles.timelineToggle}
            onClick={onToggleExpanded}
            aria-expanded={expanded}
          >
            {expanded ? "Hide updates" : `${updateCount} updates`}
          </button>
        ) : null}

        {expanded ? (
          <ol className={styles.alertTimeline}>
            {alerts.map((alert) => (
              <li key={alert.id} className={styles.timelineItem}>
                <div className={styles.timelineItemTop}>
                  <span
                    className={cx(
                      styles.alertBadge,
                      alertTypeBadgeClass[alert.alert_type],
                    )}
                  >
                    {alertTypeLabel[alert.alert_type]}
                  </span>
                  <span className={styles.alertTime}>
                    {relativeTime(alert.created_at)}
                  </span>
                </div>
                <p>{alert.message}</p>
                <div className={styles.channelChips}>
                  {alert.sent_channels.length > 0 ? (
                    alert.sent_channels.map((channel) => (
                      <span
                        key={channel}
                        className={cx(
                          styles.channelChip,
                          styles.channelChipSent,
                        )}
                      >
                        {channelLabel[channel] ?? channel}
                      </span>
                    ))
                  ) : (
                    <span
                      className={cx(
                        styles.channelChip,
                        styles.channelChipStored,
                      )}
                    >
                      stored only
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {event.ticket_url ? (
        <a
          href={event.ticket_url}
          target="_blank"
          rel="noreferrer"
          className={styles.ticketLink}
          aria-label={`Tickets for ${event.title} (opens in new tab)`}
        >
          Tickets -&gt;
        </a>
      ) : null}
    </li>
  );
}

interface EventListProps {
  events: EventRecord[];
  alertsByEventId: Map<string, AlertRecord[]>;
  totalEvents?: number;
  loading?: boolean;
}

export default function EventList({
  events,
  alertsByEventId,
  totalEvents,
  loading,
}: EventListProps) {
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    () => new Set(),
  );
  const hasAnyEvents = (totalEvents ?? events.length) > 0;

  const toggleExpanded = (eventId: string) => {
    setExpandedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  return (
    <article className={`${styles.panel} ${styles.eventPanel}`}>
      <div className={styles.feedHeader}>
        <h2>Event Feed</h2>
        {!loading ? <span>{events.length} shown</span> : null}
      </div>
      <ul className={styles.list}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className={`${styles.eventCard} ${styles.skeleton} ${styles.skeletonRow}`}
                aria-hidden="true"
              />
            ))
          : events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                alerts={alertsByEventId.get(event.id) ?? []}
                expanded={expandedEventIds.has(event.id)}
                onToggleExpanded={() => toggleExpanded(event.id)}
              />
            ))}
        {!loading && events.length === 0 ? (
          <li className={styles.emptyState}>
            <span className={styles.emptyStateTitle}>
              {hasAnyEvents
                ? "No events match this view"
                : "No events tracked yet"}
            </span>
            <span className={styles.emptyStateHint}>
              {hasAnyEvents
                ? "Change the filter or run a refresh to check for new presales."
                : "Run a refresh to start tracking presales for your followed artists."}
            </span>
          </li>
        ) : null}
      </ul>
    </article>
  );
}
