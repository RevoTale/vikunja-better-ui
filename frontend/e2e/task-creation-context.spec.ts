import { expect, test } from "@playwright/test";
import { chooseSelectOption } from "./app-layout";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("task labels support creation from filters without overwriting edits on label refresh", async ({
  page,
}) => {
  await discussionFixture(page);
  const { projects, taskLabels } = await discussionGraphQL<{
    projects: { items: { id: string; title: string }[] };
    taskLabels: { id: string; title: string }[];
  }>(page, "{ projects { items { id title } } taskLabels { id title } }");
  const project = projects.items.find((item) => item.title === "E2E Empty Project");
  const work = taskLabels.find((item) => item.title === "work");
  expect(project).toBeDefined();
  expect(work).toBeDefined();
  await page.goto(`/today?project=${project?.id}&label=${work?.id}&priority=HIGH&date=2026-10-18`);
  await expect(page.getByRole("combobox", { name: "Filter by label" })).toContainText("work");
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName === "TaskLabels") await pending;
    await route.continue();
  });
  const labelsResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/graphql") &&
      response.request().postDataJSON().operationName === "TaskLabels",
  );
  await page.getByRole("link", { name: "New task", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`project=${project?.id}`));
  await expect(page).toHaveURL(new RegExp(`label=${work?.id}`));
  await expect(page.getByRole("combobox", { name: "Priority", exact: true })).toContainText("High");
  await chooseSelectOption(page, "Priority", "Low");
  await expect(page.getByRole("combobox", { name: "Project", exact: true })).toContainText(
    "E2E Empty Project",
  );
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("2026-10-18");
  await expect(page.getByRole("checkbox", { name: "work", exact: true })).toBeChecked();
  await page.getByLabel("Title", { exact: true }).fill("Keep current input");
  await page.getByRole("checkbox", { name: "work", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "focus", exact: true }).check();
  release();
  await labelsResponse;
  await expect(page.getByRole("checkbox", { name: "work", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "focus", exact: true })).toBeChecked();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Keep current input");
  await expect(page.getByRole("combobox", { name: "Priority", exact: true })).toContainText("Low");
});
