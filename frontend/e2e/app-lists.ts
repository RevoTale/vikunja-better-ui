import { expect, test } from "@playwright/test";
import { blockBrowserVikunjaCalls, createTask, expectStatusMessage, login } from "./app-actions";
import {
  expectGraphQLDeleteRejected,
  graphQLOperation,
  hasLabelTitle,
  searchTasks,
  vikunjaTask,
  vikunjaTaskStatus,
} from "./app-api";
import { addCalendarDays, localDate, localDateTime, selectDate } from "./app-calendar";
import { emptyProjectID, labeledTitle } from "./app-fixture";
import { chooseSelectOption } from "./app-layout";

test("task lists expose loading, empty, error, and project-filter states", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  let delayed = false;
  await page.route("**/graphql", async (route) => {
    if (!delayed && graphQLOperation(route.request().postData()) === "TaskList") {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });
  await page.goto(`/today?project=${emptyProjectID}&page=1`);
  await expect(page.getByText("Loading tasks…", { exact: true })).toBeVisible();
  await expect(page.getByText("No tasks here.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Empty Project");

  await page.unroute("**/graphql");
  let refreshDelay = 400;
  await page.route("**/graphql", async (route) => {
    if (graphQLOperation(route.request().postData()) === "TaskList") {
      await new Promise((resolve) => setTimeout(resolve, refreshDelay));
    }
    await route.continue();
  });
  let refreshResponse = page.waitForResponse(
    (response) => graphQLOperation(response.request().postData()) === "TaskList",
  );
  await chooseSelectOption(page, "Project", "All projects");
  await refreshResponse;
  await expect(page.getByText("Refreshing tasks…", { exact: true })).toHaveCount(0);

  refreshDelay = 1_200;
  refreshResponse = page.waitForResponse(
    (response) => graphQLOperation(response.request().postData()) === "TaskList",
  );
  await chooseSelectOption(page, "Project", "E2E Empty Project");
  await expect(page.getByText("Refreshing tasks…", { exact: true })).toBeVisible();
  await expect(page.getByText("No tasks here.", { exact: true })).toBeVisible();
  await refreshResponse;
  await expect(page.getByText("Refreshing tasks…", { exact: true })).toHaveCount(0);

  await page.unroute("**/graphql");
  await page.route("**/graphql", async (route) => {
    if (["TaskList", "Week"].includes(graphQLOperation(route.request().postData()) ?? "")) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await chooseSelectOption(page, "Project", "All projects");
  await expect(
    page.getByLabel("Notifications").getByText("Tasks could not be refreshed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(labeledTitle, { exact: true })).toBeVisible();

  await page.goto(`/week?project=${emptyProjectID}`);
  await expect(page.getByRole("alert")).toHaveText(
    "Week tasks could not be loaded. Try refreshing this page.",
  );
});

test("skip and delete actions preserve recurring history in Vikunja", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Skip and delete E2E ${Date.now()}`;
  const taskID = await createTask(page, "recurring task", title);
  const before = await vikunjaTask(taskID);

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expectStatusMessage(page, "This occurrence was skipped and the next one is ready.");
  const renewed = await vikunjaTask(taskID);
  expect(renewed.done).toBe(false);
  expect(new Date(renewed.due_date).getTime()).toBeGreaterThan(new Date(before.due_date).getTime());
  expect(renewed.labels.some((label: { title?: string }) => label.title === "vbu:skipped")).toBe(
    false,
  );

  const matching = (await searchTasks(title)).filter(
    (task) => String(task.id) !== taskID && task.title === title,
  );
  expect(matching).toHaveLength(1);
  const snapshot = matching[0];
  if (!snapshot) throw new Error("Completed recurrence snapshot was not created");
  expect(snapshot.done).toBe(true);
  expect(snapshot.repeat_after).toBe(0);
  expect(snapshot.labels.map((label: { title: string }) => label.title)).toEqual(
    expect.arrayContaining(["vbu:recurrence-history", "vbu:skipped"]),
  );
  await page.goto("/history?project=all&page=1");
  const historyCard = page.locator('[data-slot="card"]').filter({ hasText: title });
  await expect(historyCard.getByText("Skipped", { exact: true })).toBeVisible();
  await expect(historyCard.getByText("vbu:skipped", { exact: true })).toHaveCount(0);
  await historyCard.getByRole("link", { name: title }).click();
  await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Delete", exact: true })).toHaveCount(0);
  await expectGraphQLDeleteRejected(page, String(snapshot.id), "TASK_NOT_ACTIVE");

  await page.goto(`/tasks/${taskID}?returnTo=%2Ftoday`);
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Delete ${title}?` })).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskID}`));
  expect((await vikunjaTask(taskID)).id).toBe(Number(taskID));

  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
  expect(await vikunjaTaskStatus(taskID)).toBe(404);
  expect((await vikunjaTask(String(snapshot.id))).done).toBe(true);

  const oneTimeTitle = `Delete one-time E2E ${Date.now()}`;
  const oneTimeID = await createTask(page, "one-time task", oneTimeTitle);
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
  expect(await vikunjaTaskStatus(oneTimeID)).toBe(404);
});

test("completion-based recurrence keeps or releases the configured due time", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const title = `Fixed due time E2E ${Date.now()}`;
  const completionDate = localDate();
  const taskID = await createTask(page, "recurring task", title, async () => {
    await selectDate(page, "First due date", completionDate);
    await page.getByLabel("Due time", { exact: true }).fill("20:00");
    await page.getByLabel("Every").fill("2");
  });

  const setting = page.getByRole("checkbox", { name: /^Keep due time/ });
  await expect(setting).toBeChecked();
  let upstream = await vikunjaTask(taskID);
  expect(hasLabelTitle(upstream, "vbu:fixed-due-time")).toBe(true);

  await page.goto("/today");
  await page.getByRole("button", { name: `Complete ${title}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  upstream = await vikunjaTask(taskID);
  expect(localDateTime(upstream.due_date)).toBe(`${addCalendarDays(completionDate, 2)}T20:00`);
  expect(hasLabelTitle(upstream, "vbu:fixed-due-time")).toBe(true);

  await page.goto(`/tasks/${taskID}?returnTo=%2Ftoday`);
  await page.getByRole("checkbox", { name: /^Keep due time/ }).click();
  await expectStatusMessage(page, "Future occurrences will use the exact elapsed interval.");
  await expect(page.getByRole("checkbox", { name: /^Keep due time/ })).not.toBeChecked();
  upstream = await vikunjaTask(taskID);
  expect(hasLabelTitle(upstream, "vbu:fixed-due-time")).toBe(false);

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("This occurrence was skipped and the next one is ready.", { exact: true }),
  ).toBeVisible();
  upstream = await vikunjaTask(taskID);
  expect(
    Math.abs(new Date(upstream.due_date).getTime() - new Date(upstream.done_at).getTime()),
  ).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 2_000);
  expect(
    Math.abs(new Date(upstream.due_date).getTime() - new Date(upstream.done_at).getTime()),
  ).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 2_000);

  const matching = await searchTasks(title);
  const snapshots = matching.filter((task) => task.done && task.repeat_after === 0);
  expect(snapshots).toHaveLength(2);
  for (const snapshot of snapshots) {
    expect(hasLabelTitle(snapshot, "vbu:fixed-due-time")).toBe(false);
  }
});
