import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports task-list counts and direct navigation", async ({ page }, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const create = (bodyHtml: string) =>
    discussionGraphQL<{ createTaskComment: { id: string } }>(
      page,
      "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
      { input: { taskId, csrfToken, bodyHtml } },
      csrfToken,
    );
  const first = await create("<p>First message</p>");
  const reply = await create(
    `<blockquote data-comment-id="${first.createTaskComment.id}">First message</blockquote><p>Reply</p>`,
  );
  await page.goto("/unscheduled?project=all&page=1");
  const link = page.locator(`a[href^="/tasks/${taskId}/discussion?"]`);
  await expect(
    page.getByRole("button", { name: "Complete Discussion journal" }).first(),
  ).toBeVisible();
  // The shared fixture accumulates tasks across the full responsive suite.
  // Find this task through pagination instead of assuming it remains on page 1.
  for (let currentPage = 1; currentPage < 100 && (await link.count()) === 0; currentPage++) {
    const next = page.getByRole("button", { name: "Go to next page", exact: true });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
      page.getByRole("button", { name: `Go to page ${currentPage + 1}`, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await expect(link).toHaveAccessibleName("2 comments on Discussion journal");
  await expect(link).toBeVisible();
  await expect(link).toHaveText("2");
  const discussion = page.locator('[data-slot="task-discussion"]').filter({ has: link });
  await expect(discussion).toBeVisible();
  await expect(page.locator('[data-slot="task-metadata"]').filter({ has: link })).toHaveCount(0);
  const metadataRow = page.locator('[data-slot="task-metadata-row"]').filter({ has: link });
  await expect(metadataRow).toBeVisible();
  const title = page.locator(`a[href^="/tasks/${taskId}?"]`);
  const titleBox = await title.boundingBox();
  const discussionBox = await discussion.boundingBox();
  expect(titleBox && discussionBox && discussionBox.y >= titleBox.y + titleBox.height).toBe(true);
  const card = page.locator('[data-slot="card"]').filter({ has: link });
  const alignedWith =
    testInfo.project.use.viewport?.width === 320
      ? card.locator('[data-slot="task-schedule"]')
      : title;
  const alignmentBox = await alignedWith.boundingBox();
  expect(alignmentBox && discussionBox && Math.abs(alignmentBox.x - discussionBox.x) < 1).toBe(
    true,
  );
  const metadataBox = await metadataRow.locator('[data-slot="task-metadata"]').boundingBox();
  expect(metadataBox && discussionBox && Math.abs(metadataBox.y - discussionBox.y) < 1).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("task-comment-count.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}/discussion`));
  await expect(page.getByRole("article")).toHaveCount(2);
  await discussionGraphQL(
    page,
    "mutation($input: DeleteTaskCommentInput!) { deleteTaskComment(input: $input) { deletedCommentId } }",
    { input: { taskId, commentId: reply.createTaskComment.id, csrfToken } },
    csrfToken,
  );
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "TaskList") await gate;
    await route.continue();
  });
  await page.goBack();
  await expect(link.getByRole("status", { name: "Updating comment count" })).toBeVisible();
  const pendingBox = await discussion.boundingBox();
  release();
  await expect(link).toHaveAccessibleName("1 comment on Discussion journal");
  expect((await discussion.boundingBox())?.height).toBe(pendingBox?.height);
  await discussionGraphQL(
    page,
    "mutation($input: DeleteTaskCommentInput!) { deleteTaskComment(input: $input) { deletedCommentId } }",
    { input: { taskId, commentId: first.createTaskComment.id, csrfToken } },
    csrfToken,
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Discussion journal", exact: true }).first(),
  ).toBeVisible();
  await expect(link).toHaveCount(0);
});
