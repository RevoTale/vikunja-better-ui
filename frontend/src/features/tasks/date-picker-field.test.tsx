import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DatePickerField } from "./date-picker-field";

describe("DatePickerField", () => {
  it("renders a labeled trigger and submits the ISO date", () => {
    const markup = renderToStaticMarkup(
      <DatePickerField
        id="firstDueDate"
        name="firstDueDate"
        label="First due date"
        value="2026-08-14"
        defaultDate="2026-08-16"
        onChange={() => undefined}
        required
      />,
    );

    expect(markup).toContain('id="firstDueDate"');
    expect(markup).toContain('aria-label="Change First due date, 14 Aug 2026, required"');
    expect(markup).toContain("14 Aug 2026");
    expect(markup).toContain('name="firstDueDate" value="2026-08-14"');
    expect(markup).not.toContain("aria-required");
  });

  it("announces an empty optional date", () => {
    const markup = renderToStaticMarkup(
      <DatePickerField
        id="dueDate"
        name="dueDate"
        label="Due date"
        value=""
        defaultDate="2026-08-16"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Choose Due date"');
    expect(markup).toContain("Choose date");
    expect(markup).toContain('name="dueDate" value=""');
  });
});
