import { expect, type Page } from "@playwright/test";
import { vikunjaTask } from "./app-api";
import { displayDate, localDate, localDateTime, selectDate } from "./app-calendar";
import { chooseSelectOption } from "./app-layout";
import { findTaskInPaginatedList } from "./app-pagination";

export async function workflowJob(page: Page) {
  await page.goto("/tasks/new?type=job&returnTo=%2Fjobs");
  const jobDate = localDate();
  await expect(page.getByLabel("Title (optional)")).toHaveAttribute(
    "placeholder",
    `Job ${displayDate(jobDate)} - 09:00`,
  );
  const job = `Job ${displayDate(jobDate)} - 10:15`;
  await selectDate(page, "Start date", jobDate);
  await page.getByLabel("Start time", { exact: true }).fill("10:15");
  await expect(page.getByLabel("Title (optional)")).toHaveAttribute("placeholder", job);
  await chooseSelectOption(page, "Duration unit", "Minutes");
  await page.getByLabel("Duration", { exact: true }).fill("45");
  await chooseSelectOption(page, "Completion window unit", "Minutes");
  await page.getByLabel("Time to complete after it ends").fill("60");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: job })).toBeVisible();
  const jobIDMatch = page.url().match(/\/tasks\/(\d+)/);
  if (!jobIDMatch?.[1]) throw new Error("created job ID is missing from the URL");
  const jobId = jobIDMatch[1];
  const jobTask = await vikunjaTask(jobId);
  expect(jobTask.title).toBe(job);
  expect(localDateTime(jobTask.start_date)).toBe(`${jobDate}T10:15`);
  expect(localDateTime(jobTask.end_date)).toBe(`${jobDate}T11:00`);
  expect(localDateTime(jobTask.due_date)).toBe(`${jobDate}T12:00`);
  expect(new Date(jobTask.end_date).getTime() - new Date(jobTask.start_date).getTime()).toBe(
    45 * 60_000,
  );
  expect(new Date(jobTask.due_date).getTime() - new Date(jobTask.end_date).getTime()).toBe(
    60 * 60_000,
  );
  await expect(page.getByText(`${displayDate(jobDate)} - 10:15`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${displayDate(jobDate)} - 11:00`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${displayDate(jobDate)} - 12:00`, { exact: true })).toBeVisible();
  await page.goto("/jobs");
  await findTaskInPaginatedList(page, job);
  const jobCard = page.locator('[data-slot="card"]').filter({ hasText: job });
  await expect(jobCard.getByText(job, { exact: true })).toBeVisible();
  if (Date.now() >= new Date(jobTask.due_date).getTime()) {
    await expect(jobCard.locator('[data-slot="task-schedule"]')).toHaveText("OverdueNo priority");
    await expect(jobCard.getByText("Complete by 12:00", { exact: true })).toHaveCount(0);
  } else {
    await expect(jobCard.locator('[data-slot="task-schedule"]')).toContainText("10:15–11:00");
    await expect(jobCard.getByText("Complete by 12:00", { exact: true })).toBeVisible();
  }
  await page.goto("/today");
  await findTaskInPaginatedList(page, job);
  await expect(page.getByText(job, { exact: true })).toBeVisible();
}
