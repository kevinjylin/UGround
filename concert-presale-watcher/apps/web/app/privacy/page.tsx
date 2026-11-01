import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter, AuthHeader } from "../components/AuthFrame";

export const metadata: Metadata = { title: "Privacy" };

const linkClass =
  "rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AuthHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:py-16">
        <h1 className="font-display text-[44px] leading-[1.05]">Privacy</h1>
        <p className="mt-2 text-[13px] leading-5 text-faint">Last updated June 9, 2026</p>
        <div className="mt-8 flex flex-col gap-4 text-sm leading-[22px] text-muted-foreground">
          <p>
            UGround stores account details, watch rules, event matches, alert history, and
            encrypted notification destinations to provide the service. Provider credentials and
            notification destinations are never exposed to browser clients.
          </p>
          <p>
            Data is processed by Supabase, Vercel, and only the notification or event providers
            needed for features you enable. UGround does not sell personal data.
          </p>
          <p>
            You can export or delete your UGround data through the account controls. Contact{" "}
            <a href="mailto:support@uground.app" className={linkClass}>
              support@uground.app
            </a>{" "}
            for privacy requests.
          </p>
        </div>
        <Link href="/" className={`mt-10 inline-block text-sm leading-5 ${linkClass}`}>
          Back to UGround
        </Link>
      </main>
      <AuthFooter />
    </div>
  );
}
