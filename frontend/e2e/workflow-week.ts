import { expect, type Page, test } from "@playwright/test";
import { addCalendarDays, localDate, mondayOfWeek } from "./app-calendar";
import { elementPadding } from "./app-layout";

export async function workflowWeek(page: Page) {
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
    mondayOfWeek(localDate()),
  );
  const todayDay = page.locator(`[data-slot="week-day"][data-date="${localDate()}"]`);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(todayDay).toBeInViewport();
  await expect(page.getByText("Earlier this week", { exact: true })).toHaveCount(0);
  if (localDate() !== mondayOfWeek(localDate())) {
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  }
  const firstTaskContent = page
    .locator('[data-slot="week-day"]')
    .first()
    .locator('[data-slot="card-content"]')
    .first();
  expect(await elementPadding(firstTaskContent)).toEqual({
    top: "12px",
    bottom: "12px",
    left: "16px",
  });
  for (const day of await page.locator('[data-slot="week-day"]').all()) {
    await expect(day.locator('[data-slot="card"]')).not.toHaveCount(0);
  }
  const addTodayTask = todayDay.getByRole("link", { name: /Add task for/ });
  await expect(addTodayTask).toBeVisible();
  if (test.info().project.name.startsWith("phone-")) {
    await expect(addTodayTask).toHaveCSS("min-height", "44px");
  }
  const todayBoundary = todayDay.getByRole("heading", { name: "Today", exact: true });
  await expect(todayBoundary).toHaveAttribute("data-slot", "week-boundary");
  await expect(todayDay.locator("time")).not.toContainText("Today");
  await expect(todayDay.locator("time")).toHaveAttribute("aria-current", "date");
  await expect(todayDay).toHaveAttribute("data-today", "");
  await expect(todayDay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(todayDay).toHaveCSS("box-shadow", "none");
  expect(
    await todayDay
      .locator("header")
      .getByRole("heading")
      .evaluate((element) => getComputedStyle(element).fontFamily),
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
  await expect
    .poll(() => todayDay.evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThanOrEqual(80);
  const appHeaderBox = await page.locator("header.sticky").boundingBox();
  const todayHeadingBox = await todayBoundary.boundingBox();
  if (!appHeaderBox || !todayHeadingBox) {
    throw new Error("Today heading scroll position is not measurable");
  }
  expect(todayHeadingBox.y).toBeGreaterThanOrEqual(appHeaderBox.y + appHeaderBox.height);
  await page.goto("/month");
  await expect(page).toHaveURL(/\/week/);
  await expect(page.getByRole("heading", { name: "This week", exact: true })).toBeVisible();
}
