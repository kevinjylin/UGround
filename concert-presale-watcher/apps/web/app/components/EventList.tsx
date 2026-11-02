"use client";

import { useState } from "react";
import { ArrowUpRight, Bell, ChevronDown, ListMusic, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StageScene } from "@/components/stage-scene";
import { Dot, StatusDot } from "@/components/status-dot";
import { channelLabel } from "@/lib/alertFormat";
import { cn } from "@/lib/cn";
import {
  alertSummary,
  alertTone,
  dateParts,
  placeLine,
  saleTime,
  statusLabel,
  statusTone,
} from "@/lib/eventDisplay";
import { relativeTime } from "@/lib/format";
import type { AlertRecord, EventRecord } from "@/lib/types";

/** Show the listing title only when it adds something beyond artist and venue. */
const extraTitle = (event: EventRecord): string | null => {
  const title = event.title?.trim();
  if (!title) return null;
  const lower = title.toLowerCase();
  if (lower.includes(event.artist_name.toLowerCase())) return null;
  if (event.venue && lower.includes(event.venue.toLowerCase())) return null;
  return title;
};

function EventDate({ value }: { value: string | null }) {
  const parts = dateParts(value);
  if (!parts) {
    return (
      <div className="flex flex-col items-center py-4 text-xs text-muted-foreground">TBA</div>
    );
  }
  return (
    <time dateTime={value ?? undefined} className="flex flex-col items-center py-4 text-center">
      <span className="text-xs leading-4 text-muted-foreground">
        {parts.month}
        {parts.showYear ? ` ’${String(parts.year).slice(2)}` : ""}
      </span>
      <span className="tabular font-display text-[28px] leading-8">{parts.day}</span>
      <span className="text-xs leading-4 text-faint">{parts.weekday}</span>
    </time>
  );
}

interface EventRowProps {
  event: EventRecord;
  alerts: AlertRecord[];
  /** The venue or area watch that found this show, when it wasn't an artist watch. */
  foundBy?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}

