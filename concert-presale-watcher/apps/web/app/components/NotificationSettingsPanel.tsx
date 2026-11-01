"use client";

import { FormEvent, useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { StatusDot } from "@/components/status-dot";
import type { Tone } from "@/lib/eventDisplay";
import type { NotificationSettingsResponse } from "@/lib/types";

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
  }) => Promise<void>;
  onTestDiscord: () => Promise<void>;
  onSendEmailConfirmation: () => Promise<void>;
  onSendSmsConfirmation: () => Promise<void>;
  onConfirmSms: (code: string) => Promise<void>;
}

type NotificationChannel = "discord" | "email" | "sms";

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

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-auto flex items-center justify-between gap-4 border-t bg-popover px-6 py-4">
        <p className="text-[13px] leading-5 text-muted-foreground">
          Switches and new addresses apply when you save
        </p>
        <Button type="submit" disabled={disabled} className="shrink-0">
          {saving ? "Saving…" : "Save alert settings"}
        </Button>
      </div>
    </form>
  );
}
