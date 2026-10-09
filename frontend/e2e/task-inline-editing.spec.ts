import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports inline title and description editing without losing formatting", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  const html =
    "<h2>Outcome</h2><p><strong>Important</strong> and <em>careful</em></p><ul><li>First item</li></ul>";
  await patchTask(page, taskId, { description: html });
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Discard me");
  await page.getByRole("textbox", { name: "Task title", exact: true }).press("Escape");
  await expect(
    page.getByRole("heading", { name: "Discussion journal", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit title: Discussion journal" })).toBeFocused();
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Inline journal");
  await page.getByRole("textbox", { name: "Task title", exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "Inline journal", exact: true })).toBeVisible();
  expect((await readTask(page, taskId)).description).toBe(html);
  await page
    .getByRole("button", { name: "Edit description", exact: true })
    .click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole("textbox", { name: "Task description", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Task description", exact: true })).toHaveCount(0);
  expect((await readTask(page, taskId)).description).toBe(html);
  await page.getByRole("button", { name: "Edit description", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Task description", exact: true });
  await expect(editor.locator("strong, b")).toHaveText("Important");
  const textStyle = (element: HTMLElement | SVGElement) => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight };
  };
  expect(await editor.locator("strong, b").evaluate(textStyle)).toEqual({
    fontSize: "16px",
    lineHeight: "26px",
  });
  await expect(editor.locator("ul li")).toHaveText("First item");
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  await editor.pressSequentially("More context");
  await expect(editor).toContainText("More context");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const description = page.getByRole("region", { name: "Description", exact: true });
  await expect(description).toContainText("More context");
  await expect(description.locator("strong")).toHaveText("Important");
  expect(new URL(page.url()).pathname).toBe(`/tasks/${taskId}`);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("discussion supports inline properties, labels and a valid recurring Job schedule", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  await patchTask(page, taskId, {
    start_date: "2026-10-09T15:00:00Z",
    end_date: "2026-10-09T16:00:00Z",
    due_date: "2026-10-09T17:00:00Z",
  });
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "Edit priority", exact: true }).click();
  await choose(page, "Priority", "High");
  await saveProperty(page);
  await expect(page.getByRole("button", { name: "Edit priority", exact: true })).toContainText(
    "High",
  );
  await page.getByRole("button", { name: "Edit labels", exact: true }).click();
  await page.getByLabel("Find or create label").fill("Inline work");
  await page.getByRole("button", { name: "Create or reuse label" }).click();
  await expect(page.getByLabel("Inline work", { exact: true })).toBeChecked();
  await saveProperty(page);
  await expect(page.getByRole("button", { name: "Edit labels", exact: true })).toContainText(
    "Inline work",
  );
  await page.getByRole("button", { name: "Edit due", exact: true }).click();
  await page.getByLabel("Due time", { exact: true }).fill("21:00");
  await saveProperty(page);
  await page.getByRole("button", { name: "Edit type", exact: true }).click();
  await page.getByLabel("Job", { exact: true }).check();
  await page.getByLabel("Recurring", { exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "Keep start time of day", exact: true }),
  ).toBeChecked();
  await page.getByLabel("Every", { exact: true }).fill("2");
  await saveProperty(page);
  const task = await readTask(page, taskId);
  expect(task.kind).toBe("JOB");
  expect(task.recurrenceRule?.interval).toBe(2);
  expect(task.labels.some((label) => label.title === "Inline work")).toBe(true);
  expect(task.dueAt).toBe("2026-10-09T18:00:00Z");
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await choose(page, "Project", "E2E Empty Project");
  await saveProperty(page);
  await expect(page.getByRole("button", { name: "Edit project", exact: true })).toHaveText(
    "E2E Empty Project",
  );
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await choose(page, "Project", "E2E Daily Tasks");
  await saveProperty(page);
  const width = page.viewportSize()?.width ?? 0;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
});

