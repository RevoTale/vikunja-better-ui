import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActiveWorkCount } from "./active-work-count";

describe("Active work total", () => {
  it("shows the whole result count, including zero", () => {
    for (const totalItems of [0, 75]) {
      const html = renderToStaticMarkup(
        <ActiveWorkCount
          page={{ isComplete: true, totalItems }}
          loading={false}
          error={undefined}
        />,
      );
      expect(html).toContain(`${totalItems} active tasks matching current filters`);
      expect(html).toContain(`>${totalItems}</span>`);
    }
  });
  it("does not present cached or incomplete counts as fresh", () => {
    const page = { isComplete: true, totalItems: 75 };
    const loading = renderToStaticMarkup(<ActiveWorkCount page={page} loading error={undefined} />);
    expect(loading).toContain("Updating active work count");
    expect(loading).not.toContain(">75</span>");
    for (const props of [
      { page, error: new Error("offline") },
      { page: { ...page, isComplete: false }, error: undefined },
      { page: undefined, error: undefined },
    ]) {
      const html = renderToStaticMarkup(<ActiveWorkCount {...props} loading={false} />);
      expect(html).toContain("Active work count unavailable");
      expect(html).not.toContain(">75</span>");
      expect(html).not.toContain(">0</span>");
    }
  });
});
