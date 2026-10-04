import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateTaskForm } from "./create-task-form";

vi.mock("./create-shared-fields", () => ({ SharedFields: () => <input name="title" /> }));
vi.mock("./create-type-fields", () => ({ TaskTypeFields: () => null }));
vi.mock("./schedule-shift", () => ({ ScheduleShift: () => null }));
vi.mock("./task-label-picker", () => ({ TaskLabelPicker: () => null }));
vi.mock("./task-reuse", () => ({
  TaskReuseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("creation settings refresh", () => {
  for (const settingsError of [undefined, new Error("network failed")]) {
    it(`keeps the ready form mounted during refresh ${Boolean(settingsError)}`, () => {
      const html = renderToStaticMarkup(
        <CreateTaskForm
          type="one-time"
          initialJob={false}
          projects={[{ id: "1", title: "Work", isDefault: true }]}
          defaultProject="1"
          explicitProjectId={undefined}
          timezone="Europe/Kyiv"
          defaultDate="2026-10-04"
          initialDate={undefined}
          selectedJobStart={{ date: "2026-10-04", time: "09:00" }}
          fieldErrors={{}}
          loading={false}
          settingsLoading={true}
          settingsError={settingsError}
          onSubmit={() => undefined}
          onFieldErrorsChange={() => undefined}
        />,
      );
      expect(html).toContain("<form");
      expect(html).toContain('name="title"');
      expect(html).not.toContain("Loading task settings");
    });
  }
});
