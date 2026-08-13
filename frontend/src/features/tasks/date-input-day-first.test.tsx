import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DateInputDayFirst } from "./date-input-day-first";

describe("DateInputDayFirst", () => {
  it("renders day, month, and year selectors while submitting an ISO date", () => {
    const markup = renderToStaticMarkup(
      <DateInputDayFirst
        id="startDate"
        name="startDate"
        monthLabel="Start date month"
        yearLabel="Start date year"
        value="2026-08-14"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('name="startDate" value="2026-08-14"');
    expect(markup.indexOf('id="startDate"')).toBeLessThan(
      markup.indexOf('aria-label="Start date month"'),
    );
    expect(markup.indexOf('aria-label="Start date month"')).toBeLessThan(
      markup.indexOf('aria-label="Start date year"'),
    );
    expect(markup).toContain("</select><span");
  });
});