function EventRow({ event, alerts, foundBy, expanded, onToggleExpanded }: EventRowProps) {
  const latestAlert = alerts[0];
  const title = extraTitle(event);
  const timelineId = `timeline-${event.id}`;
  const windows = event.sale_windows ?? [];

  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)_auto]">
      <EventDate value={event.start_time} />

      {/* The perforation: the row's date tears off like a ticket stub. */}
      <div className="min-w-0 border-l border-dashed py-4 pr-4 pl-4 sm:pl-5">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] leading-5 font-medium">{event.artist_name}</span>
          {title ? (
            <span className="hidden truncate text-[13px] text-muted-foreground md:inline">{title}</span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">
          {placeLine(event) || "Venue to be announced"}
          {/* A venue watch's name is already the venue on the line, so only say it otherwise. */}
          {foundBy && foundBy.toLowerCase() !== event.venue?.toLowerCase() ? (
            <span className="text-faint"> · via {foundBy}</span>
          ) : null}
        </p>

        {windows.length > 0 ? (
          <ul aria-label="Sale windows" className="mt-3 grid max-w-sm gap-1 font-mono text-xs">
            {windows.map((window, index) => {
              const label =
                window.kind === "presale" ? window.name || "Presale" : "General on-sale";
              const content = (
                <>
                  <span className="truncate text-faint">{label}</span>
                  <span className="shrink-0 text-muted-foreground">{saleTime(window.starts_at)}</span>
                </>
              );
              return (
                <li key={`${window.kind}-${window.name}-${index}`}>
                  {window.url ? (
                    <a
                      href={window.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex justify-between gap-4 rounded-sm underline-offset-4 hover:underline"
                    >
                      {content}
                    </a>
                  ) : (
                    <span className="flex justify-between gap-4">{content}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
          {latestAlert ? (
            <>
              <Dot tone={alertTone[latestAlert.alert_type]} />
              <span>{alertSummary(latestAlert, event)}</span>
              <span className="font-mono text-xs text-faint">
                {relativeTime(latestAlert.created_at)}
              </span>
            </>
          ) : (
            <span className="font-mono text-xs text-faint">
              Last seen {relativeTime(event.last_seen_at)}
            </span>
          )}
          {alerts.length > 1 ? (
            <Button
              variant="ghost"
              size="xs"
              className="ml-1 text-muted-foreground"
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              aria-controls={timelineId}
            >
              {expanded ? "Hide history" : `${alerts.length} updates`}
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform duration-150", expanded && "rotate-180")}
              />
            </Button>
          ) : null}
        </div>

        {expanded ? (
          <ol id={timelineId} className="mt-3 grid gap-2 border-t border-dashed pt-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-2.5 text-[13px] leading-5">
                <Dot tone={alertTone[alert.alert_type]} className="mt-[7px]" />
                <span className="min-w-0">
                  <span>{alertSummary(alert, event)}</span>
                  <span className="block font-mono text-xs text-faint">
                    {relativeTime(alert.created_at)} ·{" "}
                    {alert.sent_channels.length > 0
                      ? `Sent by ${alert.sent_channels
                          .map((channel) => channelLabel[channel] ?? channel)
                          .join(", ")}`
                      : "Not sent, no channel on"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="col-start-2 flex items-center justify-between gap-3 border-l border-dashed px-4 pb-4 sm:col-start-auto sm:flex-col sm:items-end sm:justify-start sm:border-l-0 sm:py-4 sm:pr-5 sm:pl-0">
        <StatusDot tone={statusTone[event.status]}>{statusLabel[event.status]}</StatusDot>
        {event.ticket_url ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Tickets for ${event.artist_name}${event.venue ? ` at ${event.venue}` : ""} (opens in new tab)`}
            >
              Tickets
              <ArrowUpRight aria-hidden="true" className="text-muted-foreground" />
            </a>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li aria-hidden="true" className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)_auto]">
      <div className="flex flex-col items-center gap-1.5 py-4">
        <Skeleton className="h-3 w-7" />
        <Skeleton className="h-5 w-6" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="grid content-start gap-2 border-l border-dashed py-4 pl-4 sm:pl-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-56" />
        <Skeleton className="mt-2 h-3.5 w-32" />
      </div>
      <div className="hidden py-4 pr-5 sm:block">
        <Skeleton className="h-4 w-20" />
      </div>
    </li>
  );
}

const ONBOARDING_STEPS = [
  {
    icon: ListMusic,
    title: "Add artists",
    body: "Search by name, or import from a public Spotify playlist.",
  },
  {
    icon: RefreshCw,
    title: "Wait for the first check",
    body: "Sources are checked once a day. Shows for your artists appear here after the next run.",
  },
  {
    icon: Bell,
    title: "Turn on alerts",
    body: "Email, Discord, or SMS, from Notifications.",
  },
];

function Onboarding({ onOpenWatchlist }: { onOpenWatchlist: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border bg-card">
      <div className="relative h-32 sm:h-40">
        <StageScene
          imageClassName="object-[55%_75%]"
          className="inset-0 [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]"
        />
      </div>
      {/* The heading overlaps the photo's faded edge. */}
      <div className="relative -mt-10 px-6 pb-6 sm:-mt-12 sm:px-8 sm:pb-8">
        <h2 className="font-display text-[32px] leading-[1.1]">Your feed is empty</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Follow a few artists and UGround starts checking the ticket sources for them. Changes
          show up here, and as alerts wherever you turn them on.
        </p>
        <ul className="mt-6 divide-y border-y">
          {ONBOARDING_STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 py-4">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-[13px] leading-5 text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <Button className="mt-6" onClick={onOpenWatchlist}>
          <Plus aria-hidden="true" />
          Add artists
        </Button>
      </div>
    </div>
  );
}

interface EventListProps {
  events: EventRecord[];
  alertsByEventId: Map<string, AlertRecord[]>;
  /** Labels for venue and area watches, by rule id. */
  ruleLabelById?: Map<string, string>;
  totalEvents?: number;
  loading?: boolean;
  hasArtists?: boolean;
  onOpenWatchlist?: () => void;
  onClearFilter?: () => void;
}

export default function EventList({
  events,
  alertsByEventId,
  ruleLabelById,
  totalEvents,
  loading,
  hasArtists,
  onOpenWatchlist,
  onClearFilter,
}: EventListProps) {
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(() => new Set());
  const hasAnyEvents = (totalEvents ?? events.length) > 0;

  const toggleExpanded = (eventId: string) => {
    setExpandedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (!loading && events.length === 0) {
    if (!hasArtists && !hasAnyEvents && onOpenWatchlist) {
      return <Onboarding onOpenWatchlist={onOpenWatchlist} />;
    }

    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="text-sm font-medium">
          {hasAnyEvents ? "Nothing matches this filter" : "No shows found yet"}
        </p>
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">
          {hasAnyEvents
            ? "Try another filter, or refresh to queue a new check."
            : "Nothing you follow has upcoming shows in the sources yet. New dates show up after the next daily check."}
        </p>
        {hasAnyEvents && onClearFilter ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilter}>
            Show all shows
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ul
      id="event-feed"
      tabIndex={-1}
      aria-busy={loading}
      aria-label="Shows"
      className="divide-y rounded-xl border bg-card outline-none"
    >
      {loading
        ? Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
        : events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              alerts={alertsByEventId.get(event.id) ?? []}
              foundBy={
                !event.watch_artist_id && event.watch_rule_id
                  ? ruleLabelById?.get(event.watch_rule_id)
                  : null
              }
              expanded={expandedEventIds.has(event.id)}
              onToggleExpanded={() => toggleExpanded(event.id)}
            />
          ))}
    </ul>
  );
}
