import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityPriorityFilter } from "./activity-priority-filter";

describe("ActivityPriorityFilter", () => {
  it("states which priorities are included and excluded", () => {
    const html = renderToStaticMarkup(
      <ActivityPriorityFilter selected={["LOW", "HIGH"]} onChange={() => undefined} />,
    );

    expect(html).toContain("Included priorities");
    expect(html).toContain("Unchecked priorities are excluded from every chart.");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('aria-label="Low: included"');
    expect(html).toContain('aria-label="Medium: excluded"');
    expect(html).toContain("2 included · 4 excluded");
  });
});
