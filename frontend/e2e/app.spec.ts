import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

const vikunjaURL = requiredEnv("E2E_VIKUNJA_URL");
const appURL = requiredEnv("E2E_BASE_URL");
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
  await expect(page.getByText("Prepare weekly status update", { exact: true })).toBeVisible();
  await expectBrandTimezone(page);
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page).toHaveURL(/\/tasks\/new\?type=job/);
  await expect(page.getByRole("heading", { name: "New job" })).toBeVisible();
  await expect(page.getByLabel("Title (optional)")).toBeFocused();
  await expect(datePickerButton(page, "Start date")).toBeVisible();
  const startTime = page.getByLabel("Start time", { exact: true });
  await expect(startTime).toBeVisible();
  await expect(startTime).toHaveAttribute("type", "time");
  await expect(page.getByLabel("Project", { exact: true }).locator("svg")).toBeVisible();
  const controlHeights = await Promise.all(
    [
      page.getByLabel("Title (optional)"),
      datePickerButton(page, "Start date"),
      startTime,
      page.getByLabel("Project", { exact: true }),
    ].map(async (control) => (await control.boundingBox())?.height),
  );
  expect(controlHeights).toEqual([44, 44, 44, 44]);
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
  if (test.info().project.name.startsWith("phone-")) {
    await datePickerButton(page, "Start date").click();
    await expect(page.getByRole("heading", { name: "Choose start date" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  }
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/jobs\?project=all&page=1/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/today/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("Take daily vitamins", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Scheduled-cycle task (every 2 days)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("From-completion task (after 2 days)", { exact: true }),
  ).toBeVisible();
  await expectTaskRowLayout(page, labeledTitle, "focus");
  await expectBaseUICSP(page);
});

test("login displays the GraphQL error returned by the app", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.route("**/graphql", async (route) => {
    const operation = route.request().postDataJSON() as { operationName?: string };
    if (operation.operationName !== "Login") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [
          {
            message: "Vikunja is unavailable. Try again shortly.",
            path: ["login"],
            extensions: { code: "UPSTREAM_UNAVAILABLE" },
          },
        ],
        data: null,
      }),
    });
  });

  await page.goto("/login");
  await login(page);

  await expect(page.getByText("Vikunja is unavailable. Try again shortly.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("theme follows system color scheme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page).toHaveTitle("Better Vikunja — Fast recurring task workflows");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A focused, self-hosted interface for fast, predictable recurring-task workflows on Vikunja.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow, noarchive",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  await expect(page.locator('[data-slot="brand-mark"]')).toBeVisible();
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
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-describedby", "title-error");
  await expect(page.getByLabel("Title")).toBeFocused();

  await page.getByLabel("Title").fill("Valid recurring task");
  await chooseSelectOption(page, "Priority", "No priority");
  await selectDate(page, "First due date", localDate());
  await page.getByLabel("Every").fill("1");
  await chooseSelectOption(page, "Renewal", "Scheduled cycle");

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
  await expect(taskCard.locator('[data-slot="task-schedule"]')).toContainText(
    `${displayShortDate(dueDate)}00:30`,
  );
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
  await expect(page.getByText("Invalid: both recurring and job", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Complete ${invalidTitle}` })).toHaveCount(0);
  await chooseSelectOption(page, "Project", "E2E Daily Tasks");
  await expect(page).toHaveURL(new RegExp(`project=${projectID}`));
  expect(await elementPadding(page.locator('[data-slot="card-content"]').first())).toEqual({
    top: "16px",
    left: "16px",
  });
  await page.goto("/week");
  const weekHeading = page.getByRole("heading", { name: "This week", exact: true });
  await expect(weekHeading).toBeVisible();
  const bodyFontFamily = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(await weekHeading.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(
    bodyFontFamily,
  );
  await expect(page.locator('[data-slot="week-day"]')).toHaveCount(7);
  await expect(page.locator('[data-slot="week-day"]').first()).toHaveAttribute(
    "data-date",
    localDate(),
  );
  const firstTaskContent = page
    .locator('[data-slot="week-day"]')
    .first()
    .locator('[data-slot="card-content"]')
    .first();
  expect(await elementPadding(firstTaskContent)).toEqual({ top: "12px", left: "16px" });
  for (const day of await page.locator('[data-slot="week-day"]').all()) {
    await expect(day.locator('[data-slot="card"]')).not.toHaveCount(0);
  }
  const todayDay = page.locator(`[data-slot="week-day"][data-date="${localDate()}"]`);
  await expect(todayDay.locator("time")).toContainText("Today");
  await expect(todayDay.getByText("Today", { exact: true })).toHaveAttribute("data-slot", "badge");
  await expect(todayDay.locator("time")).toHaveAttribute("aria-current", "date");
  await expect(todayDay).toHaveAttribute("data-today", "");
  await expect(todayDay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(todayDay).toHaveCSS("box-shadow", "none");
  expect(
    await todayDay.getByRole("heading").evaluate((element) => getComputedStyle(element).fontFamily),
  ).toBe(bodyFontFamily);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/week=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { name: "Week", exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="week-day"]').first()).toHaveAttribute(
    "data-date",
    addCalendarDays(mondayOfWeek(localDate()), 7),
  );
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/week\?project=all$/);
  await expect(todayDay).toBeInViewport();
  await page.goto("/month");
  await expect(page.getByRole("heading", { name: "This month" })).toBeVisible();
  await page.goto("/today");
  await expectTaskPriorityLayout(page, oneTime, "High");
  await page.getByRole("button", { name: `Complete ${oneTime}` }).click();
  await expectStatusMessage(page, `${oneTime} completed.`);
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: true });
  await page.getByRole("button", { name: "Undo" }).click();
  await expectVikunjaTask(oneTimeId, { title: oneTime, done: false });

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
  await page.getByRole("button", { name: `Complete ${scheduled}` }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
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
  await page.getByLabel("Start time", { exact: true }).fill("10:15");
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
  const jobCard = page.locator('[data-slot="card"]').filter({ hasText: job });
  await expect(jobCard.getByText(job, { exact: true })).toBeVisible();
  await expect(jobCard.locator('[data-slot="task-schedule"]')).toContainText("10:15–11:00");
  await expect(jobCard.getByText("Complete by 12:00", { exact: true })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByText(job, { exact: true })).toBeVisible();

  await createTask(page, "one-time task", unscheduled);
  await page.goto("/unscheduled");
  await expect(page.getByText(unscheduled, { exact: true })).toBeVisible();

  await page.goto("/history");
  const historyTasks = page.locator('main a[href^="/tasks/"]:not([href^="/tasks/new"])');
  await expect(historyTasks).toHaveCount(30);
  await page.getByRole("button", { name: "Go to page 5" }).click();
  await expect(page).toHaveURL(/\/history\?project=all&page=5/);
  await expect.poll(() => historyTasks.count()).toBeGreaterThan(0);
  await expect(historyTasks).not.toHaveCount(30);
  await expect(page.getByRole("button", { name: "Go to page 5" })).toHaveAttribute(
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
  const typeButton = page.getByRole("button", { name: type, exact: true });
  await typeButton.click();
  await expect(typeButton).toHaveAttribute("aria-pressed", "true");
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
async function vikunjaTaskStatus(id: string) {
  const response = await fetch(`${vikunjaURL}/api/v2/tasks/${id}`, {
    headers: { Authorization: `Bearer ${vikunjaToken}` },
  });
  return response.status;
}
async function searchTasks(search: string) {
  const result = await api(`/tasks?q=${encodeURIComponent(search)}&per_page=100`);
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
async function expectStatusMessage(page: Page, message: string) {
  await expect(page.getByRole("status").filter({ hasText: message })).toHaveText(message);
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
async function expectGraphQLDeleteRejected(page: Page, taskID: string, code: string) {
  const sessionResponse = await page.request.post("/graphql", {
    headers: { Origin: appURL },
    data: { query: "query E2ESession { session { csrfToken } }" },
  });
  const session = await sessionResponse.json();
  const csrfToken = session.data?.session?.csrfToken;
  if (typeof csrfToken !== "string") throw new Error("E2E CSRF token is missing");
  const deleteResponse = await page.request.post("/graphql", {
    headers: { Origin: appURL, "X-CSRF-Token": csrfToken },
    data: {
      query:
        "mutation E2EDelete($input: DeleteTaskInput!) { deleteTask(input: $input) { deletedTaskId } }",
      variables: { input: { csrfToken, taskId: taskID } },
    },
  });
  const payload = await deleteResponse.json();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
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

function elementPadding(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { top: style.paddingTop, left: style.paddingLeft };
  });
}

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay();
  return addCalendarDays(value, -(day === 0 ? 6 : day - 1));
}

function hasLabelTitle(task: { labels?: Array<{ title?: string }> }, title: string) {
  return task.labels?.some((label) => label.title === title) ?? false;
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
function displayShortDate(value: string) {
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
  return `${value.slice(8, 10)} ${month}`;
}
async function selectDate(page: Page, label: string, value: string) {
  await datePickerButton(page, label).click();
  if (!value) {
    await page.getByRole("button", { name: "Clear date" }).click();
    return;
  }
  await page.locator(`button[data-day="${value}"]`).click();
}
function datePickerButton(page: Page, label: string) {
  return page.getByRole("button", {
    name: new RegExp(`^(Choose|Change) ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(,|$)`),
  });
}
async function expectTaskRowLayout(page: Page, title: string, label: string) {
  const isPhone = test.info().project.name.startsWith("phone-");
  const card = page.locator('[data-slot="card"]').filter({ hasText: title });
  await expect(card).toHaveCSS("padding-top", "0px");
  await expect(card).toHaveCSS("padding-bottom", "0px");
  const scheduleBox = await card.locator('[data-slot="task-schedule"]').boundingBox();
  const titleBox = await card.getByRole("link", { name: title }).boundingBox();
  const kindBox = await card.getByText("One-time", { exact: true }).boundingBox();
  const labelBox = await card.getByText(label, { exact: true }).boundingBox();
  const completeBox = await card.getByRole("button", { name: `Complete ${title}` }).boundingBox();
  const metadata = card.locator('[data-slot="task-metadata"]');
  const metadataBox = await metadata.boundingBox();
  const project = metadata.locator('[data-slot="task-project"]');
  const projectBadge = project.locator('[data-slot="badge"]');
  const projectBox = await project.boundingBox();
  if (
    !scheduleBox ||
    !titleBox ||
    !kindBox ||
    !labelBox ||
    !completeBox ||
    !metadataBox ||
    !projectBox
  ) {
    throw new Error("task row layout is not measurable");
  }
  expect(scheduleBox.x).toBeLessThan(titleBox.x);
  expect(labelBox.y).toBeGreaterThan(titleBox.y);
  expect(labelBox.y).toBeLessThanOrEqual(projectBox.y + 2);
  expect(projectBox.y).toBeLessThanOrEqual(kindBox.y + 2);
  expect(Math.abs(kindBox.height - labelBox.height)).toBeLessThanOrEqual(1);
  expect(completeBox.x).toBeGreaterThan(titleBox.x);
  expect(completeBox.y).toBeLessThan(projectBox.y);
  expect(projectBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
  await expect(projectBadge).toHaveText("Project: E2E Daily Tasks");
  await expect(projectBadge).toHaveClass(/bg-secondary/);
  await expect(metadata).toHaveCSS("flex-wrap", "wrap");
  await expect(metadata).toHaveCSS("justify-content", "flex-end");
  await expect(metadata.locator("li").first()).toHaveText("High");
  expect(Math.abs(kindBox.x + kindBox.width - (metadataBox.x + metadataBox.width))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  if (isPhone) {
    const headerBox = await page.locator("header").boundingBox();
    const headingBox = await page.getByRole("heading", { name: "Today" }).boundingBox();
    const filterBox = await page.getByLabel("Project", { exact: true }).boundingBox();
    const firstCardBox = await page.locator('[data-slot="card"]').first().boundingBox();
    const invalidKind = page.getByText("Invalid: both recurring and job", { exact: true });
    const invalidCardBox = await page
      .locator('[data-slot="card"]')
      .filter({ hasText: invalidTitle })
      .boundingBox();
    const invalidKindBox = await invalidKind.boundingBox();
    if (
      !headerBox ||
      !headingBox ||
      !filterBox ||
      !firstCardBox ||
      !invalidCardBox ||
      !invalidKindBox
    ) {
      throw new Error("mobile task list spacing is not measurable");
    }
    expect(headingBox.y - (headerBox.y + headerBox.height)).toBeLessThanOrEqual(20);
    expect(firstCardBox.y - (filterBox.y + filterBox.height)).toBeLessThanOrEqual(20);
    expect(await renderedLineCount(invalidKind)).toBeLessThanOrEqual(2);
    expect(invalidKindBox.x + invalidKindBox.width).toBeLessThanOrEqual(
      invalidCardBox.x + invalidCardBox.width,
    );
  } else {
    expect(labelBox.x + labelBox.width).toBeLessThan(projectBox.x);
    expect(projectBox.x + projectBox.width).toBeLessThan(kindBox.x);
  }
}
async function expectTaskPriorityLayout(page: Page, title: string, priority: string) {
  const card = page.locator('[data-slot="card"]').filter({ hasText: title });
  const metadata = card.locator('[data-slot="task-metadata"]');
  const priorityBox = await metadata.getByText(priority, { exact: true }).boundingBox();
  const projectBox = await metadata.locator('[data-slot="task-project"]').boundingBox();
  const kindBox = await metadata.getByText("One-time", { exact: true }).boundingBox();
  if (!priorityBox || !projectBox || !kindBox) {
    throw new Error("task priority metadata layout is not measurable");
  }
  expect(Math.abs(priorityBox.y - projectBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(priorityBox.y - kindBox.y)).toBeLessThanOrEqual(2);
  expect(priorityBox.x + priorityBox.width).toBeLessThan(projectBox.x);
  expect(projectBox.x + projectBox.width).toBeLessThan(kindBox.x);
}
async function chooseSelectOption(page: Page, label: string, option: string) {
  const trigger = page.getByLabel(label, { exact: true });
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(trigger).toContainText(option);
}
async function renderedLineCount(locator: Locator) {
  return locator.evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return Math.round(element.getBoundingClientRect().height / lineHeight);
  });
}
async function expectBrandTimezone(page: Page) {
  const brand = page.getByRole("link", { name: /Better Vikunja/ }).filter({ visible: true });
  const timezone = page
    .getByText(`Timezone ${vikunjaTimezone}`, { exact: true })
    .filter({ visible: true });
  await expect(brand).toHaveAttribute("href", "/today?project=all&page=1");
  await expect(timezone).toBeVisible();
  const brandBox = await brand.boundingBox();
  const timezoneBox = await timezone.boundingBox();
  if (!brandBox || !timezoneBox) throw new Error("brand timezone layout is not measurable");
  expect(timezoneBox.y).toBeGreaterThan(brandBox.y);
}
async function expectBaseUICSP(page: Page) {
  const nonce = await page.locator('meta[name="csp-nonce"]').getAttribute("content");
  expect(nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  const styleNonces = await page
    .locator("style")
    .evaluateAll((styles) => styles.map((style) => style.getAttribute("nonce")));
  expect(styleNonces.every((styleNonce) => styleNonce === nonce)).toBe(true);
}
function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
