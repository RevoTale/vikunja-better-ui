import { expect, test } from "@playwright/test";
import type { TaskListQuery } from "../src/graphql/graphql";
import { discussionFixture } from "./discussion-fixture";

for (const compact of [true, false]) {
  test(`discussion supports skeleton sizing with ${compact ? "compact" : "long"} tasks`, async ({
    page,
  }) => {
    await discussionFixture(page);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/graphql", async (route) => {
      if (route.request().postDataJSON()?.operationName !== "TaskList") return route.continue();
      const response = await route.fetch();
      const body = (await response.json()) as { data: TaskListQuery };
      const source = body.data.tasks.items[0];
      if (!source) throw new Error("Expected a fixture task");
      body.data.tasks.items = [0, 1, 2].map((index) => ({
        ...source,
        id: `compact-${index}`,
        title: compact
          ? "Read"
          : "A detailed task title that must remain fully readable. ".repeat(12),
        description: "",
        project: { ...source.project, title: "Daily" },
        priority: "LOW",
        labels: [],
        kind: "ONE_TIME",
        recurrenceRule: null,
        completionOutcome: null,
        commentCount: index,
        dueAt: index === 1 ? "2020-01-01T08:00:00Z" : null,
        hasDueTime: true,
        startAt: null,
        endAt: null,
        isDone: index === 2,
        isOverdue: index === 1,
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
    const pending = await Promise.all((await skeletons.all()).map((row) => row.boundingBox()));
    release();
    const rows = page
      .locator('[data-slot="card"]')
      .filter({ has: page.locator('[data-slot="task-content"]') });
    await expect(rows).toHaveCount(3);
    for (const [index, row] of (await rows.all()).entries()) {
      const loaded = await row.boundingBox();
      if (compact) {
        expect(loaded).toEqual(pending[index]);
      } else {
        expect(loaded?.width).toBe(pending[index]?.width);
        expect(loaded?.height).toBeGreaterThan(pending[index]?.height ?? 0);
        const title = row.locator('[data-slot="task-content"] a').first();
        expect(
          await title.evaluate((element) => element.scrollHeight <= element.clientHeight),
        ).toBe(true);
      }
      expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
    }
  });
}
