import { expect, test } from "@playwright/test";
import { login } from "./app-actions";
import { addCalendarDays, localDate, selectDate } from "./app-calendar";

test("date selection crosses month boundaries in both directions", async ({ page }) => {
  await page.goto("/tasks/new?type=one-time");
  await login(page);
  const monthStart = `${localDate().slice(0, 7)}-01`;
  const nextMonth = `${addCalendarDays(monthStart, 32).slice(0, 7)}-15`;
  const previousMonth = `${addCalendarDays(monthStart, -1).slice(0, 7)}-15`;
  await selectDate(page, "Due date", nextMonth);
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(nextMonth);
  await selectDate(page, "Due date", previousMonth);
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(previousMonth);
  await selectDate(page, "Due date", "");
  await expect(page.locator('input[name="dueDate"]')).toHaveValue("");
});
