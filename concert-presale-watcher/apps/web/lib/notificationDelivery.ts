import { isValidDiscordWebhookUrl } from "./discordWebhook";
import { env } from "./env";
import { logger } from "./logger";

/** Plain text, or a message with embeds (see buildDiscordMessage). */
export type DiscordBody = string | { content: string; embeds?: unknown[] };

export const sendDiscordMessage = async (webhookUrl: string, message: DiscordBody): Promise<boolean> => {
  // Defense in depth: the URL is validated at input time, but legacy DB rows
  // or future code paths could still hand us an unvetted URL. Refusing here
  // means an attacker can never get the server to fetch an arbitrary host.
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    logger.error("[discord] refusing to send to non-allowlisted webhook URL");
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      typeof message === "string"
        ? { content: message }
        : { ...message, allowed_mentions: { parse: [] } },
    ),
    cache: "no-store",
  });

  return response.ok;
};

export const sendEmailMessage = async (
  to: string,
  subject: string,
  message: string,
  options: { html?: string; headers?: Record<string, string> } = {},
): Promise<boolean> => {
  if (!env.resendApiKey || !env.alertFromEmail) {
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
      to: [to],
      subject,
      text: message,
      ...(options.html ? { html: options.html } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    }),
    cache: "no-store",
  });

  return response.ok;
};

export const sendSmsMessage = async (to: string, message: string): Promise<boolean> => {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFromPhone) {
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
      To: to,
      Body: message,
    }),
    cache: "no-store",
  });

  return response.ok;
};
