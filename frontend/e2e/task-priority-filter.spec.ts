import { expect, type Page, test } from "@playwright/test";
import { login } from "./app-actions";
import { addCalendarDays, localDate } from "./app-calendar";
import { emptyProjectID } from "./app-fixture";
import { chooseSelectOption } from "./app-layout";
import { discussionGraphQL } from "./discussion-fixture";

test("discussion supports priority filters in Today Long term and Jobs with creation defaults", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const suffix = `${test.info().project.name}-${Date.now()}`;
  const { session } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{ session { csrfToken } }",
  );
  const ids: string[] = [];
  try {
    await seedPriorityTasks(page, suffix, session.csrfToken, ids);
    for (const path of ["/today", "/unscheduled", "/jobs"]) {
      await assertPriorityList(page, path, suffix);
    }
  } finally {
    for (const taskId of ids) {
      await discussionGraphQL(
        page,
        "mutation($input: DeleteTaskInput!) { deleteTask(input:$input) { deletedTaskId } }",
        { input: { taskId, csrfToken: session.csrfToken } },
        session.csrfToken,
      );
    }
  }
});

async function seedPriorityTasks(page: Page, suffix: string, csrfToken: string, ids: string[]) {
  for (const priority of ["HIGH", "UNSET"]) {
    const common = { csrfToken, projectId: emptyProjectID, priority };
    const job = await discussionGraphQL<{ createJob: { task: { id: string } } }>(
      page,
      "mutation($input: CreateJobInput!) { createJob(input:$input) { task { id } } }",
      {
        input: {
          ...common,
          title: `Priority job ${priority} ${suffix}`,
          startAt: `${localDate()}T09:00`,
          durationMinutes: 60,
          completionWindowMinutes: 30,
        },
      },
      csrfToken,
    );
    ids.push(job.createJob.task.id);
    const task = await discussionGraphQL<{ createOneTimeTask: { task: { id: string } } }>(
      page,
      "mutation($input: CreateOneTimeTaskInput!) { createOneTimeTask(input:$input) { task { id } } }",
      { input: { ...common, title: `Priority long ${priority} ${suffix}` } },
      csrfToken,
    );
    ids.push(task.createOneTimeTask.task.id);
  }
}

async function assertPriorityList(page: Page, path: string, suffix: string) {
  const kind = path === "/unscheduled" ? "long" : "job";
  const high = `Priority ${kind} HIGH ${suffix}`;
  const unset = `Priority ${kind} UNSET ${suffix}`;
  await page.goto(`${path}?project=${emptyProjectID}&page=3`);
  await chooseSelectOption(page, "Filter by priority", "High");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("page") === "1" &&
      url.searchParams.get("priority") === "HIGH" &&
      url.searchParams.get("project") === emptyProjectID,
  );
  await expect(page.getByRole("link", { name: high, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: unset, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Filter by priority", { exact: true })).toContainText("High");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const create = page.getByRole("link", {
    name: path === "/jobs" ? "New job" : "New task",
    exact: true,
  });
  await create.click();
  await expect(page.getByLabel("Priority", { exact: true })).toContainText("High");
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Empty Project");
  await page.goBack();
  await chooseSelectOption(page, "Filter by priority", "No priority");
  await expect(page.getByRole("link", { name: unset, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: high, exact: true })).toHaveCount(0);
  await chooseSelectOption(page, "Filter by priority", "All priorities");
  await expect(page).toHaveURL((url) => !url.searchParams.has("priority"));
  await expect(page.getByRole("link", { name: high, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: unset, exact: true })).toBeVisible();
}

test("discussion supports priority filtering of real and computed future days and footer defaults", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await chooseSelectOption(page, "Filter by priority", "Low");
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("priority") === "LOW");
  const tomorrow = addCalendarDays(localDate(), 1);
  const day = page.locator('[data-slot="week-day"]');
  await expect(day).toHaveAttribute("data-date", tomorrow);
  await expect(day.getByText("Computed", { exact: true }).first()).toBeVisible();
  await expect(day.getByRole("link", { name: "Take daily vitamins", exact: true })).toBeVisible();
  await expect(day.getByRole("link", { name: "Morning run", exact: true })).toHaveCount(0);
  await page.getByLabel("Filter by label", { exact: true }).click();
  await page.getByRole("option", { name: "focus", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("priority") === "LOW" &&
      url.searchParams.has("label") &&
      url.searchParams.get("date") === tomorrow,
  );
  await page.getByLabel("Filter by label", { exact: true }).click();
  await page.getByRole("option", { name: "All labels", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("priority") === "LOW" &&
      !url.searchParams.has("label") &&
      url.searchParams.get("date") === tomorrow,
  );
  await day.getByRole("link", { name: /^Add task for/ }).click();
  await expect(page.getByLabel("Priority", { exact: true })).toContainText("Low");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(tomorrow);
  await chooseSelectOption(page, "Priority", "Urgent");
  await page.getByRole("button", { name: "recurring task", exact: true }).click();
  await expect(page.getByLabel("Priority", { exact: true })).toContainText("Urgent");
});
