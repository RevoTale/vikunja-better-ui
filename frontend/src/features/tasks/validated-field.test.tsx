import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppInput } from "@/components/app-input";
import { ValidatedField } from "./validated-field";

describe("ValidatedField", () => {
  it("associates validation errors with the control", () => {
    const html = renderToStaticMarkup(
      <ValidatedField name="title" label="Title" error="Enter a title.">
        {(attributes) => <AppInput id="title" {...attributes} />}
      </ValidatedField>,
    );
    expect(html).toContain('aria-describedby="title-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Enter a title.");
  });
  it("has no stale helper when valid", () => {
    const html = renderToStaticMarkup(
      <ValidatedField name="title" label="Title" error={undefined}>
        {(attributes) => <AppInput id="title" {...attributes} />}
      </ValidatedField>,
    );
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("From last task");
  });
});
