/**
 * Per-channel alert messages. Everything here is pure: callers pass the
 * alert, the event, the time zones, and `now`, so tests can pin them.
 */
import { statusLabel } from "./eventDisplay";
import type { AlertType, EventRecord, SaleWindow } from "./types";

/** What the stored source payload says about the show's local time. */
export interface VenueTime {
  timeZone: string | null;
  /** "2027-03-07" as printed on the ticket. */
  localDate: string | null;
  /** True when the source gives a date but no start time. */
  dateOnly: boolean;
}

export interface MessageInput {
  alertType: AlertType;
  event: EventRecord;
  /** The stored alert payload (sale window details for reminders). */
  payload?: Record<string, unknown> | null;
  /** The user's IANA zone, captured from their browser. */
  userTimeZone: string | null;
  venueTime?: VenueTime | null;
  now: Date;
}

export interface AlertContent {
  /** What the alert is about, in words: "Verified Fan Presale opens soon". */
  label: string;
  artist: string;
  title: string;
  /** "Sat, Mar 7, 2027, 8:00 PM CST" or "Sat, Mar 7, 2027" when no time is known. */
  showDate: string | null;
  place: string | null;
  /** "Verified Fan Presale starts Tue, Nov 18, 10:00 AM PST". */
  saleLine: string | null;
  /** Short sale time for subjects: "Tue, Nov 18, 10:00 AM PST". */
  saleTime: string | null;
  /** The sale window's name, and whether it has started at render time. */
  saleName: string | null;
  saleStarted: boolean;
  /** Tail of the subject line: the sale time for sale alerts, else the city. */
  subjectDetail: string | null;
  detail: string | null;
  ticketUrl: string | null;
}

const BRAND = {
  page: "#121211",
  card: "#1b1b1a",
  border: "#2a2a28",
  text: "#ededea",
  muted: "#a2a29c",
  faint: "#85857f",
  ember: "#f05a28",
  emberText: "#1a0c06",
};

export const isSafeUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const zoneOrUtc = (timeZone: string | null | undefined): string => {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

/** "Tue, Nov 18, 10:00 AM PST". The year is added when it isn't this year. */
export const formatInZone = (
  value: string | null | undefined,
  timeZone: string | null | undefined,
  now: Date,
): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const zone = zoneOrUtc(timeZone);
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric" }).format(d);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(year(date) !== year(now) ? { year: "numeric" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
    .format(date)
    // ICU puts narrow no-break spaces before AM/PM; plain spaces keep SMS in GSM-7.
    .replace(/[\u202f\u00a0]/g, " ");
};

/** A calendar date with no time ("2027-03-07") printed as "Sun, Mar 7, 2027". */
const formatLocalDate = (localDate: string, now: Date): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" as const } : {}),
  }).format(date);
};

const showDateLine = (input: MessageInput): string | null => {
  const venue = input.venueTime;
  if (venue?.dateOnly && venue.localDate) return formatLocalDate(venue.localDate, input.now);
  // The venue's own clock is what the ticket says; fall back to the user's.
  return formatInZone(input.event.start_time, venue?.timeZone ?? input.userTimeZone, input.now);
};

const windowKey = (window: Pick<SaleWindow, "kind" | "name" | "starts_at">): string =>
  [window.kind, window.name, window.starts_at ?? ""].join("::");

export const saleWindowKey = windowKey;

const asWindow = (value: unknown): SaleWindow | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<SaleWindow>;
  if (record.kind !== "presale" && record.kind !== "public") return null;
  return {
    kind: record.kind,
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : record.kind === "presale" ? "Presale" : "Public sale",
    url: typeof record.url === "string" ? record.url : null,
    starts_at: typeof record.starts_at === "string" ? record.starts_at : null,
    ends_at: typeof record.ends_at === "string" ? record.ends_at : null,
  };
};

