import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimeFormatContext } from "@/lib/time-format-context";
import { TimeInput24 } from "./time-input-24";

describe("TimeInput24", () => {
  it("renders a deterministic 24-hour control instead of an OS-dependent native picker", () => {
    const markup = renderToStaticMarkup(
      <TimeInput24 id="startTime" name="startTime" value="23:07" onChange={() => undefined} />,
    );

    expect(markup).toContain('type="text"');
    expect(markup).toContain('name="startTime"');
    expect(markup).toContain('value="23:07"');
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).not.toContain("<select");
  });
  it("supports AM/PM presentation while submitting the canonical 24-hour value", () => {
    const markup = renderToStaticMarkup(
      <TimeFormatContext value={true}>
        <TimeInput24 id="startTime" name="startTime" value="23:07" onChange={() => undefined} />
      </TimeFormatContext>,
    );
    expect(markup).toContain('value="11:07"');
    expect(markup).toContain('value="23:07"');
    expect(markup).toContain("AM/PM");
  });
});
