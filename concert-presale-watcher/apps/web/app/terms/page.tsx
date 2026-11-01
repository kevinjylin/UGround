import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter, AuthHeader } from "../components/AuthFrame";

export const metadata: Metadata = { title: "Terms" };

const linkClass =
  "rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function TermsPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AuthHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:py-16">
        <h1 className="font-display text-[44px] leading-[1.05]">Terms</h1>
        <p className="mt-2 text-[13px] leading-5 text-faint">Last updated June 9, 2026</p>
        <div className="mt-8 flex flex-col gap-4 text-sm leading-[22px] text-muted-foreground">
          <p>
            UGround provides informational event monitoring and does not sell tickets or guarantee
            availability, pricing, source uptime, delivery time, or third-party data accuracy.
          </p>
          <p>
            Use the service lawfully. Do not bypass rate limits, access another user&apos;s data,
            or abuse event and notification providers. Source availability can change with API and
            partnership terms.
          </p>
          <p>
            Contact{" "}
            <a href="mailto:support@uground.app" className={linkClass}>
              support@uground.app
            </a>{" "}
            with questions.
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
