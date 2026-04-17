import type { AlertRecord, AlertType } from "../../lib/types";

const alertTypeLabel: Record<AlertType, string> = {
  new_event: "New Presale",
  status_changed: "Status Change",
  ticket_url_changed: "Ticket Link Updated",
  on_sale_moved_earlier: "On-Sale Moved Earlier",
};

const alertTypeBadgeClass: Record<AlertType, string> = {
  new_event: "alertBadge--new",
  status_changed: "alertBadge--status",
  ticket_url_changed: "alertBadge--ticket",
  on_sale_moved_earlier: "alertBadge--urgent",
};

const channelIcon: Record<string, string> = {
  discord: "🔔",
  email: "✉",
  sms: "📱",
};

const relativeTime = (value: string): string => {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

interface AlertListProps {
  alerts: AlertRecord[];
  loading?: boolean;
}

export default function AlertList({ alerts, loading }: AlertListProps) {
  return (
    <article className="panel">
      <h2>Alerts</h2>
      <ul className="list">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="listItem skeleton skeleton--row" aria-hidden="true" />
            ))
          : alerts.map((alert) => (
              <li key={alert.id} className="alertItem">
                <div className="alertItemTop">
                  <span className={`alertBadge ${alertTypeBadgeClass[alert.alert_type]}`}>
                    {alertTypeLabel[alert.alert_type]}
                  </span>
                  <span className="alertTime">{relativeTime(alert.created_at)}</span>
                </div>
                <p className="alertMessage">{alert.message}</p>
                <div className="alertItemBottom">
                  {alert.sent_channels.length > 0 ? (
                    <div className="channelChips" aria-label="Sent via">
                      {alert.sent_channels.map((ch) => (
                        <span key={ch} className="channelChip channelChip--sent">
                          {channelIcon[ch] ?? "📣"} {ch}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="channelChip channelChip--stored">stored only</span>
                  )}
                </div>
              </li>
            ))}
        {!loading && alerts.length === 0 ? (
          <li className="emptyState">
            <span className="emptyStateTitle">No alerts yet</span>
            <span className="emptyStateHint">Alerts fire automatically when a new presale is detected for a followed artist.</span>
          </li>
        ) : null}
      </ul>
    </article>
  );
}
