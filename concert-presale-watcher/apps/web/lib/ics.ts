import type { EventRecord, SaleWindow } from "./types";

/**
 * Calendar files (RFC 5545) and Google Calendar links for a show. Pure, so the
 * dashboard can build the Google link and the API route can build the .ics
 * from the same rules.
 */

export type CalendarEvent = Pick<
  EventRecord,
  "id" | "artist_name" | "title" | "venue" | "city" | "state" | "country" | "start_time" | "ticket_url"
> & { sale_windows?: SaleWindow[] | null };

/** Show length when the source gives none. Sources only give a start time. */
const SHOW_HOURS = 3;
const SALE_ENTRY_MINUTES = 30;
const SALE_ALARM_MINUTES = 15;

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

const encoder = new TextEncoder();

/**
 * Folds a content line to at most 75 octets per line, continuing with a
 * leading space. Never splits a UTF-8 character.
 */
export const foldIcsLine = (line: string): string => {
  const limit = 75;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward the limit.
    const max = parts.length === 0 ? limit : limit - 1;
    if (currentBytes + bytes > max) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const pad = (value: number) => String(value).padStart(2, "0");

/** 20261122T040000Z */
export const icsUtc = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ShowTiming =
  | { kind: "timed"; start: Date; end: Date }
  | { kind: "allDay"; date: string; nextDate: string }
  | null;

/** When the show happens. A bare date is an all-day entry; no date is null. */
export const showTiming = (startTime: string | null): ShowTiming => {
  if (!startTime) return null;
  const dateOnly = DATE_ONLY.exec(startTime.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
    return {
      kind: "allDay",
      date: `${y}${m}${d}`,
      nextDate: `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`,
    };
  }
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  return { kind: "timed", start, end: new Date(start.getTime() + SHOW_HOURS * 3_600_000) };
};

export const calendarTitle = (event: CalendarEvent): string =>
  event.venue ? `${event.artist_name} at ${event.venue}` : event.artist_name;

export const calendarLocation = (event: CalendarEvent): string =>
  [event.venue, event.city, event.state, event.country && event.country !== "US" ? event.country : null]
    .filter(Boolean)
    .join(", ");

const saleLabel = (window: SaleWindow): string =>
  window.kind === "presale" ? window.name || "Presale" : "General on-sale";

const formatInZone = (iso: string, timeZone: string | undefined): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "time TBA";
  try {
    return date.toLocaleString("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return date.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
  }
};

/** Plain-text details: listing title, ticket link and sale windows. */
export const calendarDescription = (event: CalendarEvent, timeZone?: string): string => {
  const lines: string[] = [];
  const title = event.title?.trim();
  if (title && title !== event.artist_name) lines.push(title);
  if (event.ticket_url) lines.push(`Tickets: ${event.ticket_url}`);
  const windows = event.sale_windows ?? [];
  if (windows.length > 0) {
    lines.push("", "Sale windows:");
    for (const window of windows) {
      const when = window.starts_at ? formatInZone(window.starts_at, timeZone) : "time TBA";
      lines.push(`${saleLabel(window)}: ${when}${window.url && window.url !== event.ticket_url ? ` (${window.url})` : ""}`);
    }
  }
  lines.push("", "Saved from UGround. Check the ticket link for the latest times.");
  return lines.join("\n");
};

/** Sale windows that haven't opened yet, soonest first. */
export const upcomingSaleWindows = (event: CalendarEvent, now: Date): SaleWindow[] =>
  (event.sale_windows ?? [])
    .filter((window) => {
      if (!window.starts_at) return false;
      const starts = new Date(window.starts_at).getTime();
      return !Number.isNaN(starts) && starts > now.getTime();
    })
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());

export interface BuildIcsOptions {
  now?: Date;
  /** IANA zone for times written into descriptions. Defaults to UTC. */
  timeZone?: string;
  /** Domain for entry UIDs. */
  uidDomain?: string;
}

/**
 * A calendar with the show (when it has a date) and a separate 30-minute entry
 * with a 15-minute alarm for each presale or on-sale still ahead. Returns null
 * when there is nothing to put on a calendar.
 */
export const buildEventIcs = (event: CalendarEvent, options: BuildIcsOptions = {}): string | null => {
  const now = options.now ?? new Date();
  const domain = options.uidDomain ?? "uground.app";
  const timing = showTiming(event.start_time);
  const sales = upcomingSaleWindows(event, now);
  if (!timing && sales.length === 0) return null;

  const stamp = icsUtc(now);
  const description = calendarDescription(event, options.timeZone);
  const location = calendarLocation(event);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UGround//Show feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (timing) {
    lines.push("BEGIN:VEVENT", `UID:${event.id}@${domain}`, `DTSTAMP:${stamp}`);
    if (timing.kind === "timed") {
      lines.push(`DTSTART:${icsUtc(timing.start)}`, `DTEND:${icsUtc(timing.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${timing.date}`, `DTEND;VALUE=DATE:${timing.nextDate}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(calendarTitle(event))}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (event.ticket_url) lines.push(`URL:${event.ticket_url}`);
    lines.push("END:VEVENT");
  }

  sales.forEach((window, index) => {
    const start = new Date(window.starts_at!);
    const label = saleLabel(window);
    const url = window.url ?? event.ticket_url;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}-sale-${index}@${domain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(start)}`,
      `DTEND:${icsUtc(new Date(start.getTime() + SALE_ENTRY_MINUTES * 60_000))}`,
      `SUMMARY:${escapeIcsText(`${label}: ${calendarTitle(event)}`)}`,
    );
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (url) lines.push(`URL:${url}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`${label} for ${event.artist_name} starts in ${SALE_ALARM_MINUTES} minutes`)}`,
      `TRIGGER:-PT${SALE_ALARM_MINUTES}M`,
      "END:VALARM",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
};

/** Download name like "wednesday-2026-12-21.ics". */
export const icsFileName = (event: CalendarEvent): string => {
  const slug =
    event.artist_name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 60) || "show";
  const date = event.start_time?.slice(0, 10);
  return `${slug}${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `-${date}` : ""}.ics`;
};

/** A Google Calendar "add event" link for the show, or null when it has no date. */
export const googleCalendarUrl = (event: CalendarEvent, timeZone?: string): string | null => {
  const timing = showTiming(event.start_time);
  if (!timing) return null;
  const dates =
    timing.kind === "timed"
      ? `${icsUtc(timing.start)}/${icsUtc(timing.end)}`
      : `${timing.date}/${timing.nextDate}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(event),
    dates,
    details: calendarDescription(event, timeZone),
  });
  const location = calendarLocation(event);
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
