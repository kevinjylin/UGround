import { env } from "./env";
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

const sendDiscordAlert = async (message: string): Promise<boolean> => {
  if (!env.discordWebhookUrl) {
    return false;
  }

  const response = await fetch(env.discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: message,
    }),
    cache: "no-store",
  });

  return response.ok;
};

const sendEmailAlert = async (subject: string, message: string): Promise<boolean> => {
  if (!env.resendApiKey || !env.alertFromEmail || !env.alertToEmail) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.alertFromEmail,
      to: [env.alertToEmail],
      subject,
      text: message,
    }),
    cache: "no-store",
  });

  return response.ok;
};

const sendSmsAlert = async (message: string): Promise<boolean> => {
  if (
    !env.twilioAccountSid ||
    !env.twilioAuthToken ||
    !env.twilioFromPhone ||
    !env.twilioToPhone
  ) {
    return false;
  }

  const basic = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: env.twilioFromPhone,
      To: env.twilioToPhone,
      Body: message,
    }),
    cache: "no-store",
  });

  return response.ok;
};

export const deliverAlert = async (alertType: AlertType, event: EventRecord): Promise<DeliveryResult> => {
  const message = formatAlertMessage(alertType, event);
  const subject = `Concert Watch Alert: ${event.artist_name}`;

  const channels: string[] = [];
  const errors: string[] = [];

  try {
    if (await sendDiscordAlert(message)) {
      channels.push("discord");
    }
  } catch (error) {
    errors.push(`discord: ${(error as Error).message}`);
  }

  try {
    if (await sendEmailAlert(subject, message)) {
      channels.push("email");
    }
  } catch (error) {
    errors.push(`email: ${(error as Error).message}`);
  }

  try {
    if (await sendSmsAlert(message)) {
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
