import { z } from "zod";
import {
  ALERT_CHANNELS,
  ALL_ALERT_TYPES,
  type AlertPreferences,
  formatClockTime,
  isValidTimeZone,
  parseClockTime,
  REMINDER_LEAD_OPTIONS,
  toAlertPreferences,
} from "./alertPreferences";
import { isValidDiscordWebhookUrl } from "./discordWebhook";
import { logger } from "./logger";
import {
  createEmailConfirmationToken,
  createExpiry,
  createSmsConfirmationCode,
  decryptSecret,
  encryptSecret,
  hashConfirmationValue,
} from "./notificationCrypto";
import {
  getNotificationSettings,
  consumeEmailConfirmationToken,
  consumeSmsConfirmationCode,
  upsertNotificationSettings,
} from "./supabase";
import {
  getNotificationPreferences,
  releaseDigestDeliveries,
  upsertNotificationPreferences,
} from "./store/alertStore";
import type {
  AlertPreferencesResponse,
  NotificationSettingsRecord,
  NotificationSettingsResponse,
} from "./types";

interface UpdateNotificationSettingsInput {
  discordWebhook?: unknown;
  discordEnabled?: unknown;
  email?: unknown;
  emailEnabled?: unknown;
  phone?: unknown;
  smsEnabled?: unknown;
}

export interface ResolvedNotificationSettings {
  discordWebhook: string | null;
  email: string | null;
  phone: string | null;
  discordEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  emailConfirmed: boolean;
  smsConfirmed: boolean;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

const normalizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Notification destination values must be strings.");
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error("Notification enabled values must be booleans.");
  }

  return value;
};

const maskDiscordWebhook = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const parts = value.split("/");
  const id = parts.at(-2) ?? "";
  return `Discord webhook ...${id.slice(-4)}`;
};

const maskEmail = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return "Saved email";
  }

  return `${local.slice(0, 2)}...@${domain}`;
};

const maskPhone = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  return `...${value.slice(-4)}`;
};

const decryptSettings = (
  record: NotificationSettingsRecord | null,
): ResolvedNotificationSettings => {
  return {
    discordWebhook: decryptSecret(record?.discord_webhook_encrypted ?? null),
    email: decryptSecret(record?.email_encrypted ?? null),
    phone: decryptSecret(record?.phone_encrypted ?? null),
    discordEnabled: Boolean(record?.discord_enabled),
    emailEnabled: Boolean(record?.email_enabled),
    smsEnabled: Boolean(record?.sms_enabled),
    emailConfirmed: Boolean(record?.email_confirmed_at),
    smsConfirmed: Boolean(record?.sms_confirmed_at),
  };
};

export const toNotificationSettingsResponse = (
  settings: ResolvedNotificationSettings,
): NotificationSettingsResponse => {
  return {
    discordWebhook: {
      configured: Boolean(settings.discordWebhook),
      enabled: settings.discordEnabled,
      masked: maskDiscordWebhook(settings.discordWebhook),
    },
    email: {
      configured: Boolean(settings.email),
      enabled: settings.emailEnabled,
      confirmed: settings.emailConfirmed,
      masked: maskEmail(settings.email),
    },
    phone: {
      configured: Boolean(settings.phone),
      enabled: settings.smsEnabled,
      confirmed: settings.smsConfirmed,
      masked: maskPhone(settings.phone),
    },
  };
};

export const getResolvedNotificationSettings = async (
  userId: string,
): Promise<ResolvedNotificationSettings> => {
  return decryptSettings(await getNotificationSettings(userId));
};

export const toAlertPreferencesResponse = (
  preferences: AlertPreferences,
): AlertPreferencesResponse => ({
  timeZone: preferences.timeZone,
  reminderLeadMinutes: preferences.reminderLeadMinutes,
  quietHours: {
    enabled: preferences.quietHours.enabled,
    start: formatClockTime(preferences.quietHours.start),
    end: formatClockTime(preferences.quietHours.end),
  },
  emailDigest: preferences.emailDigest,
  channelAlertTypes: preferences.channelAlertTypes,
});

const loadPreferences = async (userId: string): Promise<AlertPreferences> =>
  toAlertPreferences(
    await getNotificationPreferences(userId).catch((error: unknown) => {
      logger.error("[notification-settings] preference lookup failed; using defaults", error);
      return null;
    }),
  );

