import { alertTypeLabel } from "./alertFormat";
import type { AlertRecord, AlertType, EventRecord, EventStatus } from "./types";

/** Color roles for status dots. Color only ever carries meaning. */
export type Tone = "positive" | "warning" | "danger" | "brand" | "neutral" | "muted";

export const statusLabel: Record<EventStatus, string> = {
  onsale: "On sale",
  offsale: "Off sale",
  cancelled: "Cancelled",
  postponed: "Postponed",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
  unknown: "Unknown",
};

export const statusTone: Record<EventStatus, Tone> = {
  onsale: "positive",
  offsale: "muted",
  cancelled: "danger",
  postponed: "warning",
  rescheduled: "warning",
  scheduled: "neutral",
  unknown: "muted",
};

/** Ember marks news you'd act on, green marks tickets you can buy now. */
export const alertTone: Record<AlertType, Tone> = {
  new_event: "brand",
  status_changed: "neutral",
  ticket_url_changed: "neutral",
  on_sale_moved_earlier: "brand",
  presale_announced: "brand",
  presale_opened: "positive",
  public_sale_announced: "brand",
  public_sale_opened: "positive",
};

/**
 * Readable line for an alert. Stored alert messages are the raw delivery
 * string ("[status_changed] | Artist | …"), so the feed never shows them.
 */
export const alertSummary = (alert: AlertRecord, event: EventRecord): string => {
  if (alert.alert_type === "status_changed") {
    return `Now ${statusLabel[event.status].toLowerCase()}`;
  }
  if (alert.alert_type === "new_event") return "New show announced";
  return alertTypeLabel[alert.alert_type];
};

export const placeLine = (event: Pick<EventRecord, "venue" | "city" | "state">): string => {
  const cityRegion = [event.city, event.state].filter(Boolean).join(", ");
  return [event.venue, cityRegion].filter(Boolean).join(" · ");
};

export interface DateParts {
  month: string;
  day: string;
  weekday: string;
  year: number;
  showYear: boolean;
}

export const dateParts = (value: string | null): DateParts | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }),
    day: date.toLocaleDateString("en-US", { day: "numeric" }),
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    year,
    showYear: year !== new Date().getFullYear(),
  };
};

/** "Nov 2, 10:00 AM" style label for sale windows. */
export const saleTime = (value: string | null): string => {
  if (!value) return "Time TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBA";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
