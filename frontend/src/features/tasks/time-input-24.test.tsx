import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimeInput24 } from "./time-input-24";

describe("TimeInput24", () => {
  it("renders a deterministic 24-hour value without a meridiem control", () => {
    const markup = renderToStaticMarkup(
      <TimeInput24
        id="startTime"
        name="startTime"
        minuteLabel="Start time minute"
        value="23:07"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('name="startTime" value="23:07"');
    expect(markup).toContain('<option value="00">00</option>');
    expect(markup).toContain('<option value="23" selected="">23</option>');
    expect(markup).not.toMatch(/AM|PM/);
  });
});
