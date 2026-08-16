import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimeInput24 } from "./time-input-24";

describe("TimeInput24", () => {
  it("renders one native time input with a deterministic 24-hour value", () => {
    const markup = renderToStaticMarkup(
      <TimeInput24 id="startTime" name="startTime" value="23:07" onChange={() => undefined} />,
    );

    expect(markup).toContain('type="time"');
    expect(markup).toContain('name="startTime"');
    expect(markup).toContain('value="23:07"');
    expect(markup).toContain('step="60"');
    expect(markup).not.toContain("<select");
  });
});
