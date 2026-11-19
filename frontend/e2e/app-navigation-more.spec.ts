import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { login } from "./app-actions";
import { graphQLOperation } from "./app-api";
import { emptyProjectID, projectID, vikunjaToken, vikunjaURL } from "./app-fixture";
import { chooseSelectOption } from "./app-layout";
import { discussionGraphQL } from "./discussion-fixture";

test("More keeps secondary task views and activity out of the primary navigation", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);

  const primary = page.locator('nav[aria-label="Main navigation"]:visible');
  await expect(primary.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Week" })).toBeVisible();
  await expect(primary.getByRole("link", { name: /^Active/ })).toBeVisible();
  await expect(primary.getByRole("link", { name: "More" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Timed sessions" })).toHaveCount(0);
  await expect(primary.getByRole("link", { name: "Long term" })).toHaveCount(0);
  await expect(primary.getByRole("link", { name: "History" })).toHaveCount(0);

  await primary.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More", exact: true })).toBeVisible();
  const views = page.getByRole("navigation", { name: "More views" });
  for (const name of [
    "Recurring",
    "This month",
    "This year",
    "Custom period",
    "Timed sessions",
    "Long term",
    "History",
    "Last 14 days",
    "All-time activity",
  ]) {
    await expect(views.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

  await views.getByRole("link", { name: /^Timed sessions/ }).click();
  await expect(page).toHaveURL(/\/jobs/);
  await expect(page.getByRole("heading", { name: "Timed sessions", exact: true })).toBeVisible();
  await expect(primary.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
});

test("Active work count stays visible across routes and independent of list filters", async ({
  page,
  request,
}) => {
  const headers = { Authorization: `Bearer ${vikunjaToken}` };
  const now = Date.now();
  const created = await request.post(`${vikunjaURL}/api/v2/projects/${projectID}/tasks`, {
    headers,
    data: {
      title: `Active navigation count ${now}`,
      start_date: new Date(now - 86_400_000).toISOString(),
      end_date: new Date(now + 86_400_000).toISOString(),
    },
  });
  expect(created.ok()).toBe(true);
  const task = (await created.json()) as { id: number };
  try {
    await page.goto("/login");
    await login(page);
    const { all, filtered } = await discussionGraphQL<{
      all: { totalItems: number };
      filtered: { totalItems: number };
    }>(
      page,
      `query($project: ID!) {
        all: tasks(input: {scope: ACTIVE, pageSize: 1}) {totalItems}
        filtered: tasks(input: {scope: ACTIVE, projectId: $project, pageSize: 1}) {totalItems}
      }`,
      { project: emptyProjectID },
    );
    expect(all.totalItems).toBeGreaterThan(filtered.totalItems);
    const link = activeNavigationLink(page);
    const badge = link.locator('[data-slot="active-work-count"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(String(all.totalItems));
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    const titleCount = page
      .getByRole("heading", { level: 1, name: /^Active work/ })
      .getByRole("img");
    await expect(titleCount).toHaveText(String(all.totalItems));
    await chooseSelectOption(page, "Project", "E2E Empty Project");
    await expect(titleCount).toHaveText(String(filtered.totalItems));
    await expect(badge).toHaveText(String(all.totalItems));
    await page.goto(`/tasks/${task.id}`);
    await expect(badge).toHaveText(String(all.totalItems));
    await page.getByRole("button", { name: "Complete task", exact: true }).click();
    await expect(badge).toHaveText(String(all.totalItems - 1));
  } finally {
    const removed = await request.delete(`${vikunjaURL}/api/v2/tasks/${task.id}`, { headers });
    expect(removed.ok()).toBe(true);
  }
});

test("Active work count shows a confirmed zero only after a successful read", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/graphql", async (route) => {
    if (graphQLOperation(route.request().postData()) !== "ActiveWorkTaskCount")
      return route.continue();
    await gate;
    return route.fulfill({
      json: fail
        ? { errors: [{ message: "Count unavailable" }] }
        : { data: { activeWorkTaskCount: 0 } },
    });
  });
  try {
    await page.goto("/login");
    await login(page);
    const badge = activeNavigationLink(page).locator('[data-slot="active-work-count"]');
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(badge).toHaveAttribute("aria-busy", "true");
    await expect(badge).not.toHaveText("0");
    release();
    await expect(badge).toHaveAccessibleName(/unavailable/i);
    await expect(badge).not.toHaveText("0");
    fail = false;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(badge).toHaveText("0");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-busy", "false");
  } finally {
    release();
  }
});

test("Active work count stays busy when returning to a page during refresh", async ({ page }) => {
  let release = () => {};
  const heldRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/graphql", async (route) => {
    if (graphQLOperation(route.request().postData()) !== "ActiveWorkTaskCount")
      return route.continue();
    const count = ++reads;
    if (count === 2) await heldRead;
    return route.fulfill({ json: { data: { activeWorkTaskCount: count } } });
  });
  try {
    await page.goto("/login");
    await login(page);
    const badge = activeNavigationLink(page).locator('[data-slot="active-work-count"]');
    await expect(badge).toHaveText("1");
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await navigation.getByRole("link", { name: "Week" }).click();
    await expect.poll(() => reads).toBe(2);
    const today = navigation.getByRole("link", { name: /^Today/ });
    await today.click();
    await expect(today).toHaveAttribute("aria-current", "page");
    await expect(badge).toHaveAttribute("aria-busy", "true");
    await expect(badge).toHaveText("1");
    release();
    await expect(badge).toHaveText("3");
    await expect(badge).toHaveAttribute("aria-busy", "false");
  } finally {
    release();
  }
});

function activeNavigationLink(page: Page) {
  return page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /^Active/ });
}
