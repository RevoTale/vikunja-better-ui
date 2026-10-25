import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoadFailure, ReloadPageButton } from "./load-failure";

describe("load recovery", () => {
  it("offers an explicit full-page reload for standalone PWA failures", () => {
    const markup = renderToStaticMarkup(<LoadFailure>Tasks could not be loaded.</LoadFailure>);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Reload page");
    expect(markup).not.toContain("Try again");
  });

  it("keeps a lightweight retry before the full reload fallback", () => {
    const markup = renderToStaticMarkup(
      <LoadFailure onRetry={() => undefined}>Task could not be loaded.</LoadFailure>,
    );

    expect(markup).toContain("Try again");
    expect(markup).toContain("Reload page");
  });

  it("supports recovery-specific labels without hiding the reload icon", () => {
    const markup = renderToStaticMarkup(<ReloadPageButton label="Retry connection" />);

    expect(markup).toContain("Retry connection");
    expect(markup).toContain('aria-hidden="true"');
  });
});
