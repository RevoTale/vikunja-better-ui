import { expect, test } from "@playwright/test";
import { login } from "./app-actions";

type Activity = {
  total: number;
  generatedAt: string;
  refreshAt: string;
  days: { date: string; count: number; completedWithDeadline: number; completedOnTime: number }[];
  priorities: { priority: string; count: number }[];
};

test("public activity supports anonymous fixed aggregates without task access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByText("Better Vikunja · Last 14 days")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Completed by priority" })).toBeVisible();
  const days = page.getByRole("list", { name: "Daily completions" }).getByRole("listitem");
  await expect(days).toHaveCount(14);
  const firstBox = await days.nth(0).boundingBox();
  const nextWeek = await days.nth(7).boundingBox();
  expect(firstBox).not.toBeNull();
  expect(nextWeek).not.toBeNull();
  expect(Math.abs((firstBox?.x ?? 0) - (nextWeek?.x ?? 0))).toBeLessThan(1);
  expect((nextWeek?.y ?? 0) - (firstBox?.y ?? 0)).toBeGreaterThan(0);
  const first = (await (await page.request.get("/public/v1/activity")).json()) as Activity;
  const second = (await (await page.request.get("/public/v1/activity")).json()) as Activity;
  expect(second).toEqual(first);
  const activity = first;
  expect(activity.days).toHaveLength(14);
  expect(activity.priorities).toHaveLength(6);
  expect(activity.days.reduce((sum, day) => sum + day.count, 0)).toBe(activity.total);
  expect(activity.priorities.reduce((sum, item) => sum + item.count, 0)).toBe(activity.total);
  expect(
    new Date(activity.refreshAt).getTime() - new Date(activity.generatedAt).getTime(),
  ).toBeGreaterThanOrEqual(3_600_000);
  for (const day of activity.days) {
    expect(day.completedOnTime).toBeGreaterThanOrEqual(0);
    expect(day.completedOnTime).toBeLessThanOrEqual(day.completedWithDeadline);
    expect(day.completedWithDeadline).toBeLessThanOrEqual(day.count);
  }
  const rejected = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin },
    data: { query: '{ task(id: "1") { title } }' },
  });
  expect((await rejected.json()).errors).toBeDefined();
  const anonymousActivity = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin },
    data: { query: "{ publicActivity { total } }" },
  });
  expect((await anonymousActivity.json()).errors).toBeDefined();
  expect((await page.request.get("/public/v1/activity?priority=high")).status()).toBe(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(errors).toEqual([]);
  const screenshot = test.info().outputPath("activity.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await test
    .info()
    .attach("Public activity layout", { path: screenshot, contentType: "image/png" });
});

test("public activity keeps chart geometry while loading", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/public/v1/activity", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Last 14 days" }).click();
  const placeholders = page.getByRole("status", { name: "Loading activity" }).locator("span");
  await expect(placeholders).toHaveCount(3);
  const boxes = await Promise.all((await placeholders.all()).map((item) => item.boundingBox()));
  release();
  const cards = page.locator("main > section");
  await expect(cards).toHaveCount(3);
  for (const [index, card] of (await cards.all()).entries()) {
    expect(await card.boundingBox()).toEqual(boxes[index]);
  }
});

test("public activity identifies the cached snapshot until private data arrives", async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "PublicActivity") {
      await route.continue();
      return;
    }
    await gate;
    await route.continue();
  });
  await page.goto("/login");
  await login(page);
  await page.goto("/activity");
  await expect(page.getByText("Updating with current private data…")).toBeVisible();
  await expect(
    page.getByText("Public snapshot cached for 1 hour.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Current private data.", { exact: false })).toHaveCount(0);
  release();
  await expect(page.getByText("Current private data.", { exact: false })).toBeVisible();
});
