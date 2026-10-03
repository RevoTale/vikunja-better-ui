import { expect, test } from "@playwright/test";
import { login } from "./app-actions";
import { addCalendarDays, localDate } from "./app-calendar";

test("daily navigation waits for timezone before treating an explicit date as Today", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/today/);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let dayRequests = 0;
  let sessionRequests = 0;
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operationName === "Day") dayRequests++;
    if (body.operationName === "Session") {
      sessionRequests++;
      await gate;
    }
    await route.continue();
  });
  await page.goto(`/today?date=${localDate()}`);
  await expect.poll(() => sessionRequests).toBeGreaterThan(0);
  expect(dayRequests).toBe(0);
  release?.();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="week-day"]')).toHaveCount(0);
  expect(dayRequests).toBe(0);
});

test("daily navigation never renders a late response under the next date", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/today/);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tomorrow = addCalendarDays(localDate(), 1);
  let blocked = false;
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operationName === "Day" && body.variables.input.date === tomorrow) {
      blocked = true;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect.poll(() => blocked).toBe(true);
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  const day = page.locator('[data-slot="week-day"]');
  await expect(day).toHaveAttribute("data-date", addCalendarDays(tomorrow, 1));
  release?.();
  await expect(day).toHaveAttribute("data-date", addCalendarDays(tomorrow, 1));
});
