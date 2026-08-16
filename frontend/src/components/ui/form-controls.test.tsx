import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

describe("form controls", () => {
  it("gives inputs and selects the same control height and surface treatment", () => {
    const input = renderToStaticMarkup(<Input aria-label="Title" />);
    const select = renderToStaticMarkup(
      <Select aria-label="Project">
        <option>Inbox</option>
      </Select>,
    );

    for (const control of [input, select]) {
      expect(control).toContain("h-11");
      expect(control).toContain("shadow-xs");
      expect(control).toContain("transition-[color,box-shadow]");
    }
  });

  it("styles the native select as a shadcn control with its own chevron", () => {
    const select = renderToStaticMarkup(
      <Select aria-label="Project">
        <option>Inbox</option>
      </Select>,
    );

    expect(select).toContain("appearance-none");
    expect(select).toContain('data-slot="select-icon"');
    expect(select).toContain("pr-9");
  });

  it("uses the same surface treatment for textareas and outline triggers", () => {
    const textarea = renderToStaticMarkup(<Textarea aria-label="Description" />);
    const trigger = renderToStaticMarkup(<Button variant="outline">Choose date</Button>);

    for (const control of [textarea, trigger]) {
      expect(control).toContain("shadow-xs");
      expect(control).toContain("box-shadow]");
      expect(control).toContain("focus-visible:border-ring");
    }
  });
});
