import { ActivityChartViewport } from "./activity-chart-viewport";
import type { ActivityDayView } from "./activity-view-model";
import { activityWeekLabel } from "./activity-week-label";

type Days = readonly ActivityDayView[];
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
const plot = { left: 48, right: 696, top: 28, bottom: 208 };

export function ActivityOnTimePlot({
  days,
  cadence = "day",
}: {
  days: Days;
  cadence?: "day" | "week";
}) {
  const points = days.map((day, index) => ({
    day,
    x:
      plot.left +
      (cadence === "week" ? (index + 0.5) / days.length : index / Math.max(1, days.length - 1)) *
        (plot.right - plot.left),
    percent: day.completedWithDeadline
      ? (100 * day.completedOnTime) / day.completedWithDeadline
      : null,
  }));
  // Missing days break the line: absence of a sample must not imply an interpolated score.
  const segments: string[][] = [];
  for (const point of points) {
    if (point.percent === null) segments.push([]);
    else {
      if (!segments.length) segments.push([]);
      segments.at(-1)?.push(`${point.x},${percentY(point.percent)}`);
    }
  }
  return (
    <ActivityChartViewport label="Scrollable on-time chart">
      <svg
        viewBox="0 0 720 280"
        className="w-full min-w-144"
        role="img"
        aria-label={
          cadence === "week" ? "Weekly on-time completion chart" : "Daily on-time completion chart"
        }
      >
        <title>{`On-time completion by ${cadence}, from 0 to 100 percent. Gaps mean no data.`}</title>
        <PlotAxis />
        {segments
          .filter((segment) => segment.length > 1)
          .map((segment) => (
            <polyline
              key={segment[0]}
              points={segment.join(" ")}
              fill="none"
              className="stroke-primary"
              strokeWidth="2"
            />
          ))}
        {points.map((point) => (
          <PlotDay key={point.day.date} {...point} cadence={cadence} />
        ))}
      </svg>
    </ActivityChartViewport>
  );
}

function PlotAxis() {
  return (
    <>
      {[0, 50, 100].map((percent) => (
        <g key={percent}>
          <line
            x1={plot.left}
            x2={plot.right}
            y1={percentY(percent)}
            y2={percentY(percent)}
            className="stroke-border"
          />
          <text
            x="38"
            y={percentY(percent) + 4}
            textAnchor="end"
            className="fill-muted-foreground text-xs"
          >
            {percent}%
          </text>
        </g>
      ))}
    </>
  );
}

function PlotDay({
  day,
  x,
  percent,
  cadence,
}: {
  day: Days[number];
  x: number;
  percent: number | null;
  cadence: "day" | "week";
}) {
  const label = percent === null ? "No data" : `${Math.round(percent)}%`;
  return (
    <g>
      <title>{`${cadence === "week" ? activityWeekLabel(day.date).range : day.date}: ${label} (${day.completedOnTime}/${day.completedWithDeadline})`}</title>
      {percent === null ? (
        <text x={x} y="224" textAnchor="middle" className="fill-muted-foreground text-xs">
          —
        </text>
      ) : (
        <>
          <circle
            cx={x}
            cy={percentY(percent)}
            r="4"
            className="fill-primary stroke-card"
            strokeWidth="2"
          />
          <text
            x={x}
            y={percentY(percent) - 10}
            textAnchor="middle"
            className="fill-foreground text-xs"
          >
            {label}
          </text>
        </>
      )}
      <text x={x} y="246" textAnchor="middle" className="fill-muted-foreground text-xs">
        <tspan x={x}>
          {cadence === "week"
            ? activityWeekLabel(day.date).start
            : weekday.format(new Date(`${day.date}T00:00:00Z`))}
        </tspan>
        <tspan x={x} dy="16">
          {cadence === "week" ? `– ${activityWeekLabel(day.date).end}` : day.date.slice(8)}
        </tspan>
      </text>
    </g>
  );
}

function percentY(percent: number) {
  return plot.bottom - (percent / 100) * (plot.bottom - plot.top);
}