test("discussion supports inline conflict protection and explicit draft discard", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  const title = page.getByRole("textbox", { name: "Task title", exact: true });
  await title.fill("Keep my edit");
  await patchTask(page, taskId, { title: "Changed elsewhere" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed since you opened");
  await expect(title).toHaveValue("Keep my edit");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  expect((await readTask(page, taskId)).title).toBe("Changed elsewhere");
  await page.getByRole("button", { name: "Reload task and discard edits" }).click();
  await expect(page.getByRole("heading", { name: "Changed elsewhere", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit title: Changed elsewhere" }).click();
  await title.fill("Recovered edit");
  await title.press("Enter");
  await expect(page.getByRole("heading", { name: "Recovered edit", exact: true })).toBeVisible();
});

test("discussion supports read-only history and protects unsupported inline descriptions", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  const description = '<p style="color:red">Native formatting</p>';
  await patchTask(page, taskId, { description });
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByRole("button", { name: "Edit description", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit priority", exact: true }).click();
  await choose(page, "Priority", "Low");
  await saveProperty(page);
  expect((await readTask(page, taskId)).description).toBe(description);
  await page.getByRole("button", { name: "Change status", exact: true }).click();
  await page.getByRole("button", { name: "Complete task", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Task properties" })).toContainText(
    "Completed",
  );
  await expect(page.getByRole("button", { name: "Edit priority", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit title:/ })).toHaveCount(0);
  await page
    .getByRole("complementary", { name: "Task properties" })
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Edit priority", exact: true })).toBeVisible();
});

test("discussion supports validation retries and blocks uncertain inline saves", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  await patchTask(page, taskId, {
    start_date: "2026-10-09T15:00:00Z",
    end_date: "2026-10-09T16:00:00Z",
  });
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "Edit end", exact: true }).click();
  await page.getByLabel("End time", { exact: true }).fill("17:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("end must be after start");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByLabel("End time", { exact: true }).fill("20:00");
  await saveProperty(page);
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  await page
    .getByRole("textbox", { name: "Task title", exact: true })
    .fill("Saved despite lost confirmation");
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string };
    if (body.operationName !== "UpdateTask") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, json: { data: null } });
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be confirmed");
  await expect(page.getByRole("textbox", { name: "Task title", exact: true })).toHaveValue(
    "Saved despite lost confirmation",
  );
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  expect((await readTask(page, taskId)).title).toBe("Saved despite lost confirmation");
  await page.unroute("**/graphql");
  await page.getByRole("button", { name: "Reload task and discard edits" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved despite lost confirmation", exact: true }),
  ).toBeVisible();
});

test("discussion supports confirmed saves when a subsequent refresh fails", async ({ page }) => {
  const { taskId } = await discussionFixture(page);
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Confirmed title");
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string };
    if (body.operationName !== "TaskDetails") return route.continue();
    await route.fulfill({
      json: {
        errors: [
          { message: "Task could not be loaded.", extensions: { code: "UPSTREAM_UNAVAILABLE" } },
        ],
      },
    });
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Changes were saved, but fresh task data could not be loaded.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  expect((await readTask(page, taskId)).title).toBe("Confirmed title");
  await page.unroute("**/graphql");
  await page.getByRole("button", { name: "Reload task and discard edits" }).click();
  await expect(page.getByRole("heading", { name: "Confirmed title", exact: true })).toBeVisible();
});

async function saveProperty(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function patchTask(page: Page, id: string, data: Record<string, unknown>) {
  const result = await page.request.patch(`${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${id}`, {
    headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
    data,
  });
  expect(result.ok()).toBe(true);
}

async function readTask(page: Page, id: string) {
  const result = await discussionGraphQL<{
    task: {
      title: string;
      description: string;
      kind: string;
      dueAt: string;
      recurrenceRule: { interval: number } | null;
      labels: { title: string }[];
    };
  }>(
    page,
    "query($id:ID!) { task(id:$id) { title description kind dueAt recurrenceRule { interval } labels { title } } }",
    { id },
  );
  return result.task;
}