/** The sale window this alert is about, if any. */
export const relevantSaleWindow = (input: MessageInput): SaleWindow | null => {
  const { alertType, event, payload, now } = input;
  const windows = (event.sale_windows ?? []).map(asWindow).filter((w): w is SaleWindow => Boolean(w));
  if (alertType === "sale_opens_soon" || alertType === "sale_open_now") {
    return asWindow(payload?.sale_window) ?? null;
  }
  const newKeys = Array.isArray(payload?.sale_window_keys) ? (payload.sale_window_keys as string[]) : [];
  const pick = (kind: SaleWindow["kind"]) =>
    windows.find((w) => w.kind === kind && newKeys.includes(windowKey(w))) ??
    windows.find((w) => w.kind === kind && w.starts_at && new Date(w.starts_at) > now) ??
    windows.find((w) => w.kind === kind) ??
    null;
  if (alertType === "presale_announced" || alertType === "presale_opened") return pick("presale");
  if (alertType === "public_sale_announced" || alertType === "public_sale_opened" || alertType === "on_sale_moved_earlier") {
    const publicWindow = pick("public");
    if (publicWindow) return publicWindow;
    return event.on_sale_start
      ? { kind: "public", name: "Public sale", url: null, starts_at: event.on_sale_start, ends_at: null }
      : null;
  }
  // Otherwise, mention the next sale that hasn't started yet.
  return (
    windows
      .filter((w) => w.starts_at && new Date(w.starts_at) > now)
      .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime())[0] ??
    null
  );
};

const labelFor = (input: MessageInput, window: SaleWindow | null): string => {
  const started = window?.starts_at ? new Date(window.starts_at) <= input.now : false;
  const name = window?.name ?? "Sale";
  switch (input.alertType) {
    case "new_event":
      return "New show";
    case "status_changed":
      return `Now ${statusLabel[input.event.status].toLowerCase()}`;
    case "ticket_url_changed":
      return "Ticket link changed";
    case "on_sale_moved_earlier":
      return "On-sale moved earlier";
    case "presale_announced":
      return "Presale announced";
    case "presale_opened":
      return "Presale open";
    case "public_sale_announced":
      return "On-sale date announced";
    case "public_sale_opened":
      return "On sale now";
    case "sale_opens_soon":
      // A held reminder can go out after the start; say what's true then.
      return started ? `${name} is open` : `${name} opens soon`;
    case "sale_open_now":
      return `${name} is open`;
  }
};

const SALE_ALERTS = new Set<AlertType>([
  "presale_announced",
  "presale_opened",
  "public_sale_announced",
  "public_sale_opened",
  "on_sale_moved_earlier",
  "sale_opens_soon",
  "sale_open_now",
]);

