import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test("login restores an editor deep link and its return destination", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("Editor deep link");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editor deep link" })).toBeVisible();
  const id = page.url().match(/\/tasks\/(\d+)/)?.[1];
  expect(id).toBeTruthy();
  await page.context().clearCookies();
  const path = `/tasks/${id}/edit?returnTo=%2Ftoday`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${id}/edit\\?returnTo=%2Ftoday$`));
  await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Editor deep link");
});

test("shift and duration reject ambiguous DST results without changing fields", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("DST editor job");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "DST editor job" })).toBeVisible();
  const id = page.url().match(/\/tasks\/(\d+)/)?.[1];
  await upstreamTask(id, {
    start_date: "2026-10-24T23:30:00Z",
    end_date: "2026-10-25T02:30:00Z",
    due_date: "2026-10-25T03:30:00Z",
  });
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByText("Shift schedule", { exact: true }).click();
  await select(page, "Shift target", "Start");
  await expect(page.getByRole("button", { name: "Apply shift to fields" })).toBeDisabled();
  await page.getByText("Set duration and completion window", { exact: true }).click();
  await page.getByLabel("Duration", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Apply duration", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ambiguous");
  await expect(page.getByLabel("End time", { exact: true })).toHaveValue("04:30");
  await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("05:30");
});

test("saving unchanged tasks and label-only edits succeeds", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("No-op editor job");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No-op editor job" })).toBeVisible();
  const id = page.url().match(/\/tasks\/(\d+)/)?.[1];
  const before = await upstreamTask(id);
  for (const job of [true, false, true]) {
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.getByLabel("Job", { exact: true }).setChecked(job);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "No-op editor job" })).toBeVisible();
    const after = await upstreamTask(id);
    expect(after.start_date).toBe(before.start_date);
    expect(after.end_date).toBe(before.end_date);
    expect((after.labels ?? []).some((label) => label.title === "job")).toBe(job);
  }
});

test("task editing preserves drafts on conflict and saves fields and schedule", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("Editor test job");
  await page.getByLabel("Duration", { exact: true }).fill("4");
  await expect(page.locator('input[name="durationMinutes"]')).toHaveValue("240");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editor test job" })).toBeVisible();
  const id = page.url().match(/\/tasks\/(\d+)/)?.[1];
  expect(id).toBeTruthy();
  const before = await upstreamTask(id);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Edited job");
  await page.getByLabel("Description", { exact: true }).fill("Changed description");
  await select(page, "Priority", "High");
  await page.getByText("Shift schedule", { exact: true }).click();
  await select(page, "Shift unit", "Minutes");
  await page.getByLabel("Shift by", { exact: true }).fill("56");
  const startBeforePreview = await page.getByLabel("Start time", { exact: true }).inputValue();
  await expect(page.getByText("Preview only — apply to update the date fields.")).toBeVisible();
  await expect(page.getByLabel("Start time", { exact: true })).toHaveValue(startBeforePreview);
  await page.getByRole("button", { name: "Apply shift to fields" }).click();
  await expect(page.getByRole("button", { name: "Apply shift to fields" })).toBeDisabled();
  await expect(page.getByText("Shift applied to date fields.")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Edited job", exact: true })).toBeVisible();
  const after = await upstreamTask(id);
  expect(Date.parse(after.start_date) - Date.parse(before.start_date)).toBe(56 * 60000);
  expect(Date.parse(after.end_date) - Date.parse(after.start_date)).toBe(240 * 60000);
  expect(after.priority).toBe(3);
  expect(after.description).toContain("Changed description");

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Preserve my draft");
  await upstreamTask(id, { title: "Changed elsewhere" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("changed since you opened");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Preserve my draft");
  expect((await upstreamTask(id)).title).toBe("Changed elsewhere");
});

test("Reset autosave clears the whole form and does not refill on job switching", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("Remember this job");
  await page.getByLabel("Duration", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Remember this job" })).toBeVisible();
  await page.goto("/tasks/new?type=one-time");
  await expect(page.getByLabel("Title (optional)")).toHaveValue("Remember this job");
  await page.getByLabel("Description").fill("Discard this draft too");
  await page.getByRole("button", { name: "Reset autosave" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Description")).toHaveValue("");
  await expect(page.getByLabel("Job", { exact: true })).not.toBeChecked();
  await page.getByLabel("Job", { exact: true }).check();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("");
  await expect(page.locator('input[name="durationMinutes"]')).toHaveValue("60");
});

test("editing recurrence and Job mode updates markers while keeping history read-only", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks/new?type=recurring");
  await page.getByLabel("Title", { exact: true }).fill("Recurring editor job");
  await page.getByLabel("Job", { exact: true }).check();
  await page.getByLabel("Every").fill("2");
  await page.getByRole("button", { name: "Create recurring Job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recurring editor job" })).toBeVisible();
  const id = page.url().match(/\/tasks\/(\d+)/)?.[1];
  expect(
    (await upstreamTask(id)).labels?.some((label) => label.title === "vbu:fixed-due-time"),
  ).toBe(true);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Every").fill("3");
  await select(page, "Renewal", "Scheduled cycle");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Recurring editor job" })).toBeVisible();
  const scheduled = await upstreamTask(id);
  expect(scheduled.repeat_after).toBe(3 * 86400);
  expect(scheduled.repeat_mode).toBe(0);
  expect((scheduled.labels ?? []).some((label) => label.title === "vbu:fixed-due-time")).toBe(
    false,
  );
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Recurring", { exact: true }).uncheck();
  await page.getByLabel("Job", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Recurring editor job" })).toBeVisible();
  const plain = await upstreamTask(id);
  expect(plain.repeat_after).toBe(0);
  expect((plain.labels ?? []).some((label) => label.title === "job")).toBe(false);
  await upstreamTask(id, { done: true });
  await page.goto(`/tasks/${id}/edit`);
  await expect(page.getByText("Completed tasks and history are read-only.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
});

test("editor controls fit phone tablet and desktop with accessible names", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("Responsive editor");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Responsive editor" })).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByText("Shift schedule", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Shift by")).toBeVisible();
  await page.getByText("Set duration and completion window", { exact: true }).click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    if (width === 320) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "test-results/editor-320.png", fullPage: true });
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function signIn(page: Page) {
  await page.goto("/today");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/today/);
}

async function select(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function upstreamTask(
  id: string | undefined,
  patch?: {
    title?: string;
    done?: boolean;
    start_date?: string;
    end_date?: string;
    due_date?: string;
  },
) {
  const response = await fetch(`${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${id}`, {
    method: patch ? "PATCH" : "GET",
    headers: {
      Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}`,
      "Content-Type": "application/json",
    },
    ...(patch ? { body: JSON.stringify(patch) } : {}),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as {
    title: string;
    description: string;
    priority: number;
    start_date: string;
    end_date: string;
    repeat_after: number;
    repeat_mode: number;
    labels: { id: number; title: string }[] | null;
  };
}