export const getNotificationSettingsResponse = async (
  userId: string,
): Promise<NotificationSettingsResponse> => {
  const [settings, preferences] = await Promise.all([
    getResolvedNotificationSettings(userId),
    loadPreferences(userId),
  ]);
  return {
    ...toNotificationSettingsResponse(settings),
    preferences: toAlertPreferencesResponse(preferences),
  };
};

const clockTime = z
  .string()
  .refine((value) => parseClockTime(value) !== null, "Times must look like 22:00.");

export const alertPreferencesSchema = z
  .object({
    timeZone: z
      .string()
      .max(64)
      .refine(isValidTimeZone, "Time zone must be an IANA zone like America/Chicago.")
      .nullable()
      .optional(),
    reminderLeadMinutes: z
      .number()
      .int()
      .refine(
        (value) => (REMINDER_LEAD_OPTIONS as readonly number[]).includes(value),
        "Pick one of the offered reminder times.",
      )
      .optional(),
    quietHours: z
      .object({ enabled: z.boolean(), start: clockTime, end: clockTime })
      .optional(),
    emailDigest: z.boolean().optional(),
    channelAlertTypes: z
      .partialRecord(
        z.enum(ALERT_CHANNELS),
        z.array(z.enum(ALL_ALERT_TYPES as [string, ...string[]])).max(ALL_ALERT_TYPES.length).nullable(),
      )
      .optional(),
  })
  .strict();

export type AlertPreferencesInput = z.infer<typeof alertPreferencesSchema>;

/** Save the alert preferences that were sent; leave the rest as they are. */
export const updateAlertPreferences = async (
  userId: string,
  input: AlertPreferencesInput,
): Promise<AlertPreferencesResponse> => {
  const current = await loadPreferences(userId);
  const fields: Parameters<typeof upsertNotificationPreferences>[1] = {};
  // Null means the browser didn't report one; keep what's saved.
  if (input.timeZone) fields.time_zone = input.timeZone;
  if (input.reminderLeadMinutes !== undefined) fields.reminder_lead_minutes = input.reminderLeadMinutes;
  if (input.quietHours) {
    fields.quiet_hours_enabled = input.quietHours.enabled;
    fields.quiet_hours_start = parseClockTime(input.quietHours.start) as number;
    fields.quiet_hours_end = parseClockTime(input.quietHours.end) as number;
  }
  if (input.emailDigest !== undefined) fields.email_digest = input.emailDigest;
  if (input.channelAlertTypes) {
    const merged: Record<string, string[]> = { ...current.channelAlertTypes };
    for (const [channel, types] of Object.entries(input.channelAlertTypes)) {
      // Null, or every type, means the channel gets everything.
      if (types === null || types === undefined || types.length === ALL_ALERT_TYPES.length) delete merged[channel];
      else merged[channel] = [...new Set(types)];
    }
    fields.channel_alert_types = merged;
  }
  if (Object.keys(fields).length === 0) return toAlertPreferencesResponse(current);
  const saved = toAlertPreferences(await upsertNotificationPreferences(userId, fields));
  if (current.emailDigest && !saved.emailDigest) await releaseDigestDeliveries(userId);
  return toAlertPreferencesResponse(saved);
};

