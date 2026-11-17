"use client";

import { FormEvent, useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { StatusDot } from "@/components/status-dot";
import {
  ALERT_CHANNELS,
  ALL_ALERT_TYPES,
  DEFAULT_REMINDER_LEAD_MINUTES,
  REMINDER_LEAD_OPTIONS,
  type AlertChannel,
} from "@/lib/alertPreferences";
import type { Tone } from "@/lib/eventDisplay";
import type {
  AlertPreferencesResponse,
  AlertType,
  NotificationSettingsResponse,
} from "@/lib/types";
import PushChannelCard from "./PushChannelCard";

interface NotificationSettingsPanelProps {
  settings: NotificationSettingsResponse | null;
  busy: boolean;
  onSave: (input: {
    discordWebhook?: string | null;
    discordEnabled: boolean;
    email?: string | null;
    emailEnabled: boolean;
    phone?: string | null;
    smsEnabled: boolean;
    /** Sent with the main save; the remove buttons leave preferences alone. */
    preferences?: AlertPreferencesResponse;
  }) => Promise<void>;
  onTestDiscord: () => Promise<void>;
  onSendEmailConfirmation: () => Promise<void>;
  onSendSmsConfirmation: () => Promise<void>;
  onConfirmSms: (code: string) => Promise<void>;
}

type NotificationChannel = "discord" | "email" | "sms";

/** Alert types grouped the way people think about them. */
const alertGroups: Array<{ label: string; types: AlertType[] }> = [
  { label: "New shows", types: ["new_event"] },
  { label: "Presales", types: ["presale_announced", "presale_opened"] },
  { label: "On-sale dates", types: ["public_sale_announced", "public_sale_opened", "on_sale_moved_earlier"] },
  { label: "Sale reminders", types: ["sale_opens_soon", "sale_open_now"] },
  { label: "Other changes", types: ["status_changed", "ticket_url_changed"] },
];

const matrixChannelLabel: Record<AlertChannel, string> = {
  email: "Email",
  push: "Push",
  sms: "SMS",
  discord: "Discord",
};

const leadLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes before`;
  if (minutes === 60) return "1 hour before";
  if (minutes < 1440) return `${minutes / 60} hours before`;
  return "1 day before";
};

const browserTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

const defaultPreferences = (): AlertPreferencesResponse => ({
  timeZone: null,
  reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
  emailDigest: false,
  channelAlertTypes: {},
});

const allowedTypes = (preferences: AlertPreferencesResponse, channel: AlertChannel): AlertType[] =>
  preferences.channelAlertTypes[channel] ?? ALL_ALERT_TYPES;

function AlertTypeMatrix({
  preferences,
  onChange,
  disabled,
}: {
  preferences: AlertPreferencesResponse;
  onChange: (next: AlertPreferencesResponse) => void;
  disabled: boolean;
}) {
  const toggle = (channel: AlertChannel, types: AlertType[], on: boolean) => {
    const current = new Set(allowedTypes(preferences, channel));
    for (const type of types) {
      if (on) current.add(type);
      else current.delete(type);
    }
    onChange({
      ...preferences,
      channelAlertTypes: {
        ...preferences.channelAlertTypes,
        [channel]: ALL_ALERT_TYPES.filter((type) => current.has(type)),
      },
    });
  };

  return (
    <table className="w-full border-collapse text-[13px] leading-5">
      <thead>
        <tr>
          <th scope="col" className="pb-2 text-left font-normal text-muted-foreground">
            <span className="sr-only">Alert</span>
          </th>
          {ALERT_CHANNELS.map((channel) => (
            <th
              key={channel}
              scope="col"
              className="w-14 pb-2 text-center font-normal text-muted-foreground"
            >
              {matrixChannelLabel[channel]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {alertGroups.map((group) => (
          <tr key={group.label} className="border-t">
            <th scope="row" className="py-2 pr-2 text-left font-normal text-foreground">
              {group.label}
            </th>
            {ALERT_CHANNELS.map((channel) => {
              const allowed = allowedTypes(preferences, channel);
              const checked = group.types.every((type) => allowed.includes(type));
              return (
                <td key={channel} className="py-2 text-center">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggle(channel, group.types, value === true)}
                    disabled={disabled}
                    aria-label={`${group.label} by ${matrixChannelLabel[channel]}`}
                    className="mx-auto"
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PreferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 py-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-5 font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const channelStatus = (
  configured: boolean,
  enabled: boolean,
  confirmed?: boolean,
): { tone: Tone; text: string } => {
  if (!configured) return { tone: "muted", text: "Not set up" };
  if (!enabled) return { tone: "muted", text: "Off" };
  if (confirmed === false) return { tone: "warning", text: "Needs confirmation" };
  return { tone: "positive", text: "On" };
};

interface ChannelSectionProps {
  title: string;
  status: { tone: Tone; text: string };
  masked: string | null | undefined;
  configured: boolean;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  switchLabel: string;
  editLabel: string;
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  field: ReactNode;
  primaryAction?: ReactNode;
  onRemove?: () => void;
  removeDisabled?: boolean;
  extra?: ReactNode;
}

function ChannelSection({
  title,
  status,
  masked,
  configured,
  enabled,
  onEnabledChange,
  switchLabel,
  editLabel,
  editing,
  onEditingChange,
  field,
  primaryAction,
  onRemove,
  removeDisabled,
  extra,
}: ChannelSectionProps) {
  return (
    <section className="flex flex-col gap-3 py-5 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm leading-5 font-medium text-foreground">{title}</h3>
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={status.tone}>{status.text}</StatusDot>
            {masked ? (
              <span className="truncate text-[13px] leading-5 text-faint">{masked}</span>
            ) : null}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label={switchLabel}
          className="mt-0.5"
        />
      </div>

      <Collapsible
        open={!configured || editing}
        onOpenChange={onEditingChange}
        className="flex flex-col gap-3"
      >
        {configured ? (
          <div className="flex flex-wrap items-center gap-2">
            {primaryAction}
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="group/edit text-muted-foreground"
              >
                {editLabel}
                <ChevronDown
                  aria-hidden="true"
                  className="transition-transform duration-200 group-data-[state=open]/edit:rotate-180"
                />
              </Button>
            </CollapsibleTrigger>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={onRemove}
                disabled={removeDisabled}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        <CollapsibleContent className="flex flex-col gap-3">{field}</CollapsibleContent>
      </Collapsible>

      {extra}
    </section>
  );
}

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
  const [preferences, setPreferences] = useState<AlertPreferencesResponse>(defaultPreferences);
  const [localZone, setLocalZone] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<NotificationChannel, boolean>>({
    discord: false,
    email: false,
    sms: false,
  });

  useEffect(() => {
    if (!settings) {
      return;
    }

    setDiscordEnabled(settings.discordWebhook.enabled);
    setEmailEnabled(settings.email.enabled);
    setSmsEnabled(settings.phone.enabled);
    setPreferences(settings.preferences ?? defaultPreferences());
  }, [settings]);

  // Read after mount so the server render and the first client render match.
  useEffect(() => {
    setLocalZone(browserTimeZone());
  }, []);

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
        // Sale times in alerts use the zone of the browser that saved last.
        preferences: { ...preferences, timeZone: localZone ?? preferences.timeZone },
      });
      setDiscordWebhook("");
      setEmail("");
      setPhone("");
      setEditing({ discord: false, email: false, sms: false });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSms = async () => {
    await onConfirmSms(smsCode);
    setSmsCode("");
  };

  const setChannelEditing = (channel: NotificationChannel) => (value: boolean) =>
    setEditing((current) => ({ ...current, [channel]: value }));

  const disabled = busy || saving;
  const emailConfigured = Boolean(settings?.email.configured);
  const discordConfigured = Boolean(settings?.discordWebhook.configured);
  const phoneConfigured = Boolean(settings?.phone.configured);
  const zoneLabel = (localZone ?? preferences.timeZone ?? "UTC").replace(/_/g, " ");
  const setQuietHours = (patch: Partial<AlertPreferencesResponse["quietHours"]>) =>
    setPreferences((current) => ({ ...current, quietHours: { ...current.quietHours, ...patch } }));

  return (
    <form className="flex min-h-full flex-col" onSubmit={handleSave}>
      <ChannelSection
        title="Email"
        status={channelStatus(emailConfigured, emailEnabled, settings?.email.confirmed)}
        masked={settings?.email.masked}
        configured={emailConfigured}
        enabled={emailEnabled}
        onEnabledChange={setEmailEnabled}
        switchLabel="Send email alerts"
        editLabel="Edit address"
        editing={editing.email}
        onEditingChange={setChannelEditing("email")}
        field={
          <Field className="gap-2">
            <FieldLabel htmlFor={`${uid}-email`}>Email address</FieldLabel>
            <Input
              id={`${uid}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={settings?.email.masked ?? "you@example.com"}
            />
          </Field>
        }
        primaryAction={
          settings?.email.confirmed ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onSendEmailConfirmation()}
              disabled={disabled}
            >
              Send confirmation
            </Button>
          )
        }
        onRemove={() =>
          void onSave({ email: null, emailEnabled: false, discordEnabled, smsEnabled })
        }
        removeDisabled={disabled}
      />

      <Separator />

      <ChannelSection
        title="Discord"
        status={channelStatus(discordConfigured, discordEnabled)}
        masked={settings?.discordWebhook.masked}
        configured={discordConfigured}
        enabled={discordEnabled}
        onEnabledChange={setDiscordEnabled}
        switchLabel="Send Discord alerts"
        editLabel="Edit webhook"
        editing={editing.discord}
        onEditingChange={setChannelEditing("discord")}
        field={
          <Field className="gap-2">
            <FieldLabel htmlFor={`${uid}-discord`}>Channel webhook URL</FieldLabel>
            <Input
              id={`${uid}-discord`}
              type="url"
              value={discordWebhook}
              onChange={(event) => setDiscordWebhook(event.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
            />
          </Field>
        }
        primaryAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onTestDiscord()}
            disabled={disabled}
          >
            Send test
          </Button>
        }
        onRemove={() =>
          void onSave({ discordWebhook: null, discordEnabled: false, emailEnabled, smsEnabled })
        }
        removeDisabled={disabled}
      />

      <Separator />

      <ChannelSection
        title="SMS"
        status={channelStatus(phoneConfigured, smsEnabled, settings?.phone.confirmed)}
        masked={settings?.phone.masked}
        configured={phoneConfigured}
        enabled={smsEnabled}
        onEnabledChange={setSmsEnabled}
        switchLabel="Send SMS alerts"
        editLabel="Edit number"
        editing={editing.sms}
        onEditingChange={setChannelEditing("sms")}
        field={
          <Field className="gap-2">
            <FieldLabel htmlFor={`${uid}-phone`}>Phone number</FieldLabel>
            <Input
              id={`${uid}-phone`}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={settings?.phone.masked ?? "+14155552671"}
              className="tabular"
            />
          </Field>
        }
        primaryAction={
          settings?.phone.confirmed ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onSendSmsConfirmation()}
              disabled={disabled}
            >
              Send code
            </Button>
          )
        }
        onRemove={() =>
          void onSave({ phone: null, smsEnabled: false, discordEnabled, emailEnabled })
        }
        removeDisabled={disabled}
        extra={
          phoneConfigured && !settings?.phone.confirmed ? (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={`${uid}-sms-code`}>Confirmation code</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={`${uid}-sms-code`}
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="max-w-40 font-mono tabular"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleConfirmSms()}
                  disabled={disabled || !smsCode.trim()}
                >
                  Confirm code
                </Button>
              </div>
            </div>
          ) : null
        }
      />

      <div className="border-t pt-5 empty:hidden">
        <PushChannelCard />
      </div>

      <Separator />

      <PreferenceSection
        title="What each channel gets"
        description="Turn off a box to stop that kind of alert on that channel."
      >
        <AlertTypeMatrix preferences={preferences} onChange={setPreferences} disabled={disabled} />
      </PreferenceSection>

      <Separator />

      <PreferenceSection
        title="Sale reminders"
        description="Sources are checked once a day, so a reminder can come earlier than this. It always gives the exact start time."
      >
        <Field className="gap-2">
          <FieldLabel htmlFor={`${uid}-lead`}>Remind me</FieldLabel>
          <Select
            value={String(preferences.reminderLeadMinutes)}
            onValueChange={(value) =>
              setPreferences((current) => ({ ...current, reminderLeadMinutes: Number(value) }))
            }
            disabled={disabled}
          >
            <SelectTrigger id={`${uid}-lead`} className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_LEAD_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {leadLabel(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </PreferenceSection>

      <Separator />

      <section className="flex flex-col gap-3 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-sm leading-5 font-medium text-foreground">Quiet hours</h3>
            <p className="text-[13px] leading-5 text-muted-foreground">
              Alerts that come in during quiet hours wait and go out when they end. Times are in{" "}
              {zoneLabel}.
            </p>
          </div>
          <Switch
            checked={preferences.quietHours.enabled}
            onCheckedChange={(value) => setQuietHours({ enabled: value })}
            aria-label="Hold alerts during quiet hours"
            className="mt-0.5"
          />
        </div>
        {preferences.quietHours.enabled ? (
          <div className="flex gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor={`${uid}-quiet-start`}>From</FieldLabel>
              <Input
                id={`${uid}-quiet-start`}
                type="time"
                step={60}
                value={preferences.quietHours.start}
                onChange={(event) => setQuietHours({ start: event.target.value })}
                className="w-32 tabular"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor={`${uid}-quiet-end`}>Until</FieldLabel>
              <Input
                id={`${uid}-quiet-end`}
                type="time"
                step={60}
                value={preferences.quietHours.end}
                onChange={(event) => setQuietHours({ end: event.target.value })}
                className="w-32 tabular"
              />
            </Field>
          </div>
        ) : null}
      </section>

      <Separator />

      <section className="flex items-start justify-between gap-4 py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm leading-5 font-medium text-foreground">Daily email digest</h3>
          <p className="text-[13px] leading-5 text-muted-foreground">
            One email a day with your alerts, instead of one email per alert. Discord, SMS, and
            push still arrive one at a time.
          </p>
        </div>
        <Switch
          checked={preferences.emailDigest}
          onCheckedChange={(value) =>
            setPreferences((current) => ({ ...current, emailDigest: value }))
          }
          aria-label="Send email alerts as a daily digest"
          className="mt-0.5"
        />
      </section>

      {/* -bottom-6 cancels the panel's bottom padding so nothing shows under the bar. */}
      <div className="sticky -bottom-6 -mx-6 -mb-6 mt-auto flex items-center justify-between gap-4 border-t bg-popover px-6 py-4">
        <p className="text-[13px] leading-5 text-muted-foreground">
          Changes apply when you save
        </p>
        <Button type="submit" disabled={disabled} className="shrink-0">
          {saving ? "Saving…" : "Save alert settings"}
        </Button>
      </div>
    </form>
  );
}
