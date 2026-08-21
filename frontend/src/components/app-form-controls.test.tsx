import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppInput } from "./app-input";
import { AppSelect } from "./app-select";

describe("application form controls", () => {
  it("keeps text and select controls at the same comfortable height", () => {
    const input = renderToStaticMarkup(<AppInput aria-label="Title" />);
    const select = renderToStaticMarkup(
      <AppSelect
        aria-label="Project"
        defaultValue="inbox"
        options={[{ value: "inbox", label: "Inbox" }]}
      />,
    );

    for (const control of [input, select]) {
      expect(control).toContain("h-11");
      expect(control).toContain("shadow-xs");
    }
    expect(select).toContain('data-slot="select-trigger"');
  });
});
