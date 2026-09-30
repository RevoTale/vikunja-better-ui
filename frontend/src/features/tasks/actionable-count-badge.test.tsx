import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionableCountBadge } from "./actionable-count-badge";

describe("actionable count badge", () => {
  it("shows the exact count with an accessible meaning", () => {
    const html = renderToStaticMarkup(<ActionableCountBadge count={1234} loading={false} />);
    expect(html).toContain("1234 tasks ready now");
    expect(html).toContain(">999+</span>");
  });

  it("retains cached counts while explicitly revalidating", () => {
    const html = renderToStaticMarkup(<ActionableCountBadge count={4} loading />);
    expect(html).toContain("Updating tasks ready now");
    expect(html).toContain(">4<");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).not.toContain(">0<");
  });

  it("uses a skeleton only before a count is known", () => {
    const html = renderToStaticMarkup(<ActionableCountBadge count={undefined} loading />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain(">0<");
  });

  it("shows unavailable instead of the previous number after a failed read", () => {
    const html = renderToStaticMarkup(
      <ActionableCountBadge count={4} loading={false} error={new Error("failed")} />,
    );
    expect(html).toContain("Task count unavailable");
    expect(html).not.toContain(">4<");
  });

  it("hides a confirmed zero while reserving its space", () => {
    const html = renderToStaticMarkup(<ActionableCountBadge count={0} loading={false} />);
    expect(html).toContain("invisible");
    expect(html).toContain("0 tasks ready now");
  });
});
