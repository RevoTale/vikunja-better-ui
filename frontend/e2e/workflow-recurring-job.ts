import { expect, type Page } from "@playwright/test";
import { expectStatusMessage } from "./app-actions";
import { hasLabelTitle, searchTasks, vikunjaTask } from "./app-api";
import { addCalendarDays, localDate, localDateTime } from "./app-calendar";

export async function workflowRecurringJob(page: Page, suffix: string) {
  const recurringJob = `Recurring Job E2E ${suffix}`;
  await page.goto("/tasks/new?type=recurring&returnTo=%2Ftoday");
  await page.getByLabel("Title", { exact: true }).fill(recurringJob);
  await page.getByLabel("Job", { exact: true }).check();
  await page.getByLabel("Start time", { exact: true }).fill("20:00");
  await page.getByLabel("Every").fill("2");
  await expect(page.getByText("Keep start time of day", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Keep start time of day")).toBeChecked();
  await page.getByRole("button", { name: "Create recurring Job", exact: true }).click();
  await expect(page.getByRole("heading", { name: recurringJob })).toBeVisible();
  const recurringJobID = page.url().match(/\/tasks\/(\d+)/)?.[1];
  if (!recurringJobID) throw new Error("created recurring Job ID is missing from the URL");
  const recurringJobBefore = await vikunjaTask(recurringJobID);
  expect(recurringJobBefore.repeat_mode).toBe(2);
  expect(hasLabelTitle(recurringJobBefore, "vbu:job")).toBe(true);
  expect(hasLabelTitle(recurringJobBefore, "vbu:fixed-due-time")).toBe(true);
  await page.goto("/today");
  const recurringJobCard = page.locator('[data-slot="card"]').filter({ hasText: recurringJob });
  await expect(recurringJobCard.getByText("Job", { exact: true })).toBeVisible();
  await expect(recurringJobCard.getByText("Recurring", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Complete ${recurringJob}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  const recurringJobAfter = await vikunjaTask(recurringJobID);
  const nextRecurringJobDate = addCalendarDays(localDate(), 2);
  expect(recurringJobAfter.done).toBe(false);
  expect(localDateTime(recurringJobAfter.start_date)).toBe(`${nextRecurringJobDate}T20:00`);
  expect(localDateTime(recurringJobAfter.end_date)).toBe(`${nextRecurringJobDate}T21:00`);
  expect(localDateTime(recurringJobAfter.due_date)).toBe(`${nextRecurringJobDate}T22:00`);
  const recurringJobHistory = await searchTasks(recurringJob);
  expect(
    recurringJobHistory.some(
      (task) =>
        task.done &&
        task.repeat_after === 0 &&
        hasLabelTitle(task, "vbu:job") &&
        hasLabelTitle(task, "vbu:recurrence-history") &&
        !hasLabelTitle(task, "vbu:fixed-due-time"),
    ),
  ).toBe(true);
}
