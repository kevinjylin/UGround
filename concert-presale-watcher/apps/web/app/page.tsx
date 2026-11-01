import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bell, ListMusic, Rss, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageScene } from "@/components/stage-scene";
import { Dot, StatusDot } from "@/components/status-dot";
import { Ticket } from "@/components/ticket";
import { cn } from "@/lib/cn";
import { dateParts, type Tone } from "@/lib/eventDisplay";
import Logo from "./components/Logo";

interface SampleChange {
  when: string;
  artist: string;
  place: string;
  /** Noon UTC so the weekday is right in every US time zone. */
  date: string;
  from?: string;
  to: string;
  tone: Tone;
  status: { label: string; tone: Tone };
  sent: string;
}

// Illustrative rows for the product preview. Labeled as sample data on the page.
const SAMPLE_FEED: SampleChange[] = [
  {
    when: "just now",
    artist: "MJ Lenderman",
    place: "The Echo · Los Angeles, CA",
    date: "2026-12-04T18:00:00Z",
    from: "Scheduled",
    to: "On sale",
    tone: "positive",
    status: { label: "On sale", tone: "positive" },
    sent: "Email, Discord",
  },
  {
    when: "4m ago",
    artist: "Slow Pulp",
    place: "9:30 Club · Washington, DC",
    date: "2027-01-03T18:00:00Z",
    to: "New show announced",
    tone: "brand",
    status: { label: "Scheduled", tone: "neutral" },
    sent: "Discord",
  },
  {
    when: "2h ago",
    artist: "Wednesday",
    place: "Lincoln Hall · Chicago, IL",
    date: "2026-12-21T18:00:00Z",
    to: "Presale Mon, Nov 2 at 10 AM",
    tone: "brand",
    status: { label: "Scheduled", tone: "neutral" },
    sent: "SMS",
  },
  {
    when: "5h ago",
    artist: "Geese",
    place: "Bowery Ballroom · New York, NY",
    date: "2026-11-22T18:00:00Z",
    from: "Nov 6",
    to: "On sale Nov 5",
    tone: "brand",
    status: { label: "Scheduled", tone: "neutral" },
    sent: "Email",
  },
  {
    when: "1d ago",
    artist: "Hotline TNT",
    place: "Empty Bottle · Chicago, IL",
    date: "2026-11-12T18:00:00Z",
    from: "On sale",
    to: "Cancelled",
    tone: "danger",
    status: { label: "Cancelled", tone: "danger" },
    sent: "Email",
  },
];

const TRIGGERS: { term: string; detail: string; tone: Tone }[] = [
  { term: "New show", detail: "A date is announced for an artist, venue, or area you follow.", tone: "brand" },
  { term: "Presale announced", detail: "A presale window shows up, with its start time and link.", tone: "brand" },
  { term: "Presale opened", detail: "The presale window starts.", tone: "positive" },
  { term: "On-sale date announced", detail: "The general on-sale time is published.", tone: "brand" },
  { term: "On sale", detail: "General on-sale starts.", tone: "positive" },
  { term: "On-sale moved earlier", detail: "The on-sale time moves up. The easiest one to miss.", tone: "brand" },
  { term: "Status changed", detail: "A show is cancelled, postponed, rescheduled, or comes off sale.", tone: "neutral" },
  { term: "Ticket link changed", detail: "The official ticket URL changes, so your saved link still works.", tone: "neutral" },
];

const SOURCES: { name: string; access: string; provides: string; enabled: boolean }[] = [
  { name: "Ticketmaster", access: "Official API", provides: "Events, presale windows, public on-sale times", enabled: true },
  { name: "Songkick", access: "Partner feed", provides: "Tour dates and cancellations", enabled: true },
  { name: "Bandsintown", access: "Partner feed", provides: "Tour dates", enabled: true },
  { name: "Eventbrite, AXS, DICE", access: "Not connected", provides: "Off until partner access is approved", enabled: false },
];

