import { expect, type Page } from "@playwright/test";
import { vikunjaTimezone } from "./app-fixture";

export function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: vikunjaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}`;
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay();
  return addCalendarDays(value, -(day === 0 ? 6 : day - 1));
}

export function localDateTime(value: string) {
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

export function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function displayDate(value: string) {
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

export function displayShortDate(value: string) {
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
  return `${value.slice(8, 10)} ${month}`;
}

export async function selectDate(page: Page, label: string, value: string) {
  await datePickerButton(page, label).click();
  if (!value) {
    await page.getByRole("button", { name: "Clear date" }).click();
    return;
  }
  const target = page.locator(`button[data-day="${value}"]`);
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  for (let months = 0; months < 24 && !(await target.isVisible()); months++) {
    const firstDay = await grid.locator("button[data-day]").first().getAttribute("data-day");
    const month = await grid.getAttribute("aria-label");
    if (!firstDay || !month) throw new Error("Calendar month is unavailable");
    const direction = value < firstDay ? "Previous" : "Next";
    await page.getByRole("button", { name: `Go to the ${direction} Month`, exact: true }).click();
    await expect(grid).not.toHaveAttribute("aria-label", month);
  }
  await target.click();
}

export function datePickerButton(page: Page, label: string) {
  return page.getByRole("button", {
    name: new RegExp(`^(Choose|Change) ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(,|$)`),
  });
}
