import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const vikunjaURL = requiredEnv("E2E_VIKUNJA_URL");
const vikunjaToken = requiredEnv("E2E_VIKUNJA_API_TOKEN");
const projectID = requiredEnv("E2E_PROJECT_ID");
const emptyProjectID = requiredEnv("E2E_EMPTY_PROJECT_ID");
const vikunjaTimezone = requiredEnv("E2E_TIMEZONE");
const invalidTitle = requiredEnv("E2E_INVALID_TITLE");
const labeledTitle = requiredEnv("E2E_LABELED_TITLE");

test("login restores the requested route and core navigation is accessible", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/jobs?project=all&page=1");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await login(page);
  await expect(page).toHaveURL(/\/jobs/);
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expectBrandTimezone(page);
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page).toHaveURL(/\/tasks\/new\?type=job/);
  await expect(page.getByRole("heading", { name: "New job" })).toBeVisible();
  await expect(page.getByLabel("Title (optional)")).toBeFocused();
  await expect(page.getByLabel("Start date", { exact: true })).toBeVisible();
  const startHour = page.getByLabel("Start time", { exact: true });
  await expect(startHour).toBeVisible();
  await expect(startHour.locator("option")).toHaveCount(25);
  await expect(startHour.locator("option", { hasText: /AM|PM/ })).toHaveCount(0);
  const taskTypeButtons = page.getByRole("group", { name: "Task type" }).getByRole("button");
  await expect(taskTypeButtons).toHaveCount(3);
  for (const button of await taskTypeButtons.all()) {
    expect(
      await button.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true);
  }
  if (test.info().project.name === "phone-320") {
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }).getByText("No date"),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/jobs\?project=all&page=1/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/today/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expectTaskRowLayout(page, labeledTitle, "focus");
});

test("theme follows system color scheme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect
    .poll(() =>
      page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(233, 228, 216)");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(20, 20, 20)");
});

