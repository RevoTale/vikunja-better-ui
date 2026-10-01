import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";
import { vikunjaTask } from "./app-api";

test("task relationships support linking, parent navigation and confirmed detachment", async ({
  page,
}) => {
  await page.goto("/today");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const suffix = Date.now();
  const parentTitle = `Parent ${suffix}`;
  const childTitle = `Child ${suffix}`;
  const parent = await createTask(page, "one-time task", parentTitle);
  const child = await createTask(page, "one-time task", childTitle);
  const childBefore = await vikunjaTask(child);
  await page.goto(`/tasks/${parent}`);

  await page.getByRole("button", { name: "Link subtask", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Find task").fill(childTitle);
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await dialog.getByRole("button", { name: `#${child} ${childTitle}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Subtasks", exact: true })
      .getByRole("link", { name: childTitle }),
  ).toBeVisible();
  const after = await vikunjaTask(child);
  expect(after.title).toBe(childBefore.title);
  expect(after.due_date).toBe(childBefore.due_date);
  expect(after.labels).toEqual(childBefore.labels);

  await page.getByRole("link", { name: childTitle, exact: true }).click();
  const parents = page.getByRole("region", { name: "Parent tasks" });
  await expect(parents.getByRole("link", { name: parentTitle })).toBeVisible();
  await parents.getByRole("button", { name: `Unlink ${parentTitle}` }).click();
  await expect(dialog).toContainText("Neither task will be deleted");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(parents).toBeVisible();
  await parents.getByRole("button", { name: `Unlink ${parentTitle}` }).click();
  await dialog.getByRole("button", { name: "Unlink tasks", exact: true }).click();
  await expect(parents).toHaveCount(0);
  expect((await vikunjaTask(parent)).id).toBe(Number(parent));
  expect((await vikunjaTask(child)).id).toBe(Number(child));
});
