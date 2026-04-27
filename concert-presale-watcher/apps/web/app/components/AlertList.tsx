import type { AlertRecord, AlertType } from "../../lib/types";
import styles from "../dashboard/dashboard.module.css";

const alertTypeLabel: Record<AlertType, string> = {
  new_event: "New Presale",
  status_changed: "Status Change",
  ticket_url_changed: "Ticket Link Updated",
  on_sale_moved_earlier: "On-Sale Moved Earlier",
};

const cx = (...classes: Array<string | undefined>): string =>
  classes.filter(Boolean).join(" ");

const alertTypeBadgeClass: Record<AlertType, string | undefined> = {
  new_event: styles.alertBadgeNew,
  status_changed: styles.alertBadgeStatus,
  ticket_url_changed: styles.alertBadgeTicket,
  on_sale_moved_earlier: styles.alertBadgeUrgent,
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
    <article className={styles.panel}>
      <h2>Alerts</h2>
      <ul className={styles.list}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li
                key={i}
                className={`${styles.listItem} ${styles.skeleton} ${styles.skeletonRow}`}
                aria-hidden="true"
              />
            ))
          : alerts.map((alert) => (
              <li key={alert.id} className={styles.alertItem}>
                <div className={styles.alertItemTop}>
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
                <p className={styles.alertMessage}>{alert.message}</p>
                <div className={styles.alertItemBottom}>
                  {alert.sent_channels.length > 0 ? (
                    <div className={styles.channelChips} aria-label="Sent via">
                      {alert.sent_channels.map((ch) => (
                        <span
                          key={ch}
                          className={cx(
                            styles.channelChip,
                            styles.channelChipSent,
                          )}
                        >
                          {channelIcon[ch] ?? "📣"} {ch}
                        </span>
                      ))}
                    </div>
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
        {!loading && alerts.length === 0 ? (
          <li className={styles.emptyState}>
            <span className={styles.emptyStateTitle}>No alerts yet</span>
            <span className={styles.emptyStateHint}>
              Alerts fire automatically when a new presale is detected for a
              followed artist.
            </span>
          </li>
        ) : null}
      </ul>
    </article>
  );
}
