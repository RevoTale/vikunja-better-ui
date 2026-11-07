import { expect, test } from "@playwright/test";
import { createTask, expectStatusMessage, login } from "./app-actions";
import { vikunjaTask } from "./app-api";
import { addCalendarDays, localDate, localDateTime, selectDate } from "./app-calendar";
import { chooseSelectOption } from "./app-layout";

test("automatic availability uses creation time while explicit dates keep midnight", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const day = localDate();
  const finish = addCalendarDays(day, 2);
  for (const type of ["one-time task", "recurring task"] as const) {
    const before = Date.now();
    const id = await createTask(page, type, `Available now ${type} ${before}`, async () => {
      await selectDate(
        page,
        type === "one-time task" ? "Planned finish" : "First due date",
        finish,
      );
      await expect(page.getByText("Available now", { exact: true })).toBeVisible();
    });
    const stored = Date.parse((await vikunjaTask(id)).start_date);
    expect(stored).toBeGreaterThanOrEqual(before - 1000);
    expect(stored).toBeLessThanOrEqual(Date.now());
  }
  const explicit = await createTask(
    page,
    "one-time task",
    `Explicit start ${Date.now()}`,
    async () => {
      await selectDate(page, "Planned finish", finish);
      await selectDate(page, "Available from", day);
      await expect(page.getByText("Available now", { exact: true })).toHaveCount(0);
    },
  );
  expect(localDateTime((await vikunjaTask(explicit)).start_date)).toBe(`${day}T00:00`);
});

test("a deadline needs no duration or availability window", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const day = addCalendarDays(localDate(), -1);
  const title = `Shop by noon ${Date.now()}`;
  const id = await createTask(page, "one-time task", title, async () => {
    await expect(page.getByLabel("Deadline time (optional)", { exact: true })).toBeVisible();
    await selectDate(page, "Deadline (optional)", day);
    await page.getByLabel("Deadline time (optional)", { exact: true }).fill("12:00");
    await expect(page.locator('input[name="durationMinutes"]')).toHaveCount(0);
  });
  const task = await vikunjaTask(id);
  expect(localDateTime(task.due_date)).toBe(`${day}T12:00`);
  expect(task.start_date).toBe("0001-01-01T00:00:00Z");
  expect(task.end_date).toBe("0001-01-01T00:00:00Z");
  expect(
    task.labels?.some((label) => ["vbu:job", "vbu:date-only"].includes(label.title)),
  ).toBeFalsy();
  await page.goto("/today");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await expect(card).toContainText("Overdue");
  await page.goto(`/tasks/${id}/edit`);
  await expect(page.getByLabel("Deadline time", { exact: true })).toHaveValue("12:00");
  await page.getByLabel("Deadline time", { exact: true }).fill("13:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const edited = await vikunjaTask(id);
  expect(localDateTime(edited.due_date)).toBe(`${day}T13:00`);
  expect(edited.start_date).toBe(task.start_date);
  expect(edited.end_date).toBe(task.end_date);
});

