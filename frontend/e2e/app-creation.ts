import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { blockBrowserVikunjaCalls, login } from "./app-actions";
import { vikunjaTask } from "./app-api";
import {
  addCalendarDays,
  datePickerButton,
  displayDate,
  displayShortDate,
  localDate,
  localDateTime,
  selectDate,
} from "./app-calendar";
import { projectID } from "./app-fixture";
import { chooseSelectOption } from "./app-layout";

test("week add rows preserve their day and selected project across task types", async ({
  page,
}) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto(`/week?project=${projectID}`);
  await login(page);

  const date = localDate();
  const today = page.locator(`[data-slot="week-day"][data-date="${date}"]`);
  const addTask = today.getByRole("link", { name: /Add task for/ });
  await expect(addTask).toBeVisible();
  await addTask.click();

  await expect(page).toHaveURL(new RegExp(`date=${date}`));
  await expect(page).toHaveURL(new RegExp(`project=${projectID}`));
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(date);
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Daily Tasks");

  await page.getByRole("button", { name: "recurring task" }).click();
  await expect(page.locator('input[name="firstDueDate"]')).toHaveValue(date);
  await page.getByLabel("Job", { exact: true }).check();
  await expect(page.locator('input[name="startDate"]')).toHaveValue(date);
});

test("task creation identifies invalid fields and clears corrected errors", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/tasks/new?type=recurring&returnTo=%2Ftoday");
  await login(page);

  await page.getByRole("textbox", { name: /^Title/ }).fill("   ");
  await selectDate(page, "First due date", "");
  await page.getByLabel("Every").fill("2");
  await chooseSelectOption(page, "Unit", "Months");
  await page.getByRole("button", { name: "Create recurring task" }).click();

  await expect(page.getByText("Check the highlighted fields below.")).toBeVisible();
  await expect(page.getByText("Enter a title.", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose the first due date.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Monthly recurrence supports every 1 month.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Monthly recurrence must use Scheduled cycle.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveAttribute(
    "aria-describedby",
    "title-error",
  );
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeFocused();

  await page.getByRole("textbox", { name: /^Title/ }).fill("Valid recurring task");
  await chooseSelectOption(page, "Priority", "No priority");
  await selectDate(page, "First due date", localDate());
  await page.getByLabel("Every").fill("1");
  await chooseSelectOption(page, "Renewal", "Scheduled cycle");

  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Enter a title.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /^Title/ })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("task creation and display use the Vikunja timezone", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  await login(page);

  // Keep the list expectation independent of whether today's 00:30 has passed.
  const dueDate = addCalendarDays(localDate(), -1);
  const title = `Timezone E2E ${Date.now()}`;
  await page.getByRole("textbox", { name: /^Title/ }).fill(title);
  await selectDate(page, "Due date", dueDate);
  await page.getByLabel("Due time", { exact: true }).fill("00:30");
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(`${displayDate(dueDate)} - 00:30`, { exact: true })).toBeVisible();
  const taskID = page.url().match(/\/tasks\/(\d+)/)?.[1];
  if (!taskID) throw new Error("created timezone task ID is missing from the URL");
  const task = await vikunjaTask(taskID);
  expect(localDateTime(task.due_date)).toBe(`${dueDate}T00:30`);

  await page.reload();
  await expect(page.getByText(`${displayDate(dueDate)} - 00:30`, { exact: true })).toBeVisible();
  await page.goto("/today");
  const taskCard = page.locator('[data-slot="card"]').filter({ hasText: title });
  const schedule = taskCard.locator('[data-slot="task-schedule"]');
  await expect(schedule).toHaveText("OverdueNo priority");
  await expect(schedule).not.toContainText(displayShortDate(dueDate));
});

test("successful creation leaves the next form at defaults and preserves explicit context", async ({
  page,
}) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  await login(page);

  await page.getByRole("textbox", { name: /^Title/ }).fill("   ");
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();
  await expect(page.getByText("Enter a title.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("From last task", { exact: true })).toHaveCount(0);

  const title = `Remembered E2E ${Date.now()}`;
  const dueDate = addCalendarDays(localDate(), 2);
  await page.getByRole("textbox", { name: /^Title/ }).fill(title);
  await chooseSelectOption(page, "Project", "E2E Empty Project");
  await chooseSelectOption(page, "Priority", "High");
  await selectDate(page, "Due date", dueDate);
  await page.getByLabel("Due time", { exact: true }).fill("18:15");
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue("");
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Daily Tasks");
  await expect(page.getByLabel("Priority", { exact: true })).toContainText("No priority");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("");
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("vbu:task-create-autofill:")),
    ),
  ).toEqual([]);

  await page.getByRole("textbox", { name: /^Title/ }).press("ControlOrMeta+a");
  await page.getByRole("textbox", { name: /^Title/ }).pressSequentially(title);
  await expect(page.getByRole("textbox", { name: /^Title/ })).not.toHaveAttribute(
    "aria-describedby",
    /title-autofill/,
  );
  await expect(page.getByText("From last task", { exact: true })).toHaveCount(0);

  const contextualDate = addCalendarDays(dueDate, 1);
  await page.goto(
    `/tasks/new?type=one-time&returnTo=%2Ftoday&date=${contextualDate}&project=${projectID}`,
  );
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue("");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(contextualDate);
  await expect(datePickerButton(page, "Due date")).not.toHaveAttribute(
    "aria-describedby",
    /dueDate-autofill/,
  );
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Daily Tasks");
  await expect(page.getByLabel("Project", { exact: true })).not.toHaveAttribute(
    "aria-describedby",
    /projectId-autofill/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
