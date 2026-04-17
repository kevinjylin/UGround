"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import type { NotificationSettingsResponse } from "../../lib/types";

interface NotificationSettingsPanelProps {
  settings: NotificationSettingsResponse | null;
  busy: boolean;
  onSave: (input: {
    discordWebhook?: string;
    discordEnabled: boolean;
    email?: string;
    emailEnabled: boolean;
    phone?: string;
    smsEnabled: boolean;
  }) => Promise<void>;
  onTestDiscord: () => Promise<void>;
  onSendEmailConfirmation: () => Promise<void>;
  onSendSmsConfirmation: () => Promise<void>;
  onConfirmSms: (code: string) => Promise<void>;
}

const getStatusText = (configured: boolean, enabled: boolean, confirmed?: boolean): string => {
  if (!configured) return "Not set";
  if (confirmed === false) return enabled ? "Needs confirmation" : "Saved, off";
  return enabled ? "On" : "Saved, off";
};

export default function NotificationSettingsPanel({
  settings,
  busy,
  onSave,
  onTestDiscord,
  onSendEmailConfirmation,
  onSendSmsConfirmation,
  onConfirmSms,
}: NotificationSettingsPanelProps) {
  const uid = useId();
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setDiscordEnabled(settings.discordWebhook.enabled);
    setEmailEnabled(settings.email.enabled);
    setSmsEnabled(settings.phone.enabled);
  }, [settings]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        discordWebhook: discordWebhook.trim() || undefined,
        discordEnabled,
        email: email.trim() || undefined,
        emailEnabled,
        phone: phone.trim() || undefined,
        smsEnabled,
      });
      setDiscordWebhook("");
      setEmail("");
      setPhone("");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSms = async () => {
    await onConfirmSms(smsCode);
    setSmsCode("");
  };

  const disabled = busy || saving;

  return (
    <section className="panel notificationPanel">
      <h2>Alert Destinations</h2>
      <form className="stack" onSubmit={handleSave}>
        <fieldset className="fieldsetSection">
          <legend>Discord</legend>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={discordEnabled}
              onChange={(event) => setDiscordEnabled(event.target.checked)}
            />
            Send Discord alerts
          </label>
          <label htmlFor={`${uid}-discord`} className="srOnly">Discord webhook URL</label>
          <input
            id={`${uid}-discord`}
            type="url"
            value={discordWebhook}
            onChange={(event) => setDiscordWebhook(event.target.value)}
            placeholder={settings?.discordWebhook.masked ?? "Discord webhook URL"}
          />
          <div className="actionRow">
            <span className="pill">
              {getStatusText(Boolean(settings?.discordWebhook.configured), discordEnabled)}
            </span>
            <button type="button" className="btn--secondary" onClick={onTestDiscord} disabled={disabled || !settings?.discordWebhook.configured}>
              Send Test
            </button>
          </div>
        </fieldset>

        <fieldset className="fieldsetSection">
          <legend>Email</legend>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(event) => setEmailEnabled(event.target.checked)}
            />
            Send email alerts
          </label>
          <label htmlFor={`${uid}-email`} className="srOnly">Email address</label>
          <input
            id={`${uid}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={settings?.email.masked ?? "Email address"}
          />
          <div className="actionRow">
            <span className="pill">
              {getStatusText(Boolean(settings?.email.configured), emailEnabled, settings?.email.confirmed)}
            </span>
            <button type="button" className="btn--secondary" onClick={onSendEmailConfirmation} disabled={disabled || !settings?.email.configured}>
              Send Confirmation
            </button>
          </div>
        </fieldset>

        <fieldset className="fieldsetSection">
          <legend>SMS</legend>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(event) => setSmsEnabled(event.target.checked)}
            />
            Send SMS alerts
          </label>
          <label htmlFor={`${uid}-phone`} className="srOnly">Phone number</label>
          <input
            id={`${uid}-phone`}
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={settings?.phone.masked ?? "Phone number, like +14155552671"}
          />
          <div className="actionRow">
            <span className="pill">
              {getStatusText(Boolean(settings?.phone.configured), smsEnabled, settings?.phone.confirmed)}
            </span>
            <button type="button" className="btn--secondary" onClick={onSendSmsConfirmation} disabled={disabled || !settings?.phone.configured}>
              Send Code
            </button>
          </div>
          <div className="confirmRow">
            <label htmlFor={`${uid}-sms-code`} className="srOnly">SMS confirmation code</label>
            <input
              id={`${uid}-sms-code`}
              value={smsCode}
              onChange={(event) => setSmsCode(event.target.value)}
              placeholder="SMS code"
              inputMode="numeric"
            />
            <button type="button" onClick={handleConfirmSms} disabled={disabled || !smsCode.trim()}>
              Confirm SMS
            </button>
          </div>
        </fieldset>

        <button type="submit" disabled={disabled}>
          {saving ? "Saving..." : "Save Alert Destinations"}
        </button>
      </form>
      <p className="helpText">Leave a destination blank to keep the saved value.</p>
    </section>
  );
}
