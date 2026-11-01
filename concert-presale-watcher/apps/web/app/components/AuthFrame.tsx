import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { FieldSeparator } from "@/components/ui/field";
import { StageScene } from "@/components/stage-scene";
import { StatusDot } from "@/components/status-dot";
import { Ticket } from "@/components/ticket";
import type { DateParts } from "@/lib/eventDisplay";
import Logo from "./Logo";

// Fixed parts so server and client render the same sample ticket in every time zone.
const SAMPLE_DATE: DateParts = {
  month: "Dec",
  day: "4",
  weekday: "Fri",
  year: 2026,
  showYear: false,
};

export function AuthHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center px-4 md:px-8">
      <Link
        href="/"
        aria-label="UGround home"
        className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Logo size={20} />
      </Link>
    </header>
  );
}

export function AuthFooter() {
  const linkClass =
    "rounded-sm transition-colors duration-150 ease-out outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <footer className="flex h-16 shrink-0 items-center justify-center gap-6 px-4 text-[13px] text-faint">
      <Link href="/privacy" className={linkClass}>
        Privacy
      </Link>
      <Link href="/terms" className={linkClass}>
        Terms
      </Link>
      <a href="mailto:support@uground.app" className={linkClass}>
        Contact
      </a>
    </footer>
  );
}

/** Text link used inside auth copy, like "New here? Create an account". */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}

/** "or" divider between the email form and Google sign-in. */
export function AuthDivider() {
  return (
    <FieldSeparator className="my-0 text-[13px] *:data-[slot=field-separator-content]:bg-card">
      or
    </FieldSeparator>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function TicketPanel() {
  return (
    <div className="relative isolate hidden flex-col justify-end gap-6 overflow-hidden border-l bg-background p-10 md:flex">
      <StageScene
        imageClassName="object-[18%_70%]"
        className="inset-0 -z-10 [mask-image:linear-gradient(to_bottom,#000_30%,transparent_85%)]"
      />
      <Ticket size="lg" date={SAMPLE_DATE} className="shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.05)]">
        <div className="flex flex-col gap-1">
          <p className="text-base leading-6 font-medium">MJ Lenderman</p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            The Echo · Los Angeles, CA
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <StatusDot tone="positive">On sale</StatusDot>
          <p className="text-xs leading-4 text-muted-foreground">Alert sent by email and Discord</p>
        </div>
      </Ticket>
      <p className="max-w-72 text-sm leading-5 text-muted-foreground">
        Alerts for new dates, presales, and on-sales from the artists you follow
      </p>
    </div>
  );
}

interface AuthFrameProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Secondary line under the form, like a link to the other auth page. */
  footer?: ReactNode;
}

export default function AuthFrame({ title, description, children, footer }: AuthFrameProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AuthHeader />

      <main id="auth-flow" className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
        <Card className="w-full max-w-sm gap-0 overflow-hidden py-0 md:max-w-[880px]">
          {/* On phones the photo panel is hidden, so a strip of it tops the card. */}
          <div className="relative h-28 md:hidden">
            <StageScene
              imageClassName="object-[30%_80%]"
              className="inset-0 [mask-image:linear-gradient(to_bottom,#000_35%,transparent)]"
            />
          </div>
          <div className="grid md:grid-cols-2">
            <div className="relative -mt-8 flex flex-col gap-6 p-6 pt-0 md:mt-0 md:p-10">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-[40px] leading-[1.05]">{title}</h1>
                {description ? (
                  <p className="text-sm leading-5 text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {children}
              {footer ? (
                <p className="text-sm leading-5 text-muted-foreground">{footer}</p>
              ) : null}
            </div>
            <TicketPanel />
          </div>
        </Card>
      </main>

      <AuthFooter />
    </div>
  );
}