test("documented one-hour Job keeps its completion window when edited", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const day = localDate();
  const title = `Shop session ${Date.now()}`;
  const id = await createTask(page, "job", title, async () => {
    await selectDate(page, "Start date", day);
    await page.getByLabel("Start time", { exact: true }).fill("12:00");
    await chooseSelectOption(page, "Duration unit", "Hours");
    await page.getByLabel("Duration", { exact: true }).fill("1");
    await chooseSelectOption(page, "Extra time unit", "Minutes");
    await page.getByLabel("Extra time to finish", { exact: true }).fill("30");
  });
  const created = await vikunjaTask(id);
  expect(localDateTime(created.start_date)).toBe(`${day}T12:00`);
  expect(localDateTime(created.end_date)).toBe(`${day}T13:00`);
  expect(localDateTime(created.due_date)).toBe(`${day}T13:30`);
  await page.goto(`/tasks/${id}/edit`);
  await page.getByLabel("Start time", { exact: true }).fill("13:00");
  await expect(page.getByLabel("End time", { exact: true })).toHaveValue("13:00");
  await page.getByText("Set duration and extra time", { exact: true }).click();
  await chooseSelectOption(page, "Duration unit", "Hours");
  await page.getByLabel("Duration", { exact: true }).fill("1");
  await chooseSelectOption(page, "Extra time unit", "Minutes");
  await page.getByLabel("Extra time to finish", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Apply duration", exact: true }).click();
  await expect(page.getByLabel("End time", { exact: true })).toHaveValue("14:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const edited = await vikunjaTask(id);
  expect(localDateTime(edited.end_date)).toBe(`${day}T14:00`);
  expect(localDateTime(edited.due_date)).toBe(`${day}T14:30`);
});

test("optional start time persists for plans and recurring availability", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const today = localDate();
  const finish = addCalendarDays(today, 5);
  const title = `Timed availability ${Date.now()}`;
  const setClock = async (clock: string) => {
    await page.getByRole("button", { name: "Change availability", exact: true }).click();
    await page.getByText("Add time", { exact: true }).click();
    await page.getByLabel("Start time (optional)", { exact: true }).fill(clock);
    await page.getByRole("button", { name: "Done", exact: true }).click();
  };
  const plan = await createTask(page, "one-time task", title, async () => {
    await selectDate(page, "Planned finish", finish);
    await setClock("14:00");
    await expect(page.getByLabel("Planned finish time", { exact: true })).toBeVisible();
    await page.getByLabel("Planned finish time", { exact: true }).fill("15:00");
    await page.getByRole("button", { name: "Preview Vikunja fields" }).click();
    const preview = page.getByRole("dialog", { name: "Vikunja field preview" });
    await expect(preview.getByText(`${today} 14:00`, { exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "Close", exact: true }).click();
  });
  const planned = await vikunjaTask(plan);
  expect(localDateTime(planned.start_date)).toBe(`${today}T14:00`);
  expect(localDateTime(planned.end_date)).toBe(`${finish}T15:00`);
  await page.goto(`/tasks/${plan}`);
  await page.getByRole("button", { name: /^Edit planning window:/ }).click();
  await selectDate(page, "Planned finish", addCalendarDays(finish, 1));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expectStatusMessage(page, "Changes saved.");
  const shifted = await vikunjaTask(plan);
  expect(localDateTime(shifted.start_date)).toBe(`${today}T14:00`);
  expect(localDateTime(shifted.end_date)).toBe(`${addCalendarDays(finish, 1)}T15:00`);
  await page.getByRole("button", { name: /^Edit planning window:/ }).click();
  await page.getByRole("button", { name: "Change availability", exact: true }).click();
  await page.getByRole("button", { name: "Use automatic start" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expectStatusMessage(page, "Changes saved.");
  expect(localDateTime((await vikunjaTask(plan)).start_date)).toBe(`${today}T00:00`);

  const start = addCalendarDays(today, -1);
  const recurringTitle = `${title} weekly`;
  const series = await createTask(page, "recurring task", recurringTitle, async () => {
    await chooseSelectOption(page, "Unit", "Weeks");
    await chooseSelectOption(page, "Repeat timing", "Fixed schedule");
    await selectDate(page, "First due date", finish);
    await selectDate(page, "Available from", start);
    await setClock("14:00");
  });
  expect(localDateTime((await vikunjaTask(series)).start_date)).toBe(`${start}T14:00`);
  await page.goto("/active");
  await page.getByRole("button", { name: `Complete ${recurringTitle}`, exact: true }).click();
  await expectStatusMessage(page, "Recurring task completed and renewed.");
  const next = await vikunjaTask(series);
  expect(localDateTime(next.start_date)).toBe(`${addCalendarDays(start, 7)}T14:00`);
  expect(localDateTime(next.due_date)).toBe(`${addCalendarDays(finish, 7)}T23:59`);
});
