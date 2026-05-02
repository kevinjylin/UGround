import type { AlertType } from "./types";

export const alertTypeLabel: Record<AlertType, string> = {
  new_event: "New Presale",
  status_changed: "Status Change",
  ticket_url_changed: "Ticket Link Updated",
  on_sale_moved_earlier: "On-Sale Moved Earlier",
};

export const channelLabel: Record<string, string> = {
  discord: "Discord",
  email: "Email",
  sms: "SMS",
};
