import {
  type AlertChannel,
  type AlertPreferences,
  channelWantsAlert,
  quietHoursEndAt,
  toAlertPreferences,
} from "./alertPreferences";
import {
  type AlertContent,
  buildAlertContent,
  buildAlertEmail,
  buildDiscordMessage,
  buildPushPayload,
  buildSmsMessage,
  buildStoredMessage,
} from "./alertMessages";
import { logger } from "./logger";
import { createUnsubscribeToken } from "./notificationCrypto";
import { sendDiscordMessage, sendEmailMessage, sendSmsMessage } from "./notificationDelivery";
import {
  getBaseAppUrl,
  getResolvedNotificationSettings,
  type ResolvedNotificationSettings,
} from "./notificationSettings";
import {
  getNotificationPreferences,
  getVenueTime,
  holdDelivery,
  recordDeliveryOutcome,
  updateAlertSummary,
} from "./store/alertStore";
import { createAlertWithDeliveries } from "./supabase";
import type { AlertType, EventRecord } from "./types";
import { hasPushSubscription, sendPushToUser } from "./webPush";

export interface DeliveryResult {
  channels: string[];
  held: string[];
  errors: string[];
}

export interface DeliveryContext {
  userId: string;
  settings: ResolvedNotificationSettings;
  preferences: AlertPreferences;
  hasPush: boolean;
}

export const loadDeliveryContext = async (userId: string): Promise<DeliveryContext> => {
  const [settings, preferences, hasPush] = await Promise.all([
    getResolvedNotificationSettings(userId),
    getNotificationPreferences(userId)
      .catch((error: unknown) => {
        logger.error("[alerts] preference lookup failed; using defaults", error);
        return null;
      })
      .then(toAlertPreferences),
    hasPushSubscription(userId).catch((error: unknown) => {
      logger.error("[alerts] push subscription lookup failed", error);
      return false;
    }),
  ]);
  return { userId, settings, preferences, hasPush };
};

/** The channel has a confirmed, switched-on destination. */
export const isChannelReady = (context: DeliveryContext, channel: AlertChannel): boolean => {
  const { settings } = context;
  if (channel === "discord") return settings.discordEnabled && Boolean(settings.discordWebhook);
  if (channel === "email") return settings.emailEnabled && settings.emailConfirmed && Boolean(settings.email);
  if (channel === "sms") return settings.smsEnabled && settings.smsConfirmed && Boolean(settings.phone);
  return context.hasPush;
};

/** Channels that are set up and that the user wants this alert type on. */
export const eligibleChannels = (context: DeliveryContext, alertType?: AlertType): AlertChannel[] =>
  (["discord", "email", "sms", "push"] as const).filter(
    (channel) =>
      isChannelReady(context, channel) &&
      (!alertType || channelWantsAlert(context.preferences, channel, alertType)),
  );

export const getEligibleAlertChannels = async (
  userId: string,
  alertType?: AlertType,
): Promise<AlertChannel[]> => eligibleChannels(await loadDeliveryContext(userId), alertType);

/** Build the readable content for an alert at send time. */
export const renderAlertContent = async (
  alert: { alert_type: AlertType; payload?: Record<string, unknown> | null },
  event: EventRecord,
  preferences: AlertPreferences,
  now = new Date(),
): Promise<AlertContent> => {
  const venueTime =
    event.source_slug === "ticketmaster"
      ? await getVenueTime(event.id).catch((error: unknown) => {
          logger.error("[alerts] venue time lookup failed", error);
          return null;
        })
      : null;
  return buildAlertContent({
    alertType: alert.alert_type,
    event,
    payload: alert.payload ?? null,
    userTimeZone: preferences.timeZone,
    venueTime,
    now,
  });
};

const appOrigin = (): string | null => {
  try {
    return getBaseAppUrl();
  } catch {
    return null;
  }
};

export const unsubscribeUrlFor = (userId: string): string => {
  const origin = getBaseAppUrl();
  const url = new URL("/api/notification-settings/unsubscribe", origin);
  url.searchParams.set("token", createUnsubscribeToken(userId));
  return url.toString();
};

