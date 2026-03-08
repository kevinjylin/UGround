import { NextResponse } from "next/server";
import { env, hasSupabaseConfig } from "../../../lib/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    databaseConfigured: hasSupabaseConfig(),
    sourceKeysConfigured: {
      ticketmaster: Boolean(env.ticketmasterApiKey),
      eventbrite: Boolean(env.eventbriteToken),
      spotify: Boolean(env.spotifyClientId && env.spotifyClientSecret),
    },
    alertChannelsConfigured: {
      discord: Boolean(env.discordWebhookUrl),
      email: Boolean(env.resendApiKey && env.alertFromEmail && env.alertToEmail),
      sms: Boolean(
        env.twilioAccountSid && env.twilioAuthToken && env.twilioFromPhone && env.twilioToPhone,
      ),
    },
  });
}
