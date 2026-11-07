import { Link } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChartSpline,
  ChevronRight,
  History,
  Repeat2,
  TimerOff,
} from "lucide-react";

const moreViews = [
  {
    to: "/recurring",
    label: "Recurring",
    description: "Your daily, weekly, and monthly routines in one place.",
    icon: Repeat2,
  },
  {
    to: "/plan",
    search: { period: "month", project: "all", page: 1 },
    label: "This month",
    description: "Planned finishes and deadlines by the end of this month.",
    icon: CalendarDays,
  },
  {
    to: "/plan",
    search: { period: "year", project: "all", page: 1 },
    label: "This year",
    description: "Keep longer plans and yearly commitments in view.",
    icon: CalendarDays,
  },
  {
    to: "/plan",
    search: { period: "custom", project: "all", page: 1 },
    label: "Custom period",
    description: "Choose any date range, with project, label, and priority filters.",
    icon: CalendarDays,
  },
  {
    to: "/jobs",
    label: "Timed sessions",
    description: "Timed work with a start, duration, and extra time to finish.",
    icon: BriefcaseBusiness,
  },
  {
    to: "/unscheduled",
    label: "Long term",
    description: "Tasks due after this week and tasks without a deadline.",
    icon: TimerOff,
  },
  {
    to: "/history",
    label: "History",
    description: "Recently completed tasks and recurrence snapshots.",
    icon: History,
  },
  {
    to: "/activity",
    label: "Last 14 days",
    description: "Daily completions, priority mix, and on-time performance.",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    to: "/all-time-activity",
    label: "All-time activity",
    description: "Weekly completion and on-time trends across available history.",
    icon: ChartSpline,
  },
] as const;

export function MorePage() {
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-semibold">More</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Focused task views and activity insights.
        </p>
      </header>
      <nav aria-label="More views" className="overflow-hidden rounded-lg border bg-card">
        {moreViews.map(({ to, label, description, icon: Icon, ...view }) => (
          <Link
            key={label}
            to={to}
            {...view}
            className="group flex min-h-16 items-center gap-3 border-b px-3 py-3 outline-none last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight
              className="ml-auto size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
    </section>
  );
}