export const updateNotificationSettings = async (
  userId: string,
  body: UpdateNotificationSettingsInput,
): Promise<NotificationSettingsResponse> => {
  const existing = await getNotificationSettings(userId);
  const resolved = decryptSettings(existing);
  const discordWebhook = normalizeOptionalString(body.discordWebhook);
  const email = normalizeOptionalString(body.email);
  const phone = normalizeOptionalString(body.phone);
  const discordEnabled = normalizeOptionalBoolean(body.discordEnabled);
  const emailEnabled = normalizeOptionalBoolean(body.emailEnabled);
  const smsEnabled = normalizeOptionalBoolean(body.smsEnabled);

  const input: Parameters<typeof upsertNotificationSettings>[0] = { userId };

  if (discordWebhook !== undefined) {
    if (discordWebhook === null) {
      input.discordWebhookEncrypted = null;
      input.discordEnabled = false;
    } else {
      if (!isValidDiscordWebhookUrl(discordWebhook)) {
        throw new Error("Discord webhook must be a valid Discord webhook URL.");
      }

      input.discordWebhookEncrypted = encryptSecret(discordWebhook);
      input.discordEnabled = discordEnabled ?? true;
    }
  } else if (discordEnabled !== undefined) {
    input.discordEnabled = Boolean(resolved.discordWebhook) && discordEnabled;
  }

  if (email !== undefined) {
    if (email === null) {
      input.emailEncrypted = null;
      input.emailEnabled = false;
      input.emailConfirmedAt = null;
      input.emailConfirmationHash = null;
      input.emailConfirmationExpiresAt = null;
    } else {
      const normalizedEmail = email.toLowerCase();
      if (!emailPattern.test(normalizedEmail)) {
        throw new Error("Email must be a valid email address.");
      }

      input.emailEncrypted = encryptSecret(normalizedEmail);
      input.emailEnabled = emailEnabled ?? true;

      if (normalizedEmail !== resolved.email) {
        input.emailConfirmedAt = null;
        input.emailConfirmationHash = null;
        input.emailConfirmationExpiresAt = null;
      }
    }
  } else if (emailEnabled !== undefined) {
    input.emailEnabled = Boolean(resolved.email) && emailEnabled;
  }

  if (phone !== undefined) {
    if (phone === null) {
      input.phoneEncrypted = null;
      input.smsEnabled = false;
      input.smsConfirmedAt = null;
      input.smsConfirmationHash = null;
      input.smsConfirmationExpiresAt = null;
    } else {
      if (!phonePattern.test(phone)) {
        throw new Error("Phone must use E.164 format, like +14155552671.");
      }

      input.phoneEncrypted = encryptSecret(phone);
      input.smsEnabled = smsEnabled ?? true;

      if (phone !== resolved.phone) {
        input.smsConfirmedAt = null;
        input.smsConfirmationHash = null;
        input.smsConfirmationExpiresAt = null;
      }
    }
  } else if (smsEnabled !== undefined) {
    input.smsEnabled = Boolean(resolved.phone) && smsEnabled;
  }

  const saved = await upsertNotificationSettings(input);
  return {
    ...toNotificationSettingsResponse(decryptSettings(saved)),
    preferences: toAlertPreferencesResponse(await loadPreferences(userId)),
  };
};

export const createEmailConfirmation = async (
  userId: string,
): Promise<{ email: string; token: string }> => {
  const record = await getNotificationSettings(userId);
  const settings = decryptSettings(record);

  if (!settings.email) {
    throw new Error("Add an email address before requesting confirmation.");
  }

  const token = createEmailConfirmationToken();
  await upsertNotificationSettings({
    userId,
    emailConfirmationHash: hashConfirmationValue(token),
    emailConfirmationExpiresAt: createExpiry(60),
    emailConfirmationAttempts: 0,
    confirmationSentAt: new Date().toISOString(),
  });

  return {
    email: settings.email,
    token,
  };
};

export const confirmEmailToken = async (token: string): Promise<string> => {
  const userId = await consumeEmailConfirmationToken(hashConfirmationValue(token));
  if (!userId) throw new Error("Invalid or expired email confirmation link.");
  return userId;
};

export const createSmsConfirmation = async (
  userId: string,
): Promise<{ phone: string; code: string }> => {
  const record = await getNotificationSettings(userId);
  const settings = decryptSettings(record);

  if (!settings.phone) {
    throw new Error("Add a phone number before requesting confirmation.");
  }

  const code = createSmsConfirmationCode();
  await upsertNotificationSettings({
    userId,
    smsConfirmationHash: hashConfirmationValue(code),
    smsConfirmationExpiresAt: createExpiry(10),
    smsConfirmationAttempts: 0,
    confirmationSentAt: new Date().toISOString(),
  });

  return {
    phone: settings.phone,
    code,
  };
};

export const confirmSmsCode = async (
  userId: string,
  code: string,
): Promise<NotificationSettingsResponse> => {
  const normalizedCode = code.trim();
  const confirmed = await consumeSmsConfirmationCode(
    userId,
    hashConfirmationValue(normalizedCode),
  );
  if (!confirmed) throw new Error("Invalid, expired, or locked SMS confirmation code.");
  return getNotificationSettingsResponse(userId);
};

export const getBaseAppUrl = (): string => {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error("APP_URL is required for confirmation links.");
  return new URL(configured).origin;
};
