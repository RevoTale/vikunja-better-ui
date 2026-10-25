import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public activity all-time is anonymous and uses weekly aggregates", async ({ page }) => {
  await page.goto("/all-time-activity");
  await expect(page.getByRole("heading", { name: "All-time activity", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Weekly on-time completion chart" })).toBeVisible();
  await expect(page.getByText("Cached for 1 hour.", { exact: false })).toBeVisible();
  const response = await page.request.get("/public/v1/all-time-activity");
  const body = await response.json();
  expect(body.total).toBeGreaterThanOrEqual(125);
  expect(body.weeks.length).toBeGreaterThan(0);
  expect(body.weeks.length).toBeLessThanOrEqual(13);
  for (const week of body.weeks) {
    expect(new Date(`${week.date}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(week.completedOnTime).toBeLessThanOrEqual(week.completedWithDeadline);
    expect(week.completedWithDeadline).toBeLessThanOrEqual(week.count);
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("public activity all-time stays bounded without filters or extra requests", async ({
  page,
}, info) => {
  let requests = 0;
  const weeks = Array.from({ length: 13 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 3, 13 + index * 7)).toISOString().slice(0, 10),
    count: index + 1,
    completedWithDeadline: index + 1,
    completedOnTime: Math.floor((index + 1) / 2),
  }));
  await page.route("**/public/v1/all-time-activity", async (route) => {
    requests++;
    await route.fulfill({
      json: {
        weeks,
        total: 91,
        priorities: [{ priority: "HIGH", count: 91 }],
        timezone: "Europe/Kyiv",
        generatedAt: "2026-10-15T12:00:00Z",
        refreshAt: "2026-10-15T13:00:00Z",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "All-time activity" }).click();
  const samples = page.getByRole("list", { name: "Weekly completions" }).getByRole("listitem");
  await expect(samples).toHaveCount(13);
  await expect(page.getByRole("group", { name: "Included priorities" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Earlier weeks" })).toHaveCount(0);
  const countPositions = await samples.evaluateAll((items) =>
    items.map((item) => Math.round(item.lastElementChild?.getBoundingClientRect().top ?? -1)),
  );
  expect(new Set(countPositions).size).toBe(1);
  expect(requests).toBe(1);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("all-time-activity.png"), fullPage: true });
});
