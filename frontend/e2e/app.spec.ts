import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const vikunjaURL = requiredEnv("E2E_VIKUNJA_URL");
const vikunjaToken = requiredEnv("E2E_VIKUNJA_API_TOKEN");
const projectID = requiredEnv("E2E_PROJECT_ID");
const emptyProjectID = requiredEnv("E2E_EMPTY_PROJECT_ID");
const vikunjaTimezone = requiredEnv("E2E_TIMEZONE");
const invalidTitle = requiredEnv("E2E_INVALID_TITLE");

test("login restores the requested route and core navigation is accessible", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/jobs?project=all&page=1");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await login(page);
  await expect(page).toHaveURL(/\/jobs/);
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/today/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("desktop workflows match Vikunja state", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/today");
  await login(page);

  const suffix = String(Date.now());
  const oneTime = `One-time E2E ${suffix}`;
  const recurring = `Recurring E2E ${suffix}`;
  const scheduled = `Scheduled E2E ${suffix}`;
  const job = `Job E2E ${suffix}`;
  const unscheduled = `No deadline E2E ${suffix}`;

  const oneTimeId = await createTask(page, "one-time task", oneTime, async () => {
    await page.getByLabel("Due date").fill(localDate());
  });
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: false });
  await expectDateOnlyTask(oneTimeId);
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

  const jobId = await createTask(page, "job", job, async () => {
    await page.getByLabel("Start time").fill(`${localDate()}T09:00`);
    await page.getByLabel("Duration in minutes").fill("45");
    await page.getByLabel("Time to complete after it ends").fill("60");
  });
  const jobTask = await vikunjaTask(jobId);
  expect(new Date(jobTask.end_date).getTime() - new Date(jobTask.start_date).getTime()).toBe(
    45 * 60_000,
  );
  expect(new Date(jobTask.due_date).getTime() - new Date(jobTask.end_date).getTime()).toBe(
    60 * 60_000,
  );
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
    if (message.type() === "error") console.error(`Browser console: ${message.text()}`);
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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
