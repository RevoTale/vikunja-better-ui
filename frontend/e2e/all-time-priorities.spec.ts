import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./app-actions";

test("signed-in activity filters multiple priorities locally with consistent weekly charts", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "PublicAllTimeActivity")
      return route.continue();
    requests++;
    await route.fulfill({
      json: {
        data: {
          publicAllTimeActivity: {
            total: 6,
            timezone: "Europe/Kyiv",
            generatedAt: "2026-10-15T12:00:00Z",
            refreshAt: "2026-10-15T13:00:00Z",
            priorities: [
              { priority: "HIGH", count: 3 },
              { priority: "LOW", count: 3 },
            ],
            weeks: [
              {
                date: "2026-10-05",
                count: 3,
                completedWithDeadline: 2,
                completedOnTime: 1,
                priorities: [
                  { priority: "HIGH", count: 2, completedWithDeadline: 2, completedOnTime: 1 },
                  { priority: "LOW", count: 1, completedWithDeadline: 0, completedOnTime: 0 },
                ],
              },
              {
                date: "2026-10-12",
                count: 3,
                completedWithDeadline: 2,
                completedOnTime: 1,
                priorities: [
                  { priority: "HIGH", count: 1, completedWithDeadline: 1, completedOnTime: 1 },
                  { priority: "LOW", count: 2, completedWithDeadline: 1, completedOnTime: 0 },
                ],
              },
            ],
          },
        },
      },
    });
  });
  await page.goto("/login");
  await login(page);
  await page.goto("/all-time-activity");
  const filter = page.getByRole("group", { name: "Included priorities", exact: true });
  await expect(filter.getByText("6 included · 0 excluded", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "On-time completion 50%" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Weekly on-time completion" })).toContainText(
    "2026-10-05 – 2026-10-11",
  );
  for (const name of ["No priority", "Low", "Medium", "Urgent", "Do now"]) {
    await filter.getByRole("checkbox", { name: `${name}: included`, exact: true }).uncheck();
  }
  await expect(page.getByRole("heading", { name: "3 tasks completed · All time" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "On-time completion 67%" })).toBeVisible();
  await filter.getByRole("checkbox", { name: "Low: excluded", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "On-time completion 50%" })).toBeVisible();
  await filter.getByRole("checkbox", { name: "High: included", exact: true }).uncheck();
  await expect(page.getByRole("heading", { name: "On-time completion 0%" })).toBeVisible();
  await filter.getByRole("checkbox", { name: "Low: included", exact: true }).uncheck();
  await expect(filter.getByRole("status")).toHaveText("0 included · 6 excluded");
  await expect(page.getByRole("heading", { name: "On-time completion No data" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Weekly completions" }).getByRole("listitem"),
  ).toHaveCount(2);
  await filter.getByRole("button", { name: "Include all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "6 tasks completed · All time" })).toBeVisible();
  expect(requests).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});
