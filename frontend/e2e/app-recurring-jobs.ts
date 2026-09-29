import { expect, test } from "@playwright/test";
import {
  blockBrowserVikunjaCalls,
  createRecurringJob,
  expectStatusMessage,
  login,
} from "./app-actions";
import { graphQLOperation, graphQLTask, hasLabelTitle, searchTasks, vikunjaTask } from "./app-api";
import { addCalendarDays, localDate, localDateTime } from "./app-calendar";

test("skipping a recurring Job renews its schedule and preserves skipped Job history", async ({
  page,
}) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Skip recurring Job E2E ${Date.now()}`;
  const taskID = await createRecurringJob(page, title, {
    startDate: localDate(),
    startTime: "18:00",
  });

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expectStatusMessage(page, "This occurrence was skipped and the next one is ready.");

  const renewed = await vikunjaTask(taskID);
  expect(renewed.done).toBe(false);
  expect(localDateTime(renewed.start_date)).toBe(`${addCalendarDays(localDate(), 2)}T18:00`);
  expect(localDateTime(renewed.end_date)).toBe(`${addCalendarDays(localDate(), 2)}T19:00`);
  expect(localDateTime(renewed.due_date)).toBe(`${addCalendarDays(localDate(), 2)}T20:00`);
  expect(hasLabelTitle(renewed, "vbu:job")).toBe(true);
  expect(hasLabelTitle(renewed, "vbu:fixed-due-time")).toBe(true);
  expect(hasLabelTitle(renewed, "vbu:skipped")).toBe(false);

  const snapshots = (await searchTasks(title)).filter(
    (task) => String(task.id) !== taskID && task.title === title,
  );
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]?.done).toBe(true);
  expect(snapshots[0]?.repeat_after).toBe(0);
  expect(snapshots[0]?.labels.map((label: { title: string }) => label.title)).toEqual(
    expect.arrayContaining(["vbu:job", "vbu:recurrence-history", "vbu:skipped"]),
  );
  expect(hasLabelTitle(snapshots[0] ?? {}, "vbu:fixed-due-time")).toBe(false);
});

test("completing a scheduled recurring Job advances from its configured schedule", async ({
  page,
}) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Scheduled recurring Job E2E ${Date.now()}`;
  const firstDate = addCalendarDays(localDate(), 1);
  const taskID = await createRecurringJob(page, title, {
    startDate: firstDate,
    startTime: "13:15",
    renewal: "Scheduled cycle",
  });
  const before = await vikunjaTask(taskID);
  expect(before.repeat_mode).toBe(0);

  await page.goto("/jobs");
  await page.getByRole("button", { name: `Complete ${title}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");

  const renewed = await vikunjaTask(taskID);
  const nextDate = addCalendarDays(firstDate, 2);
  expect(renewed.done).toBe(false);
  expect(localDateTime(renewed.start_date)).toBe(`${nextDate}T13:15`);
  expect(localDateTime(renewed.end_date)).toBe(`${nextDate}T14:15`);
  expect(localDateTime(renewed.due_date)).toBe(`${nextDate}T15:15`);
});

test("completion-relative recurring Job uses an exact interval when fixed time is disabled", async ({
  page,
}) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Exact interval recurring Job E2E ${Date.now()}`;
  const taskID = await createRecurringJob(page, title, {
    startDate: localDate(),
    startTime: "10:30",
    keepStartTime: false,
  });

  await page.goto("/jobs");
  await page.getByRole("button", { name: `Complete ${title}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");

  const renewed = await vikunjaTask(taskID);
  expect(new Date(renewed.start_date).getTime() - new Date(renewed.done_at).getTime()).toBe(
    48 * 60 * 60 * 1000,
  );
  expect(new Date(renewed.end_date).getTime() - new Date(renewed.start_date).getTime()).toBe(
    60 * 60 * 1000,
  );
  expect(new Date(renewed.due_date).getTime() - new Date(renewed.end_date).getTime()).toBe(
    60 * 60 * 1000,
  );
  expect(hasLabelTitle(renewed, "vbu:fixed-due-time")).toBe(false);
});

test("recurring Job completion offers an idempotent repair continuation", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Repair recurring Job E2E ${Date.now()}`;
  const taskID = await createRecurringJob(page, title, {
    startDate: localDate(),
    startTime: "16:00",
  });
  let repairRequests = 0;

  await page.route("**/graphql", async (route) => {
    const operation = graphQLOperation(route.request().postData());
    if (operation === "CompleteTask") {
      const response = await route.fetch();
      const body = (await response.json()) as {
        data?: { completeTask?: Record<string, unknown> };
      };
      const payload = body.data?.completeTask;
      if (!payload) throw new Error("real recurring Job completion response is missing");
      await route.fulfill({
        response,
        json: {
          ...body,
          data: {
            ...body.data,
            completeTask: {
              ...payload,
              status: "CONFIRMED_REPAIR_REQUIRED",
              repairCapability: "e2e-recurring-job-repair",
              remainingRepairSteps: ["CREATE_HISTORY_SNAPSHOT"],
            },
          },
        },
      });
      return;
    }
    if (operation === "RepairTaskMetadata") {
      repairRequests += 1;
      const renewed = await vikunjaTask(taskID);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            repairTaskMetadata: {
              status: "CONFIRMED",
              task: graphQLTask(renewed),
              repairCapability: null,
              missingMarkers: [],
              remainingRepairSteps: [],
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/jobs");
  await page.getByRole("button", { name: `Complete ${title}` }).click();
  await expectStatusMessage(
    page,
    "The recurring task renewed, but its due time or History still needs repair.",
  );
  const renewedBeforeRepair = await vikunjaTask(taskID);
  await page.getByRole("button", { name: "Repair history", exact: true }).click();
  await expectStatusMessage(page, `${title} history repaired.`);
  expect(repairRequests).toBe(1);
  const renewedAfterRepair = await vikunjaTask(taskID);
  expect(renewedAfterRepair.start_date).toBe(renewedBeforeRepair.start_date);
  expect(renewedAfterRepair.end_date).toBe(renewedBeforeRepair.end_date);
  expect(renewedAfterRepair.due_date).toBe(renewedBeforeRepair.due_date);
});