export const listUnsubscribeHeaders = (unsubscribeUrl: string): Record<string, string> => ({
  "List-Unsubscribe": `<${unsubscribeUrl}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/** Send one alert on one channel. Throws when the provider errors. */
export const sendToChannel = async (
  channel: AlertChannel,
  content: AlertContent,
  context: DeliveryContext,
): Promise<boolean> => {
  if (!isChannelReady(context, channel)) return false;
  const { settings } = context;
  if (channel === "discord") {
    return sendDiscordMessage(settings.discordWebhook as string, buildDiscordMessage(content));
  }
  if (channel === "email") {
    const unsubscribeUrl = unsubscribeUrlFor(context.userId);
    const origin = appOrigin();
    const email = buildAlertEmail(content, {
      unsubscribeUrl,
      manageUrl: origin ? `${origin}/dashboard` : null,
    });
    return sendEmailMessage(settings.email as string, email.subject, email.text, {
      html: email.html,
      headers: listUnsubscribeHeaders(unsubscribeUrl),
    });
  }
  if (channel === "sms") {
    return sendSmsMessage(settings.phone as string, buildSmsMessage(content));
  }
  const origin = appOrigin();
  return sendPushToUser(context.userId, buildPushPayload(content, origin ? `${origin}/dashboard` : null));
};

/** Why a delivery can't go out right now, if it can't. */
export const holdFor = (
  channel: AlertChannel,
  context: DeliveryContext,
  now: Date,
): { reason: "quiet_hours" | "digest"; until: Date | null } | null => {
  if (channel === "email" && context.preferences.emailDigest) return { reason: "digest", until: null };
  const quietEnd = quietHoursEndAt(now, context.preferences);
  return quietEnd ? { reason: "quiet_hours", until: quietEnd } : null;
};

/**
 * Deliver a just-created alert on its channels: send now, or hold for quiet
 * hours or the daily digest. Delivery rows and the alert summary are updated.
 */
export const deliverNewAlert = async (input: {
  alertId: string;
  alertType: AlertType;
  payload: Record<string, unknown>;
  event: EventRecord;
  channels: AlertChannel[];
  context?: DeliveryContext;
  now?: Date;
}): Promise<DeliveryResult> => {
  const now = input.now ?? new Date();
  const context = input.context ?? (await loadDeliveryContext(input.event.user_id));
  const result: DeliveryResult = { channels: [], held: [], errors: [] };
  if (input.channels.length === 0) {
    await updateAlertSummary(input.alertId, [], "sent");
    return result;
  }
  let content: AlertContent | null = null;
  for (const channel of input.channels) {
    const hold = holdFor(channel, context, now);
    if (hold) {
      await holdDelivery(input.alertId, channel, hold.reason, hold.until);
      result.held.push(channel);
      continue;
    }
    try {
      content ??= await renderAlertContent(
        { alert_type: input.alertType, payload: input.payload },
        input.event,
        context.preferences,
        now,
      );
      const sent = await sendToChannel(channel, content, context);
      if (sent) {
        result.channels.push(channel);
        await recordDeliveryOutcome(input.alertId, channel, { sent: true });
      } else {
        const error = `${channel}: provider rejected the message`;
        result.errors.push(error);
        await recordDeliveryOutcome(input.alertId, channel, { sent: false, error });
      }
    } catch (error) {
      const message = `${channel}: ${(error as Error).message}`;
      result.errors.push(message);
      await recordDeliveryOutcome(input.alertId, channel, { sent: false, error: message });
    }
  }
  const status =
    result.errors.length > 0
      ? result.channels.length > 0
        ? "partial"
        : "failed"
      : result.channels.length === 0
        ? "pending"
        : "sent";
  await updateAlertSummary(input.alertId, result.channels, status);
  return result;
};

export type RetryOutcome =
  | { kind: "sent" }
  | { kind: "failed"; error: string }
  | { kind: "held"; reason: "quiet_hours" | "digest"; until: Date | null }
  | { kind: "dropped"; reason: string };

/** Send a queued delivery (a retry or a quiet-hours hold that has ended). */
export const deliverQueuedAlert = async (
  channel: AlertChannel,
  alert: { alert_type: AlertType; payload?: Record<string, unknown> | null },
  event: EventRecord,
  now = new Date(),
): Promise<RetryOutcome> => {
  if (event.user_state === "hidden") return { kind: "dropped", reason: "The show is hidden." };
  const context = await loadDeliveryContext(event.user_id);
  if (!isChannelReady(context, channel)) {
    return { kind: "dropped", reason: `${channel} is no longer set up.` };
  }
  const hold = holdFor(channel, context, now);
  if (hold) return { kind: "held", ...hold };
  const content = await renderAlertContent(alert, event, context.preferences, now);
  const sent = await sendToChannel(channel, content, context);
  return sent ? { kind: "sent" } : { kind: "failed", error: "Provider rejected the retry." };
};

/**
 * Create an alert through the idempotent RPC and deliver it. Returns false
 * when an alert with this key already exists or the show is hidden.
 */
export const createAndDeliverAlert = async (input: {
  event: EventRecord;
  alertType: AlertType;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  now?: Date;
}): Promise<boolean> => {
  const { event, alertType } = input;
  if (event.user_state === "hidden") return false;
  const now = input.now ?? new Date();
  const context = await loadDeliveryContext(event.user_id);
  const channels = eligibleChannels(context, alertType);
  const payload = {
    source: event.source_slug,
    source_event_id: event.source_event_id,
    ...(input.payload ?? {}),
  };
  const content = buildAlertContent({
    alertType,
    event,
    payload,
    userTimeZone: context.preferences.timeZone,
    now,
  });
  const result = await createAlertWithDeliveries({
    userId: event.user_id,
    eventId: event.id,
    alertType,
    message: buildStoredMessage(content),
    payload,
    idempotencyKey: input.idempotencyKey,
    channels,
  });
  if (!result.created) {
    logger.info(`[alerts] skipping duplicate alert ${input.idempotencyKey}`);
    return false;
  }
  await deliverNewAlert({
    alertId: result.alertId,
    alertType,
    payload,
    event,
    channels,
    context,
    now,
  });
  return true;
};
