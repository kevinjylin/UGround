import { env } from "./env";

export const sendDiscordMessage = async (webhookUrl: string, message: string): Promise<boolean> => {
  const response = await fetch(webhookUrl, {
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

export const sendEmailMessage = async (
  to: string,
  subject: string,
  message: string,
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
