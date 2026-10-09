import { expect, test } from "@playwright/test";
import { blockBrowserVikunjaCalls, createTask, expectStatusMessage, login } from "./app-actions";
import { expectDateOnlyTask, expectVikunjaTask, vikunjaTask } from "./app-api";
import { displayDate, localDate, selectDate } from "./app-calendar";
import { invalidTitle, projectID } from "./app-fixture";
import { chooseSelectOption, elementPadding, expectTaskPriorityLayout } from "./app-layout";
import { findTaskInPaginatedList } from "./app-pagination";
import { workflowHistory } from "./workflow-history";
import { workflowJob } from "./workflow-job";
import { workflowRecurrence } from "./workflow-recurrence";
import { workflowRecurringJob } from "./workflow-recurring-job";
import { workflowWeek } from "./workflow-week";

test("desktop workflows match Vikunja state", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const suffix = String(Date.now());
  const oneTime = `One-time E2E ${suffix}`;
  const recurring = `Recurring E2E ${suffix}`;
  const scheduled = `Scheduled E2E ${suffix}`;
  const unscheduled = `No deadline E2E ${suffix}`;

  const oneTimeId = await createTask(page, "one-time task", oneTime, async () => {
    await selectDate(page, "Due date", localDate());
    await chooseSelectOption(page, "Priority", "High");
  });
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: false });
  await expectDateOnlyTask(oneTimeId);
  expect((await vikunjaTask(oneTimeId)).priority).toBe(3);
  await expect(page.getByText(displayDate(localDate()), { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Extended" }).click();
  await expect(page.getByRole("heading", { name: "Extended properties" })).toBeVisible();
  await expect(
    page.getByText("Task ID").locator("..").getByText(oneTimeId, { exact: true }),
  ).toBeVisible();

  await page.goto("/today");
  await expect(page.getByText(invalidTitle, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Invalid: history snapshot still repeats", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: `Complete ${invalidTitle}` })).toHaveCount(0);
  await chooseSelectOption(page, "Project", "E2E Daily Tasks");
  await expect(page).toHaveURL(new RegExp(`project=${projectID}`));
  const firstLoadedTask = page
    .locator('[data-slot="card-content"]')
    .filter({ has: page.locator('[data-slot="task-content"]') })
    .first();
  await expect
    .poll(() => elementPadding(firstLoadedTask))
    .toEqual({
      top: "8px",
      bottom: "8px",
      left: "12px",
    });
  await workflowWeek(page);
  await page.goto("/today");
  await findTaskInPaginatedList(page, oneTime);
  await expectTaskPriorityLayout(page, oneTime, "High");
  await page.getByRole("button", { name: `Complete ${oneTime}` }).click();
  await expectStatusMessage(page, `${oneTime} completed.`);
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: true });
  await page.getByRole("button", { name: "Undo" }).click();
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: false });

  await workflowRecurrence(page, recurring, scheduled);
  await workflowRecurringJob(page, suffix);
  await workflowJob(page);
  await workflowHistory(page, unscheduled);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