const STEPS: { title: string; body: string; specs: [string, string][] }[] = [
  {
    title: "Follow what you'd actually go to",
    body: "Add artists by name, or paste a public Spotify playlist and pick who to keep. Add a venue, or everything within a radius of your city.",
    specs: [
      ["Artist", "Wednesday"],
      ["Venue", "Empty Bottle, Chicago"],
      ["Radius", "25 mi around Chicago"],
    ],
  },
  {
    title: "UGround checks the sources",
    body: "Everything you follow is checked once a day from a shared queue. Each source reports when it last succeeded, so a stale feed never looks like a quiet one.",
    specs: [
      ["Schedule", "Once a day"],
      ["Refresh", "Moves your checks to the front of the queue"],
      ["Failures", "Retried with backoff"],
    ],
  },
  {
    title: "You hear about changes, not listings",
    body: "Each show is compared with the last check, so you get one alert per change instead of a calendar of every show in town.",
    specs: [
      ["Email", "Confirmed address"],
      ["Discord", "Any channel webhook"],
      ["SMS", "Confirmed number"],
    ],
  },
];

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

function Header() {
  return (
    <header className="relative z-10 border-b">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="UGround home" className="rounded-md">
          <Logo size={22} />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
          <a
            href="#how"
            className="hidden rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            How it works
          </a>
          <a
            href="#sources"
            className="hidden rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sources
          </a>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-foreground transition-colors hover:text-muted-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="ml-2 px-3">
            <Link href="/signup">Start watching</Link>
          </Button>
        </nav>
      </Container>
    </header>
  );
}

/** The hero's one bright element: the show that just went on sale, as a ticket. */
function HeroTicket() {
  const show = SAMPLE_FEED[0]!;
  return (
    <figure className="relative mx-auto w-full max-w-[520px] py-10 lg:mx-0 lg:ml-auto">
      <figcaption className="sr-only">
        Sample alert: MJ Lenderman at The Echo just went on sale. Sent by email and Discord.
      </figcaption>
      <div className="absolute -top-1 left-8 z-10 sm:left-12">
        <Annotation>Scheduled → On sale</Annotation>
        <span aria-hidden="true" className="ml-6 block h-6 w-px bg-foreground/20" />
      </div>
      <Ticket
        size="lg"
        date={dateParts(show.date)}
        className="-rotate-2 shadow-[0_32px_64px_-16px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.05)]"
      >
        <div className="min-w-0 pt-1">
          <p className="truncate text-[22px] leading-7 font-medium tracking-[-0.01em]">{show.artist}</p>
          <p className="mt-1 truncate text-[15px] text-muted-foreground">{show.place}</p>
        </div>
        <dl className="hidden gap-1.5 font-mono text-xs sm:grid">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Artist presale</dt>
            <dd className="text-muted-foreground">Oct 28, 10:00 AM</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">General on-sale</dt>
            <dd className="text-foreground">Oct 30, 10:00 AM</dd>
          </div>
        </dl>
        <div className="flex items-center justify-between gap-3 border-t border-dashed pt-4">
          <StatusDot tone="positive">On sale</StatusDot>
          <span className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-3 text-sm">
            Tickets
            <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
          </span>
        </div>
      </Ticket>
      <div className="absolute right-4 -bottom-1 z-10 flex flex-col items-end sm:right-8">
        <span aria-hidden="true" className="mr-6 block h-6 w-px bg-foreground/20" />
        <Annotation>Sent · email, Discord</Annotation>
      </div>
    </figure>
  );
}

function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-md border bg-card px-2.5 font-mono text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative isolate">
      {/* The crowd sits behind the ticket; the headline keeps the dark side. */}
      <StageScene
        priority
        imageClassName="object-[24%_60%] lg:object-[62%_70%]"
        className="-z-10 inset-x-0 -top-16 bottom-0 opacity-55 [mask-image:linear-gradient(to_bottom,rgb(0_0_0/0.3),#000_65%,transparent)] lg:left-[36%] lg:opacity-100 lg:[mask-image:radial-gradient(60%_62%_at_55%_52%,#000_45%,transparent)]"
      />
      <Container className="grid items-center gap-8 pt-14 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-20 lg:pb-16">
        <div className="max-w-xl">
          <h1
            id="hero-heading"
            className="font-display text-[52px] leading-[0.95] tracking-[-0.01em] text-balance sm:text-[72px] lg:text-[84px]"
          >
            Know when your artists go on sale
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-7 text-foreground/75">
            Follow artists, venues, and cities. UGround checks Ticketmaster, Songkick, and
            Bandsintown every day and alerts you by email, Discord, or SMS when a show is
            announced, a presale opens, or tickets go on sale.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-[15px]">
              <Link href="/signup">
                Start watching
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[15px]">
              <a href="#how">How it works</a>
            </Button>
          </div>
        </div>
        <HeroTicket />
      </Container>
    </section>
  );
}

