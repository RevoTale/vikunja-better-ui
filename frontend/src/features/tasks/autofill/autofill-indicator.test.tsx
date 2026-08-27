import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppInput } from "@/components/app-input";
import { ValidatedField } from "../validated-field";

describe("task creation autofill indicator", () => {
  it("associates a passive helper with only an autofilled field", () => {
    const markup = renderToStaticMarkup(
      <ValidatedField name="title" label="Title" error={undefined} autofilled>
        {(attributes) => <AppInput id="title" name="title" {...attributes} />}
      </ValidatedField>,
    );

    expect(markup).toContain('aria-describedby="title-autofill"');
    expect(markup).toContain('id="title-autofill"');
    expect(markup).toContain("From last task");
    expect(markup).not.toContain('role="alert"');
  });

  it("combines helper and error descriptions without hiding either one", () => {
    const markup = renderToStaticMarkup(
      <ValidatedField name="title" label="Title" error="Enter a title." autofilled>
        {(attributes) => <AppInput id="title" name="title" {...attributes} />}
      </ValidatedField>,
    );

    expect(markup).toContain('aria-describedby="title-autofill title-error"');
    expect(markup).toContain("From last task");
    expect(markup).toContain("Enter a title.");
  });
});
