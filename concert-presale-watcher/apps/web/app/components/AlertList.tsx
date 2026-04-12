import type { AlertRecord } from "../../lib/types";

const shortDate = (value: string | null): string => {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
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
              <li key={alert.id} className="listItem">
                <div>
                  <strong>{alert.alert_type}</strong>
                  <p>{alert.message}</p>
                  <p>{shortDate(alert.created_at)}</p>
                </div>
                <span className="pill">{alert.sent_channels.join(", ") || "stored"}</span>
              </li>
            ))}
        {!loading && alerts.length === 0 ? (
          <li className="emptyState">No alerts fired yet.</li>
        ) : null}
      </ul>
    </article>
  );
}
