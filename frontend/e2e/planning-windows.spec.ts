import { expect, test } from "@playwright/test";
import { createTask, expectStatusMessage, login } from "./app-actions";
import { vikunjaTask } from "./app-api";
import { addCalendarDays, localDate, localDateTime, selectDate } from "./app-calendar";
import { emptyProjectID } from "./app-fixture";
import { chooseSelectOption, openTaskLabels } from "./app-layout";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
});

test("weekly availability advances with its due day on the same live task", async ({ page }) => {
  const today = localDate();
  const due = addCalendarDays(today, 3);
  const title = `Prepare weekly report ${Date.now()}`;
  const id = await createTask(page, "recurring task", title, async () => {
    await chooseSelectOption(page, "Unit", "Weeks");
    await chooseSelectOption(page, "Repeat timing", "Fixed schedule");
    await selectDate(page, "First due date", due);
    await selectDate(page, "Available from", today);
    await page.getByRole("button", { name: "Do once", exact: true }).click();
    await page.getByRole("button", { name: "Repeat", exact: true }).click();
    await expect(page.getByRole("button", { name: "Change availability" })).toBeVisible();
  });
  const before = await vikunjaTask(id);
  expect(localDateTime(before.start_date)).toBe(`${today}T00:00`);
  expect(before.labels.some((label) => label.title === "vbu:recurring-availability")).toBe(true);
  await page.goto("/active");
  await page.getByRole("button", { name: `Complete ${title}`, exact: true }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  const after = await vikunjaTask(id);
  expect(after.id).toBe(before.id);
  expect(after.done).toBe(false);
  expect(localDateTime(after.start_date)).toBe(`${addCalendarDays(today, 7)}T00:00`);
  expect(localDateTime(after.due_date)).toBe(`${addCalendarDays(due, 7)}T23:59`);
  expect(after.end_date).toMatch(/^0001-/);
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("task form sections preserve collapsed fields on create and edit", async ({ page }) => {
  const job = page
    .getByRole("region", { name: "Task", exact: true })
    .getByRole("checkbox", { name: "Schedule a timed session" });

  const title = `Organized task ${Date.now()}`;
  const headings = page.locator("form section h2");
  const organization = page.getByRole("region", { name: "Labels", exact: true });
  const priority = page.getByLabel("Priority", { exact: true });
  const description = page.getByRole("textbox", { name: "Description", exact: true });
  const id = await createTask(page, "one-time task", title, async () => {
    await expect(headings).toHaveCount(3);
    await job.check();
    await expect(
      page
        .getByRole("region", { name: "Plan", exact: true })
        .getByLabel("Start time", { exact: true }),
    ).toBeVisible();
    await job.uncheck();
    await page.getByRole("button", { name: "About Plan", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Plan", exact: true })).toContainText(
      "whether it repeats",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Plan", exact: true })).toHaveCount(0);
    for (const [index, name] of ["Task", "Plan", "Labels"].entries()) {
      await expect(headings.nth(index)).toHaveAccessibleName(name);
    }
    await expect(organization.getByLabel("Find or create label")).toBeHidden();
    await expect(description).toHaveCount(0);
    await page.getByText("Add description", { exact: true }).click();
    await description.fill("Bring the notes");
    await page
      .locator("summary")
      .filter({ hasText: /^Description$/ })
      .click();
    await openTaskLabels(page);
    await chooseSelectOption(page, "Priority", "High");
    await page.getByRole("checkbox", { name: "work", exact: true }).check();
    await organization.getByRole("button", { name: "Done editing labels" }).click();
    await expect(priority).toContainText("High");
    await expect(
      organization.getByText("work", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  });
  const stored = await vikunjaTask(id);
  expect(stored.priority).toBe(3);
  expect(stored.labels.some((label) => label.title === "work")).toBe(true);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(job).not.toBeChecked();
  await expect(priority).toContainText("High");
  await expect(
    organization.getByText("work", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(description).toHaveText("Bring the notes");
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Title", { exact: true }).fill(updatedTitle);
  await page.getByRole("button", { name: "Preview Vikunja fields" }).click();
  const preview = page.getByRole("dialog", { name: "Vikunja field preview" });
  await expect(preview.getByText(updatedTitle, { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Why priority?" }).click();
  await expect(page.getByText(/The selected priority is high/)).toBeVisible();
  await page.keyboard.press("Escape");
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  expect((await vikunjaTask(id)).title).toBe(title);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  expect((await vikunjaTask(id)).labels.some((label) => label.title === "work")).toBe(true);
});

test("new task distinguishes a planned finish from a monthly series", async ({ page }) => {
  const beforeCreate = Date.now();
  const title = `An hour for my plan ${Date.now()}`;
  const today = localDate();
  const finish = addCalendarDays(today, 24);
  const id = await createTask(page, "one-time task", title, async () => {
    await expect(page.getByRole("button", { name: "This month", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Choose Available from/ })).toHaveCount(0);
    await selectDate(page, "Planned finish", finish);
    await page.getByRole("button", { name: "Preview Vikunja fields" }).click();
    const preview = page.getByRole("dialog", { name: "Vikunja field preview" });
    await expect(preview.getByText(`${finish} 23:59:59`, { exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "Why end_date?" }).click();
    await expect(page.getByText("The entire planned finish day is available.")).toBeVisible();
    await page.keyboard.press("Escape");
    await preview.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Available now", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Planned finish time", { exact: true })).toBeVisible();
    await page.getByLabel("Planned finish time", { exact: true }).fill("15:00");
    await page.getByRole("button", { name: "Preview Vikunja fields" }).click();
    await expect(preview.getByText(`${finish} 15:00`, { exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "Close", exact: true }).click();
    await openTaskLabels(page);
    await page.getByLabel("Find or create label").fill("1h");
    await page.getByRole("button", { name: /^(Create|Select) label “/ }).click();
    await expect(page.getByRole("checkbox", { name: "1h", exact: true })).toBeChecked();
  });
  const oneTime = await vikunjaTask(id);
  expect(Date.parse(oneTime.start_date)).toBeGreaterThanOrEqual(beforeCreate - 1000);
  expect(Date.parse(oneTime.start_date)).toBeLessThanOrEqual(Date.now());
  expect(localDateTime(oneTime.end_date)).toBe(`${finish}T15:00`);
  expect(oneTime.repeat_after).toBe(0);
  expect(oneTime.labels.some((label) => label.title === "1h")).toBe(true);

  const series = await createTask(page, "recurring task", `${title} monthly`, async () => {
    await chooseSelectOption(page, "Unit", "Months");
    await expect(page.getByText("Repeat every month on the calendar.")).toBeVisible();
    await expect(page.getByLabel("Every", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Repeat timing", { exact: true })).toContainText("Fixed schedule");
    await expect(page.getByRole("button", { name: "This month", exact: true })).toHaveCount(0);
  });
  const recurring = await vikunjaTask(series);
  expect(recurring.repeat_mode).toBe(1);
  expect(recurring.repeat_after).toBeGreaterThan(0);
});

test("active work combines ordinary labels, date ordering and Revisit first", async ({ page }) => {
  const today = localDate();
  const prefix = `Check active order ${Date.now()} `;
  const single = `${prefix}once`;
  const revisit = `${prefix}again`;
  for (const title of [single, revisit]) {
    const days = title === revisit ? 3 : 1;
    await createTask(page, "one-time task", title, async () => {
      await openTaskLabels(page);
      await chooseSelectOption(page, "Project", "E2E Empty Project");
      await selectDate(page, "Available from", addCalendarDays(today, -days));
      await selectDate(page, "Planned finish", addCalendarDays(today, days));
      await page.getByRole("checkbox", { name: "focus", exact: true }).check();
      if (title === revisit) {
        await page.getByLabel("Find or create label").fill("Revisit");
        await page.getByRole("button", { name: /^(Create|Select) label “/ }).click();
        await expect(page.getByRole("checkbox", { name: "Revisit", exact: true })).toBeChecked();
      }
    });
  }
  await page.goto(`/active?project=${emptyProjectID}`);
  const rows = page.getByRole("link", { name: new RegExp(prefix) });
  await expect(rows).toHaveText([single, revisit]);
  await chooseSelectOption(page, "Filter by label", "focus");
  await chooseSelectOption(page, "Sort active work", "Start · earliest first");
  await expect(rows).toHaveText([revisit, single]);
  await chooseSelectOption(page, "Sort active work", "Start · latest first");
  await expect(rows).toHaveText([single, revisit]);
  const pin = page.getByRole("button", { name: "Revisit first" });
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveText([revisit, single]);
  await page.reload();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveText([revisit, single]);
  await pin.click();
  await expect(rows).toHaveText([single, revisit]);
  await pin.click();
  await expect(rows).toHaveText([revisit, single]);
  await chooseSelectOption(page, "Sort active work", "Label · A to Z");
  await chooseSelectOption(page, "Filter by label", "Revisit");
  await expect(rows).toHaveText([revisit]);
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Finish in period" }).click();
  await expect(page.getByLabel("Filter by label")).toContainText("Revisit");
  expect(new URL(page.url()).searchParams.has("revisitFirst")).toBe(false);
  await page.goBack();
  await expect(rows).toHaveText([revisit]);
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Sort active work")).toContainText("Label · A to Z");
  await chooseSelectOption(page, "Filter by label", "All labels");
  for (const title of [revisit, single]) {
    await page.getByRole("button", { name: `Complete ${title}`, exact: true }).click();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
  }
});

test("planning windows separate active work from today's completions", async ({ page }) => {
  const today = localDate();
  const finish = addCalendarDays(today, 30);
  const title = `Plan a picnic with friends ${Date.now()}`;
  const id = await createTask(page, "one-time task", title, async () => {
    await openTaskLabels(page);
    await chooseSelectOption(page, "Project", "E2E Empty Project");
    await selectDate(page, "Available from", today);
    await selectDate(page, "Planned finish", finish);
  });
  const stored = await vikunjaTask(id);
  expect(localDateTime(stored.start_date)).toBe(`${today}T00:00`);
  expect(localDateTime(stored.end_date)).toBe(`${finish}T23:59`);
  expect(stored.due_date).toMatch(/^0001-/);
  const item = page.getByRole("link", { name: title, exact: true });
  await page.goto(`/active?project=${emptyProjectID}`);
  await expect(item).toBeVisible();
  await chooseSelectOption(page, "Filter by priority", "No priority");
  await page.getByRole("link", { name: "Finish in period" }).click();
  await expect(page.getByLabel("Filter by priority")).toContainText("No priority");
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Empty Project");
  await page.goto(`/today?project=${emptyProjectID}`);
  await expect(page.getByLabel("Project", { exact: true })).toContainText("E2E Empty Project");
  await expect(page.getByText("Loading tasks…", { exact: true })).toHaveCount(0);
  await expect(item).toHaveCount(0);
  await page.goto(`/plan?period=custom&from=${finish}&through=${finish}&project=${emptyProjectID}`);
  await expect(item).toBeVisible();
  await chooseSelectOption(page, "Filter by priority", "High");
  await expect(page.getByText("No tasks here.", { exact: true })).toBeVisible();
  await chooseSelectOption(page, "Filter by priority", "All priorities");
  await expect(item).toBeVisible();
  await item.click();
  await page.getByRole("button", { name: /^Edit planning window:/ }).click();
  await selectDate(page, "Available from", addCalendarDays(today, 2));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: /^Edit planning window:/ }).click();
  await expect(page.getByText("Available from today", { exact: true })).toBeVisible();
  await selectDate(page, "Available from", addCalendarDays(today, 2));
  await page.getByRole("button", { name: "Change availability" }).click();
  await page.getByRole("button", { name: "Use automatic start" }).click();
  await selectDate(page, "Planned finish", today);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await page.goto(`/today?project=${emptyProjectID}`);
  await expect(item).toBeVisible();
  await page.goto(`/today?project=${emptyProjectID}&page=99`);
  await expect(page.getByText("No tasks remain on this page.")).toBeVisible();
  await expect(page.getByText("Nothing left to finish today.")).toHaveCount(0);
  await page.getByRole("button", { name: "Show remaining tasks" }).click();
  await expect(item).toBeVisible();
  await page.getByRole("button", { name: `Complete ${title}`, exact: true }).click();
  await expect(item).toHaveCount(0);
  await expect.poll(async () => (await vikunjaTask(id)).done).toBe(true);
});
