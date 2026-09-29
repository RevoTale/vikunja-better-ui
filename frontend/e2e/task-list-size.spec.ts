import { expect, test } from "@playwright/test";
import type { TaskListQuery } from "../src/graphql/graphql";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports task-list skeleton geometry and two-line content", async ({
  page,
}, testInfo) => {
  await discussionFixture(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "TaskList") return route.continue();
    const response = await route.fetch();
    const body = (await response.json()) as { data: TaskListQuery };
    const task = body.data.tasks.items[0];
    if (!task) throw new Error("Expected the isolated fixture to contain a task for today");
    // Control content length/count while exercising the real list and loading components.
    body.data.tasks.items = [0, 1, 2].map((index) => ({
      ...task,
      id: `size-${index}`,
      title: "Read a chapter today",
      priority: "LOW",
      project: { ...task.project, title: "Daily" },
      labels: [],
      kind: "ONE_TIME",
      recurrenceRule: null,
      completionOutcome: null,
      commentCount: 2,
      dueAt: null,
      startAt: null,
      endAt: null,
      isDone: false,
      isOverdue: false,
    }));
    body.data.tasks.totalItems = 3;
    body.data.tasks.totalPages = 1;
    body.data.tasks.hasMore = false;
    await gate;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/today?project=all&page=1");
  const skeletons = page.locator('[data-slot="task-loading-row"]');
  await expect(skeletons).toHaveCount(3);
  await expect(skeletons.first().locator('[data-slot="task-loading-badge"]')).toHaveCount(3);
  const pending = await skeletons.first().boundingBox();
  expect(pending).not.toBeNull();
  await page.screenshot({ path: testInfo.outputPath("list-skeleton.png") });
  release();
  const rows = page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="task-content"]') });
  await expect(rows).toHaveCount(3);
  const loaded = await rows.first().boundingBox();
  expect(loaded).not.toBeNull();
  if (!pending || !loaded) throw new Error("Task geometry is unavailable");
  expect(loaded.x).toBe(pending.x);
  expect(loaded.width).toBe(pending.width);
  expect(loaded.y).toBe(pending.y);
  const title = rows.first().getByRole("link", { name: "Read a chapter today", exact: true });
  const titleHeight = await title.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(titleHeight.height).toBeLessThanOrEqual(titleHeight.lineHeight * 2);
  if (testInfo.project.use.viewport?.width === 320) {
    expect(titleHeight.height).toBe(titleHeight.lineHeight * 2);
  }
  const metadata = rows.first().locator('[data-slot="task-metadata"]');
  const badgeRows = await metadata.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    rowHeight: Math.max(
      ...Array.from(element.children, (child) => child.getBoundingClientRect().height),
    ),
    gap: Number.parseFloat(getComputedStyle(element).rowGap),
  }));
  expect(badgeRows.height).toBeLessThanOrEqual(badgeRows.rowHeight * 2 + badgeRows.gap + 1);
  // Allow one additional title line and badge row, not unrelated spacing changes.
  expect(Math.abs(loaded.height - pending.height)).toBeLessThanOrEqual(
    titleHeight.lineHeight + badgeRows.rowHeight + badgeRows.gap + 1,
  );
  for (const row of await rows.all()) {
    expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const badge of await row.locator('[data-slot="badge"]').all()) {
      expect(await badge.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
        true,
      );
    }
  }
  await page.screenshot({ path: testInfo.outputPath("list-loaded.png") });
});
