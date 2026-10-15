import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("task labels support explicit independent reuse of deadline date and time with late responses", async ({
  page,
}) => {
  await discussionFixture(page);
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    const operation = route.request().postDataJSON();
    if (operation.operationName !== "TaskReuseValues") return route.continue();
    if (!operation.variables.recurring) await pending;
    await route.fulfill({
      json: {
        data: {
          taskReuseValues: {
            taskId: "987",
            title: "Previous",
            projectId: process.env["E2E_PROJECT_ID"],
            priority: "LOW",
            labels: [],
            durationMinutes: null,
            completionWindowMinutes: null,
            dueDate: operation.variables.recurring ? "2026-10-07" : "2026-10-06",
            dueTime: operation.variables.recurring ? null : "14:30",
            startDate: null,
            startTime: null,
          },
        },
      },
    });
  });
  await page.goto("/tasks/new?type=one-time&date=2026-10-18");
  await page.getByLabel("Title", { exact: true }).fill("Do not replace my title");
  await page.getByLabel("Due time", { exact: true }).fill("10:15");
  await expect(page.getByRole("button", { name: "Use last due time", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("button", { name: "Use last due time", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("10:15");
  await page.getByRole("button", { name: "Use last due time", exact: true }).click();
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("14:30");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("2026-10-18");
  await page.getByRole("button", { name: "Use last due date", exact: true }).click();
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("2026-10-06");
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("14:30");
  await page.getByRole("button", { name: "recurring task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use last first due date", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Use last due time", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use last first due date", exact: true }).click();
  await expect(page.locator('input[name="firstDueDate"]')).toHaveValue("2026-10-07");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Do not replace my title");
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("14:30");
});
