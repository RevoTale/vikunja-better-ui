import { expect, test } from "@playwright/test";

test("task labels support fresh creation without remembered values or storage collisions", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  await page.evaluate(() => {
    localStorage.setItem("vbu:task-create-autofill:v1:one-time:last-variant", "job");
  });
  await page.goto("/tasks/new?type=one-time&date=2026-10-06");
  await expect(page.getByLabel("Job", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("2026-10-06");
  await expect(page.getByRole("button", { name: "Reset autosave" })).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("My typed task");
  await page.getByLabel("Job", { exact: true }).check();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("My typed task");
  await expect(page.locator('input[name="startDate"]')).toHaveValue("2026-10-06");
  await page.getByLabel("Start time", { exact: true }).fill("14:45");
  await page.getByLabel("Job", { exact: true }).uncheck();
  await page.getByLabel("Job", { exact: true }).check();
  await expect(page.getByLabel("Start time", { exact: true })).toHaveValue("14:45");
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "vbu:task-create-autofill:v1:one-time:job",
        newValue: JSON.stringify({ title: "Do not overwrite" }),
      }),
    ),
  );
  await expect(page.getByLabel("Title (optional)")).toHaveValue("My typed task");
});
