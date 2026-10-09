import { expect, type Page } from "@playwright/test";
import { createTask, expectRenewedDate, expectStatusMessage } from "./app-actions";
import { expectDateOnlyTask, searchTasks, vikunjaTask } from "./app-api";
import { chooseSelectOption } from "./app-layout";
import { findTaskInPaginatedList } from "./app-pagination";

export async function workflowRecurrence(page: Page, recurring: string, scheduled: string) {
  const recurringId = await createTask(page, "recurring task", recurring);
  const recurringBefore = await vikunjaTask(recurringId);
  expect(recurringBefore.repeat_mode).toBe(2);
  await expectDateOnlyTask(recurringId);
  await page.goto("/week");
  await expect(page.getByRole("heading", { name: "Overdue" })).toHaveCount(0);
  await expect(
    page.locator('[data-slot="card"]:not([data-projection])').filter({ hasText: recurring }),
  ).toContainText("Next: 1 day after completion.");
  await page.goto("/today");
  await findTaskInPaginatedList(page, recurring);
  await page.getByRole("button", { name: `Complete ${recurring}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  const recurringAfter = await vikunjaTask(recurringId);
  expect(String(recurringAfter.id)).toBe(recurringId);
  expect(recurringAfter.done).toBe(false);
  expect(new Date(recurringAfter.due_date).getTime()).toBeGreaterThan(
    new Date(recurringBefore.due_date).getTime(),
  );
  await expectDateOnlyTask(recurringId);
  await expectRenewedDate(page, recurringId, recurringAfter.due_date);
  const snapshots = await searchTasks("vbu:completion-key:v1");
  expect(snapshots.some((task) => task.done && task.repeat_after === 0)).toBe(true);

  const scheduledId = await createTask(page, "recurring task", scheduled, async () => {
    await chooseSelectOption(page, "Renewal", "Scheduled cycle");
  });
  const scheduledBefore = await vikunjaTask(scheduledId);
  expect(scheduledBefore.repeat_mode).toBe(0);
  await page.goto("/week");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const computedScheduled = page.locator('[data-projection="true"]').filter({ hasText: scheduled });
  await expect(computedScheduled.first()).toContainText("Computed");
  await expect(
    computedScheduled.getByRole("button", { name: `Complete ${scheduled}` }),
  ).toHaveCount(0);
  await page.goto("/today");
  await findTaskInPaginatedList(page, scheduled);
  await page.getByRole("button", { name: `Complete ${scheduled}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  const scheduledAfter = await vikunjaTask(scheduledId);
  expect(String(scheduledAfter.id)).toBe(scheduledId);
  expect(scheduledAfter.done).toBe(false);
  await expectRenewedDate(page, scheduledId, scheduledAfter.due_date);
}
