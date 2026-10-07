import { taskPriorityOption } from "@/features/tasks/task-priority";
import type { PublicActivityQuery } from "@/graphql/graphql";

type Activity = NonNullable<PublicActivityQuery["publicActivity"]>;
const colors = ["var(--muted-foreground)", "#0284c7", "#16a34a", "#d97706", "#dc2626", "#9333ea"];
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
export const activityChartLayout = {
  daily: "min-h-100 w-full rounded-lg",
  priority: "min-h-120 w-full rounded-lg sm:min-h-80",
};

export function ActivityCharts({ activity }: { activity: Activity }) {
  return (
    <>
      <DailyChart activity={activity} />
      <PriorityChart activity={activity} />
    </>
  );
}

function DailyChart({ activity }: { activity: Activity }) {
  const maximum = Math.max(1, ...activity.days.map((day) => day.count));
  return (
    <section
      className={`${activityChartLayout.daily} border bg-card p-4 sm:p-6`}
      aria-labelledby="daily-title"
    >
      <h2 id="daily-title" className="font-semibold">
        {activity.total} tasks completed
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {activity.days[0]?.date} – {activity.days.at(-1)?.date}
      </p>
      <ol
        aria-label="Daily completions"
        className="mt-6 grid grid-cols-7 gap-x-1 gap-y-4 sm:gap-x-2"
      >
        {activity.days.map((day) => (
          <li key={day.date} className="flex min-w-0 flex-col items-center gap-1">
            <svg
              viewBox="0 0 24 100"
              className="h-18 w-full"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <rect
                x="4"
                y={100 - (day.count / maximum) * 100}
                width="16"
                height={(day.count / maximum) * 100}
                rx="2"
                className="fill-primary"
              />
            </svg>
            <time
              dateTime={day.date}
              title={day.date}
              className="flex h-8 flex-col items-center text-xs leading-4 text-muted-foreground"
            >
              <span>{weekdayFormatter.format(new Date(`${day.date}T00:00:00Z`))}</span>
              <span className="tabular-nums">{day.date.slice(8)}</span>
            </time>
            <span className="h-5 text-sm tabular-nums">
              {day.count}
              <span className="sr-only"> tasks completed</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PriorityChart({ activity }: { activity: Activity }) {
  let offset = 0;
  return (
    <section
      className={`${activityChartLayout.priority} border bg-card p-4 sm:p-6`}
      aria-labelledby="priority-title"
    >
      <h2 id="priority-title" className="font-semibold">
        Completed by priority
      </h2>
      {activity.total === 0 ? (
        <p className="mt-4 text-muted-foreground">No completed tasks in this period.</p>
      ) : null}
      <div className="mt-4 flex flex-col items-center justify-center gap-6 sm:flex-row">
        <svg
          viewBox="0 0 100 100"
          className="size-44 shrink-0"
          role="img"
          aria-label="Priority distribution; counts and percentages listed beside the chart"
        >
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="15" />
          {activity.priorities.map((item, index) => {
            const percent = activity.total ? (item.count / activity.total) * 100 : 0;
            const start = offset;
            offset += percent;
            return (
              <circle
                key={item.priority}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={colors[index]}
                strokeWidth="15"
                pathLength="100"
                strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={-start}
                transform="rotate(-90 50 50)"
              />
            );
          })}
          <text x="50" y="54" textAnchor="middle" className="fill-foreground text-xs">
            {activity.total}
          </text>
        </svg>
        <ul className="w-full min-w-0 space-y-2 text-sm sm:w-auto sm:flex-1">
          {activity.priorities.map((item, index) => (
            <li key={item.priority} className="flex items-center gap-2">
              <svg className="size-3 shrink-0" aria-hidden="true">
                <circle cx="6" cy="6" r="5" fill={colors[index]} />
              </svg>
              <span>{taskPriorityOption(item.priority).label}</span>
              <span className="ml-auto whitespace-nowrap tabular-nums">
                {item.count} ·{" "}
                {activity.total ? ((item.count / activity.total) * 100).toFixed(1) : "0"}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
