import { sendDiscordMessage, sendEmailMessage, sendSmsMessage } from "./notificationDelivery";
import { getResolvedNotificationSettings } from "./notificationSettings";
import type { AlertType, EventRecord } from "./types";

export interface DeliveryResult {
  channels: string[];
  errors: string[];
}

const formatAlertMessage = (alertType: AlertType, event: EventRecord): string => {
  const pieces = [
    `[${alertType}]`,
    event.artist_name,
    event.title,
    event.city ?? "Unknown city",
    event.start_time ? new Date(event.start_time).toLocaleString() : "Unknown time",
  ];

  return `${pieces.join(" | ")} | ${event.ticket_url ?? "No ticket URL"}`;
};

export const deliverAlert = async (alertType: AlertType, event: EventRecord): Promise<DeliveryResult> => {
  const message = formatAlertMessage(alertType, event);
  const subject = `Concert Watch Alert: ${event.artist_name}`;
  const settings = await getResolvedNotificationSettings(event.user_id);

  const channels: string[] = [];
  const errors: string[] = [];

  try {
    if (
      settings.discordEnabled &&
      settings.discordWebhook &&
      (await sendDiscordMessage(settings.discordWebhook, message))
    ) {
      channels.push("discord");
    }
  } catch (error) {
    errors.push(`discord: ${(error as Error).message}`);
  }

  try {
    if (
      settings.emailEnabled &&
      settings.emailConfirmed &&
      settings.email &&
      (await sendEmailMessage(settings.email, subject, message))
    ) {
      channels.push("email");
    }
  } catch (error) {
    errors.push(`email: ${(error as Error).message}`);
  }

  try {
    if (
      settings.smsEnabled &&
      settings.smsConfirmed &&
      settings.phone &&
      (await sendSmsMessage(settings.phone, message))
    ) {
      channels.push("sms");
    }
  } catch (error) {
    errors.push(`sms: ${(error as Error).message}`);
  }

  return {
    channels,
    errors,
  };
};