export const buildAlertContent = (input: MessageInput): AlertContent => {
  const { event } = input;
  const window = relevantSaleWindow(input);
  // Sale times go in the user's zone; the venue's zone if we don't know theirs.
  const saleZone = input.userTimeZone ?? input.venueTime?.timeZone ?? null;
  const saleTime = window ? formatInZone(window.starts_at, saleZone, input.now) : null;
  const started = window?.starts_at ? new Date(window.starts_at) <= input.now : false;
  const saleLine = window
    ? saleTime
      ? `${window.name} ${started ? "started" : "starts"} ${saleTime}`
      : `${window.name}: start time not announced`
    : null;
  const cityRegion = [event.city, event.state].filter(Boolean).join(", ");
  const place = [event.venue, cityRegion].filter(Boolean).join(", ") || null;
  const detail =
    input.alertType === "ticket_url_changed"
      ? "The ticket link for this show changed. Use the new link below."
      : input.alertType === "status_changed"
        ? `Ticketing status is now ${statusLabel[event.status].toLowerCase()}.`
        : null;
  const windowUrl = window?.url;
  const ticketUrl = isSafeUrl(windowUrl) ? windowUrl : isSafeUrl(event.ticket_url) ? event.ticket_url : null;
  return {
    label: labelFor(input, window),
    artist: event.artist_name,
    title: event.title,
    showDate: showDateLine(input),
    place,
    saleLine,
    saleTime,
    saleName: window?.name ?? null,
    saleStarted: started,
    subjectDetail: SALE_ALERTS.has(input.alertType)
      ? saleTime
      : event.city
        ? `in ${event.city}`
        : null,
    detail,
    ticketUrl,
  };
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildSubject = (content: AlertContent): string => {
  const detail = content.subjectDetail
    ? content.subjectDetail.startsWith("in ")
      ? ` ${content.subjectDetail}`
      : `, ${content.subjectDetail}`
    : "";
  const subject = `${content.label}: ${content.artist}${detail}`;
  return subject.length > 140 ? `${subject.slice(0, 139)}…` : subject;
};

const textLines = (content: AlertContent): string[] =>
  [
    content.saleLine,
    content.showDate ? `Show: ${content.showDate}` : null,
    content.place ? `Venue: ${content.place}` : null,
    content.detail,
  ].filter((line): line is string => Boolean(line));

interface EmailLinks {
  unsubscribeUrl: string;
  manageUrl: string | null;
}

const footerText = (links: EmailLinks): string =>
  [
    "You get this because you follow this artist, venue, or area on UGround.",
    links.manageUrl ? `Manage alerts: ${links.manageUrl}` : null,
    `Turn off email alerts: ${links.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

const footerHtml = (links: EmailLinks): string => `
<tr><td style="padding:20px 28px 28px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${BRAND.faint};">
You get this because you follow this artist, venue, or area on UGround.<br>
${links.manageUrl ? `<a href="${escapeHtml(links.manageUrl)}" style="color:${BRAND.muted};text-decoration:underline;">Manage alerts</a> &nbsp;&middot;&nbsp; ` : ""}<a href="${escapeHtml(links.unsubscribeUrl)}" style="color:${BRAND.muted};text-decoration:underline;">Turn off email alerts</a>
</td></tr>`;

const shell = (preheader: string, body: string, links: EmailLinks): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>UGround</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.page};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:10px;">
<tr><td style="padding:24px 28px 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:${BRAND.text};">
<span style="color:${BRAND.ember};">&#9679;</span>&nbsp;UGround
</td></tr>
${body}
${footerHtml(links)}
</table>
</td></tr>
</table>
</body>
</html>`;

const detailRowsHtml = (content: AlertContent): string =>
  [
    content.saleLine ? ["Sale", content.saleLine] : null,
    content.showDate ? ["Show", content.showDate] : null,
    content.place ? ["Venue", content.place] : null,
  ]
    .filter((row): row is string[] => Boolean(row))
    .map(
      ([name, value]) => `<tr>
<td valign="top" style="padding:6px 16px 6px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${BRAND.faint};white-space:nowrap;">${escapeHtml(name as string)}</td>
<td valign="top" style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:${BRAND.text};">${escapeHtml(value as string)}</td>
</tr>`,
    )
    .join("\n");

const buttonHtml = (url: string, text: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
<td style="border-radius:8px;background-color:${BRAND.ember};">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 20px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:${BRAND.emberText};text-decoration:none;border-radius:8px;">${escapeHtml(text)}</a>
</td></tr></table>`;

const alertBlockHtml = (content: AlertContent, headingSize: number): string => `
<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;font-weight:bold;color:${BRAND.ember};">${escapeHtml(content.label)}</div>
<div style="padding-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:${headingSize}px;line-height:${Math.round(headingSize * 1.2)}px;color:${BRAND.text};">${escapeHtml(content.artist)}</div>
${content.title && content.title !== content.artist ? `<div style="padding-top:4px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:${BRAND.muted};">${escapeHtml(content.title)}</div>` : ""}
${content.detail ? `<div style="padding-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:${BRAND.text};">${escapeHtml(content.detail)}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">${detailRowsHtml(content)}</table>`;

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

export const buildAlertEmail = (content: AlertContent, links: EmailLinks): EmailMessage => {
  const text = [
    `${content.label}: ${content.artist}`,
    content.title !== content.artist ? content.title : null,
    "",
    ...textLines(content),
    content.ticketUrl ? `\nTickets: ${content.ticketUrl}` : null,
    "",
    "--",
    footerText(links),
  ]
    .filter((line) => line !== null)
    .join("\n");
  const body = `<tr><td style="padding:20px 28px 4px 28px;">
${alertBlockHtml(content, 28)}
${content.ticketUrl ? buttonHtml(content.ticketUrl, "Get tickets") : ""}
</td></tr>`;
  return {
    subject: buildSubject(content),
    html: shell(content.saleLine ?? content.showDate ?? content.label, body, links),
    text,
  };
};

export const buildDigestEmail = (
  contents: AlertContent[],
  links: EmailLinks,
  dateLabel: string,
): EmailMessage => {
  const count = contents.length;
  const subject = `UGround daily digest: ${count} ${count === 1 ? "alert" : "alerts"}, ${dateLabel}`;
  const text = [
    `Your UGround alerts, ${dateLabel}`,
    "",
    ...contents.flatMap((content) => [
      `${content.label}: ${content.artist}`,
      ...textLines(content).map((line) => `  ${line}`),
      content.ticketUrl ? `  Tickets: ${content.ticketUrl}` : null,
      "",
    ]),
    "--",
    footerText(links),
  ]
    .filter((line) => line !== null)
    .join("\n");
  const items = contents
    .map(
      (content, index) => `<tr><td style="padding:${index === 0 ? 20 : 18}px 28px 18px 28px;${index > 0 ? `border-top:1px solid ${BRAND.border};` : ""}">
${alertBlockHtml(content, 22)}
${content.ticketUrl ? `<div style="padding-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:14px;"><a href="${escapeHtml(content.ticketUrl)}" style="color:${BRAND.ember};font-weight:bold;text-decoration:none;">Get tickets &rarr;</a></div>` : ""}
</td></tr>`,
    )
    .join("\n");
  const heading = `<tr><td style="padding:16px 28px 0 28px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:${BRAND.text};">Your alerts, ${escapeHtml(dateLabel)}</td></tr>`;
  return {
    subject,
    html: shell(`${count} ${count === 1 ? "alert" : "alerts"} from UGround`, `${heading}\n${items}`, links),
    text,
  };
};

export interface DiscordMessage {
  content: string;
  embeds: Array<{
    title: string;
    url?: string;
    description: string;
    color: number;
  }>;
}

export const buildDiscordMessage = (content: AlertContent): DiscordMessage => {
  const title = `${content.label}: ${content.artist}`.slice(0, 256);
  return {
    content: `**${content.label}**: ${content.artist}`.slice(0, 2000),
    embeds: [
      {
        title,
        ...(content.ticketUrl ? { url: content.ticketUrl } : {}),
        description: [content.title !== content.artist ? content.title : null, ...textLines(content)]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000),
        color: 0xf05a28,
      },
    ],
  };
};

export const buildSmsMessage = (content: AlertContent): string => {
  // "Verified Fan Presale opens soon" already names the sale; don't repeat it.
  const named = Boolean(content.saleName && content.label.startsWith(content.saleName));
  const sale =
    named && content.saleTime
      ? `${content.saleStarted ? "Started" : "Starts"} ${content.saleTime}.`
      : content.saleLine
        ? `${content.saleLine}.`
        : null;
  const parts = [
    `UGround: ${content.label}, ${content.artist}.`,
    sale,
    content.showDate || content.place
      ? `Show ${[content.showDate, content.place].filter(Boolean).join(", ")}.`
      : null,
    content.ticketUrl,
  ].filter(Boolean);
  return parts.join(" ");
};

export const buildPushPayload = (
  content: AlertContent,
  fallbackUrl: string | null,
): { title: string; body: string; url: string | null } => ({
  title: `${content.artist}: ${content.label}`.slice(0, 120),
  body: [content.saleLine, [content.showDate, content.place].filter(Boolean).join(", ") || null]
    .filter(Boolean)
    .join("\n")
    .slice(0, 300),
  url: content.ticketUrl ?? fallbackUrl,
});

/** Plain one-line text stored on the alert row. */
export const buildStoredMessage = (content: AlertContent): string =>
  [`${content.label}: ${content.artist}`, content.saleLine, content.showDate, content.place]
    .filter(Boolean)
    .join(" | ");
