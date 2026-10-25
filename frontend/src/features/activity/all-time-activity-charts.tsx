import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActivityChartViewport } from "./activity-chart-viewport";
import { activityChartLayout, PriorityChart } from "./activity-charts";
import { ActivityOnTimeChart } from "./activity-on-time-chart";
import { ActivityPriorityFilter, allActivityPriorities } from "./activity-priority-filter";
import type { ActivityWeekView, AllTimeActivityView } from "./activity-view-model";
import { activityWeekLabel } from "./activity-week-label";
import { filterAllTimePriorities } from "./all-time-priorities";

const windowWeeks = 13;

export function AllTimeActivityCharts({
  activity,
  filterable = true,
}: {
  activity: AllTimeActivityView;
  filterable?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(allActivityPriorities);
  const filtered = filterable ? filterAllTimePriorities(activity, selected) : activity;
  const end = Math.max(0, activity.weeks.length - offset);
  const weeks = filtered.weeks.slice(Math.max(0, end - windowWeeks), end);
  const lastWeek = weeks.at(-1);
  return (
    <>
      {filterable ? <ActivityPriorityFilter selected={selected} onChange={setSelected} /> : null}
      <nav aria-label="Activity week range" className="flex min-h-10 flex-wrap items-center gap-2">
        {filterable ? (
          <Button
            variant="outline"
            disabled={end <= windowWeeks}
            onClick={() => setOffset(offset + windowWeeks)}
          >
            Earlier weeks
          </Button>
        ) : null}
        <span
          className="order-last w-full text-sm tabular-nums sm:order-none sm:w-auto"
          aria-live="polite"
        >
          {lastWeek
            ? `${weeks[0]?.date} – ${activityWeekLabel(lastWeek.date).endDate}`
            : "No completed weeks"}
        </span>
        {filterable ? (
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - windowWeeks))}
          >
            Later weeks
          </Button>
        ) : null}
      </nav>
      <ActivityOnTimeChart days={weeks} summaryDays={filtered.weeks} cadence="week" />
      <WeeklyCompletions weeks={weeks} total={filtered.total} />
      <PriorityChart activity={filtered} />
    </>
  );
}

function WeeklyCompletions({
  weeks,
  total,
}: {
  weeks: readonly ActivityWeekView[];
  total: number;
}) {
  const maximum = Math.max(1, ...weeks.map((week) => week.count));
  return (
    <section
      className={`${activityChartLayout.daily} border bg-card p-4 sm:p-6`}
      aria-labelledby="weekly-title"
    >
      <h2 id="weekly-title" className="font-semibold">
        {total} tasks completed · All time
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Week starting Monday; browse 13 weeks at a time.
      </p>
      {weeks.length === 0 ? <p className="mt-4">No completed tasks.</p> : null}
      <ActivityChartViewport label="Scrollable weekly completions chart">
        <ol
          aria-label="Weekly completions"
          className="grid min-w-180 grid-flow-col auto-cols-fr gap-1"
        >
          {weeks.map((week) => (
            <li
              key={week.date}
              className="flex min-w-0 flex-col items-center gap-2 text-xs tabular-nums"
            >
              <svg
                viewBox="0 0 24 100"
                className="h-36 w-full"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <rect
                  x="4"
                  y={100 - (week.count / maximum) * 100}
                  width="16"
                  height={(week.count / maximum) * 100}
                  rx="2"
                  className="fill-primary"
                />
              </svg>
              <time
                dateTime={week.date}
                title={activityWeekLabel(week.date).range}
                className="flex h-8 flex-col items-center whitespace-nowrap leading-4 text-muted-foreground"
              >
                <span>{activityWeekLabel(week.date).start}</span>
                <span>– {activityWeekLabel(week.date).end}</span>
              </time>
              <span>{week.count}</span>
            </li>
          ))}
        </ol>
      </ActivityChartViewport>
    </section>
  );
}
