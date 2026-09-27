import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports following a reply chain and returning without losing a draft", async ({
  page,
}, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const ids: string[] = [];
  for (const text of ["Original entry", "First reply", "Second reply"]) {
    const previous = ids.at(-1);
    const bodyHtml = `${previous ? `<blockquote data-comment-id="${previous}">Quoted snapshot</blockquote>` : ""}<p>${text}</p>`;
    const result = await discussionGraphQL<{ createTaskComment: { id: string } }>(
      page,
      "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
      { input: { taskId, csrfToken, bodyHtml } },
      csrfToken,
    );
    ids.push(result.createTaskComment.id);
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Keep my draft while following replies");
  const original = page.locator(`#comment-${ids[0]}`);
  const first = page.locator(`#comment-${ids[1]}`);
  const second = page.locator(`#comment-${ids[2]}`);
  const arrow = second
    .locator("blockquote")
    .getByRole("button", { name: "View original", exact: true });
  await arrow.focus();
  await arrow.press("Enter");
  await expect(first).toBeFocused();
  await first
    .locator("blockquote")
    .getByRole("button", { name: "View original", exact: true })
    .click();
  await expect(original).toBeFocused();
  await expect(original).toContainText("Reply chain · 2 steps");
  await page.screenshot({ path: testInfo.outputPath("reply-chain.png"), fullPage: true });
  await original.getByRole("button", { name: "Back to reply", exact: true }).click();
  await expect(first).toBeFocused();
  await first.getByRole("button", { name: "Back to reply", exact: true }).click();
  await expect(second).toBeFocused();
  await expect(page.getByRole("button", { name: "Back to reply", exact: true })).toHaveCount(0);
  await discussionGraphQL(
    page,
    "mutation($input: UpdateTaskCommentInput!) { updateTaskComment(input: $input) { id } }",
    {
      input: {
        taskId,
        csrfToken,
        commentId: ids[0],
        bodyHtml: `<blockquote data-comment-id="${ids[2]}">Cyclic reference</blockquote><p>Original entry</p>`,
      },
    },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(original.locator("blockquote")).toContainText("Cyclic reference");
  await arrow.click();
  await first.getByRole("button", { name: "View original", exact: true }).click();
  await original.getByRole("button", { name: "View original", exact: true }).click();
  await expect(second).toBeFocused();
  await expect(page.getByRole("button", { name: "Back to reply", exact: true })).toHaveCount(0);
  await expect(editor).toHaveText("Keep my draft while following replies");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
