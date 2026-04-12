import type { HealthResponse } from "../../lib/types";

interface IntegrationsPanelProps {
  health: HealthResponse | null;
}

function StatusRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <p className="statusRow">
      <span
        className="statusDot"
        style={{ background: configured ? "var(--success)" : "var(--danger)" }}
        aria-hidden="true"
      />
      {label} — {configured ? "configured" : "not set"}
    </p>
  );
}

export default function IntegrationsPanel({ health }: IntegrationsPanelProps) {
  return (
    <section className="panel healthPanel">
      <h2>Integrations</h2>
      {health ? (
        <div className="healthSections">
          <fieldset className="fieldsetSection">
            <legend>Data Sources</legend>
            <div className="healthGrid">
              <StatusRow label="Database" configured={health.databaseConfigured} />
              <StatusRow label="Ticketmaster" configured={health.sourceKeysConfigured.ticketmaster} />
              <StatusRow label="Eventbrite" configured={health.sourceKeysConfigured.eventbrite} />
              <StatusRow label="Spotify" configured={health.sourceKeysConfigured.spotify} />
            </div>
          </fieldset>
          <fieldset className="fieldsetSection">
            <legend>Authentication</legend>
            <div className="healthGrid">
              <StatusRow label="Credentials" configured={health.authConfigured.credentials} />
              <StatusRow label="Google OAuth" configured={health.authConfigured.google} />
              <StatusRow label="Auth secret" configured={health.authConfigured.secret} />
            </div>
          </fieldset>
          <fieldset className="fieldsetSection">
            <legend>Alert Channels</legend>
            <div className="healthGrid">
              <StatusRow label="Discord" configured={health.alertChannelsConfigured.discord} />
              <StatusRow label="Email" configured={health.alertChannelsConfigured.email} />
              <StatusRow label="SMS" configured={health.alertChannelsConfigured.sms} />
            </div>
          </fieldset>
        </div>
      ) : (
        <p className="helpText">Loading integration status...</p>
      )}
    </section>
  );
}
