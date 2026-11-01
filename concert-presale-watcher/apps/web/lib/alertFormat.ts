import type { AlertType } from "./types";

export const alertTypeLabel: Record<AlertType, string> = {
  new_event: "New date",
  status_changed: "Status changed",
  ticket_url_changed: "Ticket link changed",
  on_sale_moved_earlier: "On-sale moved earlier",
  presale_announced: "Presale announced",
  presale_opened: "Presale opened",
  public_sale_announced: "On-sale date announced",
  public_sale_opened: "On sale",
};

export const channelLabel: Record<string, string> = {
  discord: "Discord",
  email: "Email",
  sms: "SMS",
};