test("task creation identifies invalid fields and clears corrected errors", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/tasks/new?type=recurring&returnTo=%2Ftoday");
  await login(page);

  await page.getByLabel("Title").fill("   ");
  await selectDate(page, "First due date", "");
  await page.getByLabel("Every").fill("2");
  await page.getByLabel("Unit").selectOption("MONTH");
  await page.getByRole("button", { name: "Create recurring task" }).click();

  await expect(page.getByRole("alert")).toHaveText("Check the highlighted fields below.");
  await expect(page.getByText("Enter a title.", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose the first due date.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Monthly recurrence supports every 1 month.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Monthly recurrence must use Scheduled cycle.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-describedby", "title-error");
  await expect(page.getByLabel("Title")).toBeFocused();

  await page.getByLabel("Title").fill("Valid recurring task");
  await page.getByLabel("Priority").selectOption("UNSET");
  await selectDate(page, "First due date", localDate());
  await page.getByLabel("Every").fill("1");
  await page.getByLabel("Renewal").selectOption("SCHEDULED_CYCLE");

  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Enter a title.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Title")).not.toHaveAttribute("aria-invalid", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("task creation and display use the Vikunja timezone", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  await login(page);

  const dueDate = localDate();
  const title = `Timezone E2E ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await selectDate(page, "Due date", dueDate);
  await page.getByLabel("Due time", { exact: true }).selectOption("00");
  await page.getByLabel("Due time minute").selectOption("30");
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
  await expect(taskCard).toContainText(`${displayDate(dueDate)} - 00:30`);
});

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
    await page.getByLabel("Priority").selectOption("HIGH");
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
  await expect(page.getByText("Invalid: both recurring and job", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Complete ${invalidTitle}` })).toHaveCount(0);
  await page.getByLabel("Project").selectOption(projectID);
  await expect(page).toHaveURL(new RegExp(`project=${projectID}`));
  await page.goto("/week");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await page.goto("/month");
  await expect(page.getByRole("heading", { name: "This month" })).toBeVisible();
  await page.goto("/today");
  await page.getByRole("button", { name: `Complete ${oneTime}` }).click();
  await expect(page.getByRole("status")).toHaveText(`${oneTime} completed.`);
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: true });
  await page.getByRole("button", { name: "Undo" }).click();
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: false });

  const recurringId = await createTask(page, "recurring task", recurring);
  const recurringBefore = await vikunjaTask(recurringId);
  expect(recurringBefore.repeat_mode).toBe(2);
  await expectDateOnlyTask(recurringId);
  await page.goto("/today");
  await page.getByRole("button", { name: `Complete ${recurring}` }).click();
  await expect(page.getByRole("status")).toHaveText("Recurring task completed and renewed.");
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
    await page.getByLabel("Renewal").selectOption("SCHEDULED_CYCLE");
  });
  const scheduledBefore = await vikunjaTask(scheduledId);
  expect(scheduledBefore.repeat_mode).toBe(0);
  await page.goto("/today");
  await page.getByRole("button", { name: `Complete ${scheduled}` }).click();
  await expect(page.getByRole("status")).toHaveText("Recurring task completed and renewed.");
  const scheduledAfter = await vikunjaTask(scheduledId);
  expect(String(scheduledAfter.id)).toBe(scheduledId);
  expect(scheduledAfter.done).toBe(false);
  await expectRenewedDate(page, scheduledId, scheduledAfter.due_date);

  await page.goto("/tasks/new?type=job&returnTo=%2Fjobs");
  const jobDate = localDate();
  await expect(page.getByLabel("Title (optional)")).toHaveAttribute(
    "placeholder",
    `Job ${displayDate(jobDate)} - 09:00`,
  );
  const job = `Job ${displayDate(jobDate)} - 10:15`;
  await selectDate(page, "Start date", jobDate);
  await page.getByLabel("Start time", { exact: true }).selectOption("10");
  await page.getByLabel("Start time minute").selectOption("15");
  await expect(page.getByLabel("Title (optional)")).toHaveAttribute("placeholder", job);
  await page.getByLabel("Duration in minutes").fill("45");
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
  await expect(page.getByText(job, { exact: true })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByText(job, { exact: true })).toBeVisible();

  await createTask(page, "one-time task", unscheduled);
  await page.goto("/unscheduled");
  await expect(page.getByText(unscheduled, { exact: true })).toBeVisible();

  await page.goto("/history");
  const historyTasks = page.locator('main a[href^="/tasks/"]:not([href^="/tasks/new"])');
  await expect(historyTasks).toHaveCount(30);
  await page.getByRole("button", { name: "Go to page 2" }).click();
  await expect(page).toHaveURL(/\/history\?project=all&page=2/);
  await expect.poll(() => historyTasks.count()).toBeGreaterThan(0);
  await expect(historyTasks).not.toHaveCount(30);
  await expect(page.getByRole("button", { name: "Go to page 2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Go to next page" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

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
  await expect(page.getByLabel("Project")).toHaveValue(emptyProjectID);

  await page.unroute("**/graphql");
  await page.route("**/graphql", async (route) => {
    if (graphQLOperation(route.request().postData()) === "TaskList") {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.goto(`/week?project=${emptyProjectID}&page=1`);
  await expect(page.getByRole("alert")).toHaveText(
    "Tasks could not be loaded. Try refreshing this page.",
  );
});

async function login(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function createTask(
  page: Page,
  type: "one-time task" | "recurring task" | "job",
  title: string,
  fill?: () => Promise<void>,
) {
  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  await page.getByRole("button", { name: type, exact: true }).click();
  await page.getByLabel("Title").fill(title);
  if (fill) await fill();
  await page.getByRole("button", { name: `Create ${type}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const match = page.url().match(/\/tasks\/(\d+)/);
  if (!match?.[1]) throw new Error("created task ID is missing from the URL");
  return match[1];
}

async function blockBrowserVikunjaCalls(page: Page) {
  page.on("pageerror", (error) => console.error(`Browser error: ${error.stack ?? error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      console.error(
        `Browser console: ${message.text()} (${location.url}:${location.lineNumber}:${location.columnNumber})`,
      );
    }
  });
  page.on("request", (request) => {
    if (request.url().startsWith(vikunjaURL)) throw new Error("Browser called Vikunja directly");
  });
}

async function vikunjaTask(id: string) {
  return api(`/tasks/${id}`);
}
async function searchTasks(search: string) {
  const result = await api(`/tasks?s=${encodeURIComponent(search)}&per_page=100`);
  return Array.isArray(result) ? result : (result.items ?? []);
}
async function expectVikunjaTask(id: string, expected: { title: string; done: boolean }) {
  await expect
    .poll(async () => {
      const task = await vikunjaTask(id);
      return { title: task.title, done: task.done };
    })
    .toEqual(expected);
}
async function expectDateOnlyTask(id: string) {
  const task = await vikunjaTask(id);
  expect(task.labels.some((label: { title?: string }) => label.title === "vbu:date-only")).toBe(
    true,
  );
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: vikunjaTimezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(task.due_date));
  expect(time).toBe("23:59:59");
}
async function expectRenewedDate(page: Page, id: string, dueDate: string) {
  await page.goto(`/tasks/${id}?returnTo=%2Ftoday`);
  const localDueDate = localDateTime(dueDate).slice(0, 10);
  await expect(page.getByText(displayDate(localDueDate), { exact: true })).toBeVisible();
}
function graphQLOperation(body: string | null) {
  if (!body) return undefined;
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || !("operationName" in parsed)) return undefined;
  return typeof parsed.operationName === "string" ? parsed.operationName : undefined;
}
async function api(path: string) {
  const response = await fetch(`${vikunjaURL}/api/v2${path}`, {
    headers: { Authorization: `Bearer ${vikunjaToken}` },
  });
  if (!response.ok) throw new Error(`Vikunja ${path}: ${response.status}`);
  return response.json();
}
function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: vikunjaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}`;
}
function localDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: vikunjaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}T${datePart(parts, "hour")}:${datePart(parts, "minute")}`;
}
function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}
function displayDate(value: string) {
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}
async function selectDate(page: Page, label: string, value: string) {
  const day = page.getByLabel(label, { exact: true });
  if (!value) {
    await day.selectOption("");
    return;
  }
  await day.selectOption(value.slice(8, 10));
  await page.getByLabel(`${label} month`).selectOption(value.slice(5, 7));
  await page.getByLabel(`${label} year`).selectOption(value.slice(0, 4));
}
async function expectTaskRowLayout(page: Page, title: string, label: string) {
  const card = page.locator('[data-slot="card"]').filter({ hasText: title });
  const titleBox = await card.getByRole("link", { name: title }).boundingBox();
  const labelBox = await card.getByText(label, { exact: true }).boundingBox();
  const completeBox = await card.getByRole("button", { name: `Complete ${title}` }).boundingBox();
  if (!titleBox || !labelBox || !completeBox) throw new Error("task row layout is not measurable");
  expect(labelBox.y).toBeGreaterThan(titleBox.y);
  expect(completeBox.x).toBeGreaterThan(titleBox.x);
}
async function expectBrandTimezone(page: Page) {
  const brand = page.getByText("Better Vikunja", { exact: true }).filter({ visible: true });
  const timezone = page
    .getByText(`Vikunja time · ${vikunjaTimezone}`, { exact: true })
    .filter({ visible: true });
  await expect(timezone).toBeVisible();
  const brandBox = await brand.boundingBox();
  const timezoneBox = await timezone.boundingBox();
  if (!brandBox || !timezoneBox) throw new Error("brand timezone layout is not measurable");
  expect(timezoneBox.y).toBeGreaterThan(brandBox.y);
}
function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
