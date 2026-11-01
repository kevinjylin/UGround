"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dot, StatusDot } from "@/components/status-dot";
import { Ticket } from "@/components/ticket";
import { cn } from "@/lib/cn";
import { channelLabel } from "@/lib/alertFormat";
import { alertSummary, alertTone, dateParts, placeLine, saleTime } from "@/lib/eventDisplay";
import { relativeTime } from "@/lib/format";
import type { AlertRecord, EventRecord } from "@/lib/types";

interface OnSaleHeroProps {
  events: EventRecord[];
  alertsByEventId: Map<string, AlertRecord[]>;
  totalCount: number;
  onShowAll: () => void;
}

function TicketsLink({ event }: { event: EventRecord }) {
  if (!event.ticket_url) return null;
  return (
    <Button asChild variant="outline" size="sm" className="shrink-0">
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
  );
}

function OnSaleTicket({
  event,
  size,
  latestAlert,
}: {
  event: EventRecord;
  size: "md" | "lg";
  latestAlert?: AlertRecord;
}) {
  const lg = size === "lg";
  const windows = lg ? (event.sale_windows ?? []).slice(0, 2) : [];
  const alert = lg ? latestAlert : undefined;
  return (
    <Ticket date={dateParts(event.start_time)} size={size} className={cn(lg && "h-full")}>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-medium",
            lg ? "text-xl leading-7 tracking-[-0.01em]" : "text-[15px] leading-5",
          )}
        >
          {event.artist_name}
        </p>
        <p className={cn("mt-1 truncate text-muted-foreground", lg ? "text-sm" : "text-[13px]")}>
          {placeLine(event) || "Venue to be announced"}
        </p>
      </div>
      {windows.length > 0 ? (
        <dl className="grid gap-1.5 font-mono text-xs">
          {windows.map((window, index) => (
            <div key={`${window.kind}-${index}`} className="flex justify-between gap-4">
              <dt className="truncate text-muted-foreground">
                {window.kind === "presale" ? window.name || "Presale" : "General on-sale"}
              </dt>
              <dd className="shrink-0 text-muted-foreground">{saleTime(window.starts_at)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {alert ? (
        <div className="grid gap-1 text-[13px] leading-5">
          <span className="flex items-center gap-2">
            <Dot tone={alertTone[alert.alert_type]} />
            {alertSummary(alert, event)}
            <span className="font-mono text-xs text-muted-foreground">{relativeTime(alert.created_at)}</span>
          </span>
          <span className="pl-3.5 font-mono text-xs text-muted-foreground">
            {alert.sent_channels.length > 0
              ? `Sent by ${alert.sent_channels.map((c) => channelLabel[c] ?? c).join(", ")}`
              : "Not sent, no channel on"}
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "mt-auto flex items-center justify-between gap-3",
          lg && "border-t border-dashed pt-4",
        )}
      >
        <StatusDot tone="positive">On sale</StatusDot>
        <TicketsLink event={event} />
      </div>
    </Ticket>
  );
}

/** The dashboard's one bright element: shows you can buy tickets for right now. */
export default function OnSaleHero({
  events,
  alertsByEventId,
  totalCount,
  onShowAll,
}: OnSaleHeroProps) {
  if (totalCount === 0 || events.length === 0) return null;

  const [lead, ...rest] = events;
  const side = rest.slice(0, 2);

  return (
    <section aria-labelledby="onsale-heading" className="grid gap-3">
      <div className="flex h-8 items-center justify-between">
        <h2 id="onsale-heading" className="flex items-baseline gap-2 text-[15px] font-medium">
          On sale now
          <span className="tabular font-mono text-xs font-normal text-faint">{totalCount}</span>
        </h2>
        {totalCount > 1 ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onShowAll}>
            View all
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "grid gap-4",
          side.length > 0 && "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]",
        )}
      >
        <OnSaleTicket event={lead!} size="lg" latestAlert={alertsByEventId.get(lead!.id)?.[0]} />
        {side.length > 0 ? (
          <div className="hidden content-start gap-4 sm:grid">
            {side.map((event) => (
              <OnSaleTicket key={event.id} event={event} size="md" />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
