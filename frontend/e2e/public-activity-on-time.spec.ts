import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const days = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-10-${String(index + 2).padStart(2, "0")}`,
  count: index === 1 ? 4 : index < 4 ? 1 : 0,
  completedWithDeadline: index === 1 ? 3 : index < 3 ? 1 : 0,
  completedOnTime: index < 2 ? 1 : 0,
}));

test("public activity shows daily on-time samples, real zeros and missing data without overflow", async ({
  page,
}, info) => {
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "PublicActivity") return route.continue();
    await route.fulfill({
      json: {
        data: {
          publicActivity: {
            __typename: "PublicActivity",
            days: days.map((day) => ({ __typename: "ActivityDay", ...day })),
            priorities: [{ __typename: "ActivityPriority", priority: "UNSET", count: 7 }],
            total: 7,
            timezone: "Europe/Kyiv",
            generatedAt: "2026-10-15T12:00:00Z",
            refreshAt: "2026-10-15T13:00:00Z",
          },
        },
      },
    });
  });
  await page.goto("/activity");
  await expect(
    page.getByRole("heading", { name: "On-time completion 40%", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 of 5 completed tasks with deadlines were on time.")).toBeVisible();
  const chart = page.getByRole("img", { name: "Daily on-time completion chart" });
  await expect(chart).toBeVisible();
  await expect(chart.locator("polyline")).toHaveCount(1);
  await expect(chart.locator("circle")).toHaveCount(3);
  const samples = page
    .getByRole("list", { name: "Daily on-time completion" })
    .getByRole("listitem");
  await expect(samples).toHaveCount(14);
  await expect(samples.nth(0)).toContainText("100%");
  await expect(samples.nth(1)).toContainText("33%");
  await expect(samples.nth(2)).toContainText("0%");
  await expect(samples.nth(3)).toContainText("No data");
  await expect(samples.nth(3)).not.toContainText("0%");
  await expect(page.getByText("Europe/Kyiv · 14 calendar days. Cached for 1 hour.")).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  const scroller = page.getByRole("region", { name: "Scrollable on-time chart" });
  await scroller.focus();
  await scroller.press("ArrowRight");
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("on-time-completion.png"), fullPage: true });
});
