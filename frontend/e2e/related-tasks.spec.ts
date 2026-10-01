import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";

test("task relationships support symmetric related links by ID without changing hierarchy", async ({
  page,
}) => {
  await page.goto("/today");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const suffix = Date.now();
  const firstTitle = `Related first ${suffix}`;
  const secondTitle = `Related second ${suffix}`;
  const first = await createTask(page, "one-time task", firstTitle);
  const second = await createTask(page, "one-time task", secondTitle);
  await page.goto(`/tasks/${first}`);
  await page.getByRole("button", { name: "Link task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Find task").fill(`#${second}`);
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await dialog.getByRole("button", { name: `#${second} ${secondTitle}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("region", { name: "Related tasks", exact: true })
    .getByRole("link", { name: secondTitle, exact: true })
    .click();
  const related = page.getByRole("region", { name: "Related tasks", exact: true });
  await expect(related.getByRole("link", { name: firstTitle })).toBeVisible();
  await expect(page.getByRole("region", { name: "Parent tasks" })).toHaveCount(0);
  await related.getByRole("button", { name: `Unlink ${firstTitle}` }).click();
  await dialog.getByRole("button", { name: "Unlink tasks", exact: true }).click();
  await expect(related.getByText("None linked.")).toBeVisible();
  await page.goto(`/tasks/${first}`);
  await expect(
    page.getByRole("region", { name: "Related tasks", exact: true }).getByText("None linked."),
  ).toBeVisible();
});
