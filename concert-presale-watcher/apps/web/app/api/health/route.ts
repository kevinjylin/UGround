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
    authConfigured: {
      credentials: hasSupabaseConfig() || Boolean(env.authUsername && env.authPassword),
      google: Boolean(env.googleClientId && env.googleClientSecret),
      secret: Boolean(env.authSecret),
    },
    alertChannelsConfigured: {
      discord: true,
      email: Boolean(env.resendApiKey && env.alertFromEmail),
      sms: Boolean(
        env.twilioAccountSid && env.twilioAuthToken && env.twilioFromPhone,
      ),
    },
  });
}
