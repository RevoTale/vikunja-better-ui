import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";
import { vikunjaTask } from "./app-api";
import { addCalendarDays, localDate, localDateTime, selectDate } from "./app-calendar";
import { projectID } from "./app-fixture";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("create edit and clear reminders without changing the plan", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  const day = addCalendarDays(localDate(), 2);
  const id = await createTask(
    page,
    "one-time task",
    "Reminder independent from planning",
    async () => {
      await page.getByRole("button", { name: "Add reminder", exact: true }).click();
      await selectDate(page, "Reminder 1 date", day);
      await page.getByLabel("Reminder 1 time", { exact: true }).fill("14:00");
      await page.getByRole("button", { name: "Preview Vikunja fields" }).click();
      const preview = page.getByRole("dialog", { name: "Vikunja field preview" });
      await expect(preview.getByText(`${day}T14:00`, { exact: true })).toBeVisible();
      await preview.getByRole("button", { name: "Close", exact: true }).click();
    },
  );
  const created = await vikunjaTask(id);
  expect(created.reminders).toHaveLength(1);
  expect(localDateTime(created.reminders?.[0]?.reminder ?? "")).toBe(`${day}T14:00`);
  expect(created.start_date).toMatch(/^0001-/);
  expect(created.end_date).toMatch(/^0001-/);
  expect(created.due_date).toMatch(/^0001-/);
  await page.goto(`/tasks/${id}/edit`);
  await page.getByLabel("Reminder 1 time", { exact: true }).fill("16:30");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${id}\\?`));
  expect(localDateTime((await vikunjaTask(id)).reminders?.[0]?.reminder ?? "")).toBe(
    `${day}T16:30`,
  );
  await page.goto(`/tasks/${id}/edit`);
  await page.getByRole("button", { name: "Remove reminder 1" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${id}\\?`));
  expect((await vikunjaTask(id)).reminders ?? []).toEqual([]);
});

test("full edit preserves imported seconds and relative reminder rules", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const { task } = await discussionGraphQL<{ task: { version: string; project: { id: string } } }>(
    page,
    "query($id:ID!) { task(id:$id) { version project { id } } }",
    { id: taskId },
    csrfToken,
  );
  const day = addCalendarDays(localDate(), 3);
  const exact = `${day}T08:09:37Z`;
  await discussionGraphQL(
    page,
    "mutation($input:UpdateTaskInput!){updateTask(input:$input){id}}",
    {
      input: {
        csrfToken,
        taskId,
        expectedVersion: task.version,
        projectId: task.project.id,
        title: "Imported reminders",
        description: "",
        priority: "UNSET",
        job: false,
        dueDate: day,
        dueTime: "18:00",
        reminders: [{ at: exact }, { relativeTo: "due_date", relativePeriod: -3600 }],
      },
    },
    csrfToken,
  );
  const before = await vikunjaTask(taskId);
  await page.goto(`/tasks/${taskId}/edit`);
  await page.getByLabel("Title", { exact: true }).fill("Keep imported reminder rules");
  await selectDate(page, "Reminder 1 date", day);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  expect((await vikunjaTask(taskId)).reminders).toEqual(before.reminders);
});

test("native recurrence renews reminders and keeps history reminder-free", async ({ page }) => {
  const { csrfToken } = await discussionFixture(page);
  const today = localDate();
  const result = await discussionGraphQL<{
    createRecurringTask: { task: { id: string; dueAt: string } };
  }>(
    page,
    "mutation($input:CreateRecurringTaskInput!){createRecurringTask(input:$input){task{id dueAt}}}",
    {
      input: {
        csrfToken,
        title: "Recurring reminder",
        projectId: projectID,
        priority: "UNSET",
        firstDueDate: today,
        availableFrom: addCalendarDays(today, -1),
        interval: 1,
        unit: "DAY",
        mode: "FROM_COMPLETION",
        keepDueTime: false,
        reminders: [
          { localAt: `${today}T14:00` },
          { relativeTo: "due_date", relativePeriod: -3600 },
        ],
      },
    },
    csrfToken,
  );
  const live = result.createRecurringTask.task;
  const before = await vikunjaTask(live.id);
  const completed = await discussionGraphQL<{
    completeTask: { status: string; completedTask: { id: string } };
  }>(
    page,
    "mutation($input:CompleteTaskInput!){completeTask(input:$input){status completedTask{id}}}",
    {
      input: {
        csrfToken,
        taskId: live.id,
        expectedKind: "RECURRING",
        expectedRecurring: true,
        expectedDueAt: live.dueAt,
      },
    },
    csrfToken,
  );
  expect(completed.completeTask.status).toBe("CONFIRMED");
  const after = await vikunjaTask(live.id);
  expect(after.reminders).toHaveLength(2);
  const relative = after.reminders?.find((item) => item.relative_to === "due_date");
  expect(relative?.relative_period).toBe(-3600);
  expect(Date.parse(relative?.reminder ?? "")).toBe(Date.parse(after.due_date) - 3600000);
  expect(after.reminders?.find((item) => !item.relative_to)?.reminder).not.toBe(
    before.reminders?.find((item) => !item.relative_to)?.reminder,
  );
  expect((await vikunjaTask(completed.completeTask.completedTask.id)).reminders ?? []).toEqual([]);
});

test("relative presets follow the deadline through create and edit", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  const day = addCalendarDays(localDate(), 3);
  const id = await createTask(page, "one-time task", "Relative reminder presets", async () => {
    await selectDate(page, "Deadline (optional)", day);
    await page.getByLabel("Deadline time (optional)", { exact: true }).fill("18:00");
    await page.getByRole("button", { name: "Add reminder", exact: true }).click();
    await expect(page.getByRole("button", { name: "2 hours before", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  const created = await vikunjaTask(id);
  expect(created.reminders?.[0]?.relative_to).toBe("due_date");
  expect(created.reminders?.[0]?.relative_period).toBe(-7200);
  expect(Date.parse(created.reminders?.[0]?.reminder ?? "")).toBe(
    Date.parse(created.due_date) - 7200000,
  );
  await page.goto(`/tasks/${id}/edit`);
  await page.getByRole("button", { name: "1 day before", exact: true }).click();
  await page.getByLabel("Deadline time", { exact: true }).fill("19:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${id}\\?`));
  const edited = await vikunjaTask(id);
  expect(edited.reminders?.[0]?.relative_period).toBe(-86400);
  expect(Date.parse(edited.reminders?.[0]?.reminder ?? "")).toBe(
    Date.parse(edited.due_date) - 86400000,
  );
  await page.goto(`/tasks/${id}/edit`);
  await page.getByRole("button", { name: "Set a specific date and time" }).click();
  await page.getByLabel("Reminder 1 time", { exact: true }).fill("10:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${id}\\?`));
  expect((await vikunjaTask(id)).reminders?.[0]?.relative_to ?? "").toBe("");
});
