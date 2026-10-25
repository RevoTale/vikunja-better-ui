import { ActivityOnTimePlot } from "./activity-on-time-plot";
import type { ActivityDayView } from "./activity-view-model";
import { activityWeekLabel } from "./activity-week-label";

type Days = readonly ActivityDayView[];
export const activityOnTimeLayout = "min-h-128 w-full rounded-lg";

export function ActivityOnTimeChart({
  days,
  summaryDays = days,
  cadence = "day",
}: {
  days: Days;
  summaryDays?: Days;
  cadence?: "day" | "week";
}) {
  const totals = summaryDays.reduce(
    (sum, day) => ({
      eligible: sum.eligible + day.completedWithDeadline,
      onTime: sum.onTime + day.completedOnTime,
    }),
    { eligible: 0, onTime: 0 },
  );
  return (
    <section
      className={`${activityOnTimeLayout} border bg-card p-4 sm:p-6`}
      aria-labelledby="on-time-title"
    >
      <h2 id="on-time-title" className="font-semibold">
        On-time completion{" "}
        <span className="tabular-nums">{percentage(totals.onTime, totals.eligible)}</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {totals.onTime} of {totals.eligible} completed tasks with deadlines were on time.
      </p>
      <ActivityOnTimePlot days={days} cadence={cadence} />
      <ol
        aria-label={cadence === "week" ? "Weekly on-time completion" : "Daily on-time completion"}
        className="sr-only"
      >
        {days.map((day) => (
          <li key={day.date}>
            <time dateTime={day.date}>
              {cadence === "week" ? activityWeekLabel(day.date).range : day.date}
            </time>
            : {percentage(day.completedOnTime, day.completedWithDeadline)} ({day.completedOnTime}/
            {day.completedWithDeadline} completed tasks with deadlines were on time)
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Grouped by completion {cadence}. Unfinished tasks and tasks without deadlines are excluded.
        Latest {cadence} is partial; gaps mean no data, not 0%. Scroll the chart horizontally on
        smaller screens.
      </p>
    </section>
  );
}

function percentage(onTime: number, eligible: number) {
  return eligible ? `${Math.round((100 * onTime) / eligible)}%` : "No data";
}