/** Where UGround looks, set large like a bill of acts. */
function SourceStrip() {
  return (
    <section aria-label="Sources checked" className="border-t">
      <Container className="flex flex-col gap-3 py-10 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8 sm:py-12">
        <p className="shrink-0 text-sm text-muted-foreground">Checked every day</p>
        <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-display text-[32px] leading-tight text-foreground/90 sm:text-[44px] lg:gap-x-10">
          {SOURCES.filter((source) => source.enabled).map((source, i) => (
            <li key={source.name} className="flex items-baseline gap-6 lg:gap-10">
              {i > 0 ? (
                <span aria-hidden="true" className="size-2 translate-y-[-0.3em] rounded-full bg-brand" />
              ) : null}
              {source.name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function PreviewNav({ icon: Icon, label, active, count }: {
  icon: typeof Rss;
  label: string;
  active?: boolean;
  count?: number;
}) {
  return (
    <span
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px]",
        active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
      {count !== undefined ? <span className="ml-auto font-mono text-xs text-faint">{count}</span> : null}
    </span>
  );
}

function PreviewRow({ row }: { row: SampleChange }) {
  const date = dateParts(row.date);
  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)] items-center sm:grid-cols-[64px_minmax(0,1fr)_auto]">
      <div className="flex flex-col items-center py-4 text-center">
        <span className="text-xs text-muted-foreground">
          {date?.month}
          {date?.showYear ? ` ’${String(date.year).slice(2)}` : ""}
        </span>
        <span className="tabular font-display text-[28px] leading-8">{date?.day}</span>
        <span className="text-xs text-faint">{date?.weekday}</span>
      </div>
      <div className="min-w-0 border-l border-dashed py-4 pr-4 pl-4 sm:pl-5">
        <p className="truncate text-sm font-medium">{row.artist}</p>
        <p className="truncate text-[13px] text-muted-foreground">{row.place}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <Dot tone={row.tone} />
          {row.from ? (
            <>
              <span className="text-faint line-through decoration-faint/60">{row.from}</span>
              <ArrowRight aria-label="changed to" className="size-3.5 text-faint" />
            </>
          ) : null}
          <span>{row.to}</span>
          <span className="font-mono text-xs text-faint">{row.when}</span>
        </p>
      </div>
      <div className="hidden flex-col items-end gap-1 pr-5 sm:flex">
        <StatusDot tone={row.status.tone}>{row.status.label}</StatusDot>
        <span className="font-mono text-xs text-faint">{row.sent}</span>
      </div>
    </li>
  );
}

/** The real dashboard, drawn with sample data, rising from under the hero. */
function ProductPreview() {
  return (
    <Container className="relative">
      <div
        aria-label="Sample of the UGround feed"
        role="img"
        className="relative overflow-hidden rounded-t-2xl border border-b-0 bg-sidebar [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
      >
        <div className="flex">
          <aside aria-hidden="true" className="hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex">
            <span className="mb-3 flex h-8 items-center px-2.5">
              <Logo size={18} className="[&>span:last-child]:text-[15px]" />
            </span>
            <PreviewNav icon={Rss} label="Feed" active />
            <PreviewNav icon={ListMusic} label="Watchlist" count={6} />
            <PreviewNav icon={Bell} label="Notifications" />
            <PreviewNav icon={Settings} label="Account" />
          </aside>
          <div aria-hidden="true" className="min-w-0 flex-1 bg-background">
            <div className="flex h-12 items-center justify-between border-b px-4 sm:px-6">
              <span className="text-sm font-medium">Feed</span>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Dot tone="positive" />
                Checked 12m ago
                <span className="hidden text-faint sm:inline">· 3 of 3 sources healthy</span>
              </span>
            </div>
            <div className="px-4 py-5 sm:px-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Recent changes</span>
                <span className="font-mono text-xs text-faint">Sample data</span>
              </div>
              <ul className="divide-y border-y">
                {SAMPLE_FEED.map((row) => (
                  <PreviewRow key={row.artist} row={row} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

function SectionHeading({ id, title, lead }: { id: string; title: React.ReactNode; lead: string }) {
  return (
    <div className="max-w-md">
      <h2 id={id} className="font-display text-[40px] leading-[1.05] text-balance sm:text-[48px]">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{lead}</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-8 py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          id="how-heading"
          title={
            <>
              <span className="inline-block">You follow.</span>{" "}
              <span className="inline-block">We watch.</span>{" "}
              <span className="inline-block">You go.</span>
            </>
          }
          lead="You decide what to follow. UGround does the checking and only speaks up when something you'd act on has changed."
        />
        <ol className="divide-y border-y">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 gap-y-4 py-6 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,15rem)] sm:gap-x-8"
            >
              <span aria-hidden="true" className="tabular font-display text-[40px] leading-none text-faint sm:text-[48px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-base font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
              <dl className="col-start-2 grid content-start gap-2 text-[13px] sm:col-start-3">
                {step.specs.map(([term, detail]) => (
                  <div key={term} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                    <dt className="font-mono text-xs leading-5 text-faint">{term}</dt>
                    <dd className="text-muted-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function Triggers() {
  return (
    <section aria-labelledby="triggers-heading" className="border-t py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          id="triggers-heading"
          title="We don't list shows. We list changes."
          lead="Eight kinds of change. Shows are matched across sources, so the same show listed in two places is still one alert."
        />
        <dl className="grid border-t sm:grid-cols-2 sm:gap-x-8">
          {TRIGGERS.map((trigger) => (
            <div key={trigger.term} className="border-b py-4">
              <dt className="flex items-center gap-2.5 text-sm font-medium">
                <Dot tone={trigger.tone} />
                {trigger.term}
              </dt>
              <dd className="mt-1 pl-4 text-[13px] leading-5 text-muted-foreground">{trigger.detail}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/** A product principle from the original UGround landing page, kept as its pull quote. */
function Principle() {
  return (
    <section aria-label="Product principle" className="py-20 sm:py-28">
      <Container>
        <figure className="mx-auto max-w-5xl border-y-2 border-foreground/80 px-2 py-14 text-center sm:py-16">
          <blockquote className="font-display text-[34px] leading-[1.1] text-balance sm:text-[48px] lg:text-[56px]">
            Source freshness should be measured, visible, and honest. Not hidden behind a marketing
            promise.
          </blockquote>
          <figcaption className="mt-8 font-mono text-xs text-muted-foreground">
            UGround product principle
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}

function Sources() {
  return (
    <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-8 border-t py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          id="sources-heading"
          title="Sources"
          lead="Official APIs and approved partner feeds only. Nothing is scraped, and the dashboard shows when each source last checked in."
        />
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr className="border-b text-[13px] text-muted-foreground">
                <th scope="col" className="h-10 px-4 font-normal">Source</th>
                <th scope="col" className="h-10 px-4 font-normal">Access</th>
                <th scope="col" className="h-10 px-4 font-normal">Provides</th>
                <th scope="col" className="h-10 px-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SOURCES.map((source) => (
                <tr key={source.name} className={source.enabled ? undefined : "text-faint"}>
                  <th scope="row" className="px-4 py-3 font-medium">{source.name}</th>
                  <td className={cn("px-4 py-3", source.enabled && "text-muted-foreground")}>{source.access}</td>
                  <td className={cn("px-4 py-3", source.enabled && "text-muted-foreground")}>{source.provides}</td>
                  <td className="px-4 py-3">
                    <StatusDot tone={source.enabled ? "positive" : "muted"}>
                      {source.enabled ? "Supported" : "Off"}
                    </StatusDot>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-heading" className="border-t py-20 sm:py-28">
      <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h2
            id="closing-heading"
            className="font-display text-[48px] leading-[0.95] text-balance sm:text-[72px]"
          >
            Catch your next show
          </h2>
          <p className="mt-5 text-[15px] leading-6 text-muted-foreground">
            Add a few artists, pick where alerts go, and let it run. Free while in beta.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-5 text-[15px]">
            <Link href="/signup">
              Create an account
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[15px]">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <Container className="flex flex-col gap-4 py-8 text-[13px] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-3 text-faint">
          <Logo size={18} className="[&>span:last-child]:text-[15px]" />
          <span>© 2026</span>
        </span>
        <nav aria-label="Footer" className="flex gap-5 text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
          <a href="mailto:support@uground.app" className="transition-colors hover:text-foreground">Contact</a>
          <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
        </nav>
      </Container>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <Header />
      <main>
        <Hero />
        <ProductPreview />
        <SourceStrip />
        <HowItWorks />
        <Triggers />
        <Principle />
        <Sources />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
