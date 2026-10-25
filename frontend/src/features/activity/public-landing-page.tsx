import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { readPublicAvailability } from "./public-activity-client";
import { PublicPageFooter } from "./public-page-footer";

export function PublicLandingPage() {
  const availability = readPublicAvailability();
  return (
    <main className="min-h-svh overflow-hidden">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 sm:px-8">
        <LandingHeader />
        <div
          className={cn(
            "grid flex-1 items-center gap-14 py-14 md:py-20",
            "md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]",
          )}
        >
          <LandingIntroduction availability={availability} />
          <LandingPurpose />
        </div>
        <PublicActivityLinks availability={availability} />
        <PublicPageFooter />
      </div>
    </main>
  );
}

function LandingHeader() {
  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b">
      <Link
        to="/"
        aria-label="Better Vikunja home"
        className="inline-flex items-center gap-3 font-semibold"
      >
        <BrandMark className="size-9" />
        <span>Better Vikunja</span>
      </Link>
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/60" />
        Deployed instance
      </p>
    </header>
  );
}

function LandingIntroduction({
  availability,
}: {
  availability: ReturnType<typeof readPublicAvailability>;
}) {
  return (
    <section className="max-w-2xl" aria-labelledby="landing-title">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Self-hosted task workspace
      </p>
      <h1
        id="landing-title"
        className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
      >
        A quieter way to keep recurring work moving.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
        This is a deployed instance of the open-source Better Vikunja client, shaped around clear
        schedules and predictable routines.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/login"
          search={{ returnTo: "/today" }}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 font-medium",
            "text-primary-foreground outline-none transition-opacity hover:opacity-90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "focus-visible:ring-offset-background",
          )}
        >
          Sign in to your workspace
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <PublicActivityAction availability={availability} />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">Your data stays in Vikunja.</p>
    </section>
  );
}

function PublicActivityAction({
  availability,
}: {
  availability: ReturnType<typeof readPublicAvailability>;
}) {
  const className =
    "inline-flex min-h-11 items-center rounded-md border px-5 font-medium outline-none hover:bg-accent " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background";
  if (availability?.activityEnabled)
    return (
      <Link to="/activity" className={className}>
        View public activity
      </Link>
    );
  if (availability?.allTimeEnabled) {
    return (
      <Link to="/all-time-activity" className={className}>
        View public activity
      </Link>
    );
  }
  return null;
}

function LandingPurpose() {
  return (
    <aside
      aria-labelledby="purpose-title"
      className="border-t pt-7 md:border-t-0 md:border-l md:pl-8 md:pt-0"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Purpose-built
      </p>
      <h2 id="purpose-title" className="mt-3 font-serif text-2xl font-semibold leading-snug">
        Less setup between intention and action.
      </h2>
      <dl className="mt-6 divide-y border-y">
        <PurposeItem title="Recurring work">
          Repeat routines without rebuilding every occurrence.
        </PurposeItem>
        <PurposeItem title="Time-aware planning">
          Plan the week around start, finish and due time.
        </PurposeItem>
        <PurposeItem title="One source of truth">Keep Vikunja as the system of record.</PurposeItem>
      </dl>
    </aside>
  );
}

function PurposeItem({ title, children }: { title: string; children: string }) {
  return (
    <div className="py-4">
      <dt className="font-medium">{title}</dt>
      <dd className="mt-1 text-sm leading-6 text-muted-foreground">{children}</dd>
    </div>
  );
}

function PublicActivityLinks({
  availability,
}: {
  availability: ReturnType<typeof readPublicAvailability>;
}) {
  if (!availability?.activityEnabled && !availability?.allTimeEnabled) return null;
  return (
    <section
      aria-labelledby="public-activity-title"
      className="flex flex-col gap-4 border-t py-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 id="public-activity-title" className="font-medium">
          Public activity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Anonymous aggregate progress from this instance.
        </p>
      </div>
      <nav
        aria-label="Public activity"
        className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium"
      >
        {availability.activityEnabled ? (
          <ActivityLink to="/activity">Last 14 days</ActivityLink>
        ) : null}
        {availability.allTimeEnabled ? (
          <ActivityLink to="/all-time-activity">All-time activity</ActivityLink>
        ) : null}
      </nav>
    </section>
  );
}

function ActivityLink({
  to,
  children,
}: {
  to: "/activity" | "/all-time-activity";
  children: string;
}) {
  return (
    <Link
      to={to}
      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {children}
    </Link>
  );
}
