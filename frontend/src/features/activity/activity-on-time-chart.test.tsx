import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityOnTimeChart } from "./activity-on-time-chart";

describe("ActivityOnTimeChart", () => {
  it("plots a percentage time series without connecting across missing days", () => {
    const html = renderToStaticMarkup(
      <ActivityOnTimeChart
        days={[
          { date: "2026-10-12", count: 1, completedWithDeadline: 1, completedOnTime: 1 },
          { date: "2026-10-13", count: 1, completedWithDeadline: 1, completedOnTime: 0 },
          { date: "2026-10-14", count: 0, completedWithDeadline: 0, completedOnTime: 0 },
          { date: "2026-10-15", count: 1, completedWithDeadline: 1, completedOnTime: 1 },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Daily on-time completion chart"');
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html.match(/<circle/g)).toHaveLength(3);
    expect(html).toContain("50%");
    expect(html).toContain("2026-10-14: No data");
  });

  it("uses the combined sample instead of averaging daily percentages", () => {
    const html = renderToStaticMarkup(
      <ActivityOnTimeChart
        days={[
          { date: "2026-10-14", count: 1, completedWithDeadline: 1, completedOnTime: 1 },
          { date: "2026-10-15", count: 4, completedWithDeadline: 3, completedOnTime: 1 },
        ]}
      />,
    );
    expect(html).toContain("50%");
    expect(html).toContain("100%");
    expect(html).toContain("33%");
    expect(html).toContain("2 of 4");
    expect(html).not.toContain("67%");
  });

  it("keeps missing samples distinct from genuine zero percent", () => {
    const html = renderToStaticMarkup(
      <ActivityOnTimeChart
        days={[
          { date: "2026-10-14", count: 0, completedWithDeadline: 0, completedOnTime: 0 },
          { date: "2026-10-15", count: 1, completedWithDeadline: 1, completedOnTime: 0 },
        ]}
      />,
    );
    expect(html).toContain("No data");
    expect(html).toContain("0%");
    expect(html).not.toContain("NaN");
  });

  it("shows no overall percentage without eligible completions", () => {
    const html = renderToStaticMarkup(<ActivityOnTimeChart days={[]} />);
    expect(html).toContain("No data");
    expect(html).not.toContain(">0%</span>");
    expect(html).not.toContain(">100%</span>");
  });

  it("centers weekly samples in their seven-day bins and labels cross-year ranges", () => {
    const html = renderToStaticMarkup(
      <ActivityOnTimeChart
        cadence="week"
        days={[{ date: "2026-12-28", count: 1, completedWithDeadline: 1, completedOnTime: 1 }]}
      />,
    );
    expect(html).toContain('cx="372"');
    expect(html).toContain("2026-12-28 – 2027-01-03");
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    expect(html).toContain(formatter.format(new Date("2026-12-28T00:00:00Z")));
    expect(html).toContain(formatter.format(new Date("2027-01-03T00:00:00Z")));
    expect(html).toContain("Latest week is partial");
  });
});
