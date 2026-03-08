const readEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  return value.trim();
};

export const env = {
  supabaseUrl: readEnv("SUPABASE_URL"),
  supabaseServiceKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ticketmasterApiKey: readEnv("TICKETMASTER_API_KEY"),
  eventbriteToken: readEnv("EVENTBRITE_PRIVATE_TOKEN"),
  spotifyClientId: readEnv("SPOTIFY_CLIENT_ID"),
  spotifyClientSecret: readEnv("SPOTIFY_CLIENT_SECRET"),
  defaultCity: readEnv("DEFAULT_CITY"),
  pollSecret: readEnv("POLL_SECRET"),
  discordWebhookUrl: readEnv("DISCORD_WEBHOOK_URL"),
  resendApiKey: readEnv("RESEND_API_KEY"),
  alertFromEmail: readEnv("ALERT_FROM_EMAIL"),
  alertToEmail: readEnv("ALERT_TO_EMAIL"),
  twilioAccountSid: readEnv("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: readEnv("TWILIO_AUTH_TOKEN"),
  twilioFromPhone: readEnv("TWILIO_FROM_PHONE"),
  twilioToPhone: readEnv("TWILIO_TO_PHONE"),
};

export const hasSupabaseConfig = (): boolean => {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
};

export const assertSupabaseConfig = (): void => {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
};
