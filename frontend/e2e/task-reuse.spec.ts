import { expect, test } from "@playwright/test";
import { discussionGraphQL } from "./discussion-fixture";

test("task labels support explicit reuse without overwriting typed fields", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  const { session } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{session {csrfToken}}",
  );
  const { taskLabels } = await discussionGraphQL<{ taskLabels: { id: string; title: string }[] }>(
    page,
    "{taskLabels {id title}}",
  );
  const label = taskLabels.find((item) => item.title === "work");
  expect(label).toBeDefined();
  for (const recurring of [false, true]) {
    const mutation = recurring
      ? "mutation($input: CreateRecurringTaskInput!){createRecurringTask(input:$input){task{id}}}"
      : "mutation($input: CreateOneTimeTaskInput!){createOneTimeTask(input:$input){task{id}}}";
    const title = recurring ? "Last recurring task" : "Last ordinary task";
    await discussionGraphQL(
      page,
      mutation,
      {
        input: {
          csrfToken: session.csrfToken,
          title,
          projectId: process.env["E2E_PROJECT_ID"],
          priority: "LOW",
          ...(recurring
            ? {
                firstDueDate: "2026-10-06",
                dueTime: "09:00",
                interval: 1,
                unit: "DAY",
                mode: "FROM_COMPLETION",
                keepDueTime: false,
              }
            : {}),
        },
      },
      session.csrfToken,
    );
    const previous = await discussionGraphQL<{ taskReuseValues: { title: string } | null }>(
      page,
      "query($recurring:Boolean!){taskReuseValues(job:false,recurring:$recurring){title}}",
      { recurring },
    );
    expect(previous.taskReuseValues?.title).toBe(title);
    await discussionGraphQL(
      page,
      "mutation($input: CreateJobInput!){createJob(input:$input){task{id}}}",
      {
        input: {
          csrfToken: session.csrfToken,
          title: recurring ? "Last recurring shift" : "Last work shift",
          projectId: process.env["E2E_PROJECT_ID"],
          priority: "HIGH",
          labelIds: [label?.id],
          startAt: "2026-10-06T09:00",
          durationMinutes: 240,
          completionWindowMinutes: 30,
          recurrence: recurring
            ? { interval: 2, unit: "DAY", mode: "FROM_COMPLETION", keepDueTime: false }
            : null,
        },
      },
      session.csrfToken,
    );
  }
  await page.goto("/tasks/new?type=job&date=2026-10-08");
  const reused = await discussionGraphQL<{ taskReuseValues: { title: string } | null }>(
    page,
    "{taskReuseValues(job:true,recurring:false){title}}",
  );
  expect(reused.taskReuseValues?.title).toBe("Last work shift");
  await expect(page.getByRole("button", { name: "Use last title", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("");
  await page.getByLabel("Title (optional)").fill("Keep my text");
  await page.getByRole("button", { name: "Use last duration", exact: true }).click();
  await expect(page.locator('input[name="durationMinutes"]')).toHaveValue("240");
  await expect(page.getByLabel("Title (optional)")).toHaveValue("Keep my text");
  await expect(page.locator('input[name="startDate"]')).toHaveValue("2026-10-08");
  await page.getByRole("checkbox", { name: "focus", exact: true }).check();
  await page.getByRole("button", { name: "Use last labels", exact: true }).click();
  await page.getByRole("button", { name: "Use last labels", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "work", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "focus", exact: true })).toBeChecked();
  await expect(page.locator('input[name="labelIds"]')).toHaveCount(2);
  await page.getByRole("button", { name: "Use last title", exact: true }).click();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("Last work shift");
  await page.getByRole("button", { name: "recurring task", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Last work shift");
  await expect(page.getByRole("button", { name: "Use last title", exact: true })).toHaveAttribute(
    "title",
    "Use last title: Last recurring shift",
  );
  await page.getByRole("button", { name: "Use last title", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Last recurring shift");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("task reuse late responses never change input", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operationName !== "TaskReuseValues") return route.continue();
    await gate;
    await route.fulfill({
      json: {
        data: {
          taskReuseValues: {
            taskId: "123",
            title: "Late previous title",
            projectId: "1",
            priority: "HIGH",
            labels: [],
            durationMinutes: null,
            completionWindowMinutes: null,
          },
        },
      },
    });
  });
  await page.goto("/tasks/new?type=one-time");
  await page.getByLabel("Title", { exact: true }).fill("Typed while waiting");
  await expect(page.getByRole("button", { name: "Use last title", exact: true })).toBeDisabled();
  release?.();
  await expect(page.getByRole("button", { name: "Use last title", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Typed while waiting");
  await expect(
    page.getByRole("button", { name: "Create one-time task", exact: true }),
  ).toBeEnabled();
});

test("task reuse failure does not block creating a task", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "TaskReuseValues") return route.continue();
    await route.fulfill({
      json: { data: { taskReuseValues: null }, errors: [{ message: "Unavailable" }] },
    });
  });
  await page.goto("/tasks/new?type=one-time");
  await page.getByLabel("Title", { exact: true }).fill("Creation still works");
  await expect(page.getByRole("button", { name: "Retry previous values" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use last title", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/\d+/);
});

test("task reuse cancels the pending request for the previous type", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let oldRequestStarted = false;
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operationName !== "TaskReuseValues") return route.continue();
    const recurring = body.variables.recurring;
    if (!recurring) {
      oldRequestStarted = true;
      await gate;
    }
    await route.fulfill({
      json: {
        data: {
          taskReuseValues: {
            taskId: recurring ? "124" : "123",
            title: recurring ? "Recurring suggestion" : "Old suggestion",
            projectId: "1",
            priority: "HIGH",
            labels: [],
            durationMinutes: null,
            completionWindowMinutes: null,
          },
        },
      },
    });
  });
  await page.goto("/tasks/new?type=one-time");
  await expect.poll(() => oldRequestStarted).toBe(true);
  await page.getByLabel("Title", { exact: true }).fill("Keep my draft");
  const cancelledRequest = page.waitForEvent("requestfailed", (request) => {
    const body = request.postDataJSON();
    return body?.operationName === "TaskReuseValues" && !body.variables.recurring;
  });
  await page.getByRole("button", { name: "recurring task", exact: true }).click();
  const reuse = page.getByRole("button", { name: "Use last title", exact: true });
  await expect(reuse).toHaveAttribute("title", "Use last title: Recurring suggestion");
  await cancelledRequest;
  release?.();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Keep my draft");
  await reuse.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Recurring suggestion");
});
