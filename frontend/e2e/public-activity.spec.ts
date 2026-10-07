import { expect, test } from "@playwright/test";
import { discussionGraphQL } from "./discussion-fixture";

type Activity = {
  total: number;
  generatedAt: string;
  refreshAt: string;
  days: { date: string; count: number }[];
  priorities: { priority: string; count: number }[];
};
const query = `query { publicActivity {
  total generatedAt refreshAt days { date count } priorities { priority count }
} }`;

test("public activity supports anonymous fixed aggregates without task access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/activity?project=999&from=2000-01-01");
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
  const first = await discussionGraphQL<{ publicActivity: Activity }>(page, query);
  const second = await discussionGraphQL<{ publicActivity: Activity }>(page, query);
  expect(second).toEqual(first);
  const activity = first.publicActivity;
  expect(activity.days).toHaveLength(14);
  expect(activity.priorities).toHaveLength(6);
  expect(activity.days.reduce((sum, day) => sum + day.count, 0)).toBe(activity.total);
  expect(activity.priorities.reduce((sum, item) => sum + item.count, 0)).toBe(activity.total);
  expect(
    new Date(activity.refreshAt).getTime() - new Date(activity.generatedAt).getTime(),
  ).toBeGreaterThanOrEqual(600_000);
  const rejected = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin },
    data: { query: '{ task(id: "1") { title } }' },
  });
  expect((await rejected.json()).errors).toBeDefined();
  const filtered = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin },
    data: { query: '{ publicActivity(from: "2000-01-01") { total } }' },
  });
  expect((await filtered.json()).errors).toBeDefined();
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
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "PublicActivity") return route.continue();
    await gate;
    await route.continue();
  });
  await page.goto("/activity");
  const placeholders = page.getByRole("status", { name: "Loading activity" }).locator("span");
  await expect(placeholders).toHaveCount(2);
  const boxes = await Promise.all((await placeholders.all()).map((item) => item.boundingBox()));
  release();
  const cards = page.locator("main section");
  await expect(cards).toHaveCount(2);
  for (const [index, card] of (await cards.all()).entries()) {
    expect(await card.boundingBox()).toEqual(boxes[index]);
  }
});
