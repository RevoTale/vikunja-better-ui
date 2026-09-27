import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports comments, replies, edits, drafts and deletion", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await expect(editor).toBeVisible();
  await editor.fill("First journal entry");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const first = page.getByRole("article").filter({ hasText: "First journal entry" }).first();
  await expect(first).toBeVisible();
  await first.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(editor).toBeFocused();
  await editor.fill("A useful follow-up");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const reply = page.getByRole("article").filter({ hasText: "A useful follow-up" });
  await expect(reply.locator("blockquote[data-comment-id]")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("discussion.png"), fullPage: true });
  await reply.getByRole("button", { name: "View original", exact: true }).click();
  await expect(first).toBeFocused();
  await reply.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Edit comment", exact: true }).fill("Edited follow-up");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(page.getByRole("article").filter({ hasText: "Edited follow-up" })).toBeVisible();
  await editor.fill("Unsaved draft");
  await page.reload();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(editor).toHaveText("Unsaved draft");
  await editor.fill("Newer text");
  await page.reload();
  await editor.fill("Do not replace this");
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toBeDisabled();
  const edited = page.getByRole("article").filter({ hasText: "Edited follow-up" });
  await edited.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await expect(edited).toHaveCount(0);
  await expect(editor).toHaveText("Do not replace this");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("discussion edits plain native comments with unavailable draft storage", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml: "Plain native comment" } },
    csrfToken,
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    });
  });
  await page.reload();
  const comment = page.getByRole("article").filter({ hasText: "Plain native comment" });
  await comment.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit comment", exact: true });
  await expect(editor).toHaveText("Plain native comment");
  await expect(editor).toBeFocused();
  await editor.fill("Changed without local storage");
  await expect(page.getByText("Local draft could not be saved.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Changed without local storage" }),
  ).toBeVisible();
});

test("discussion preserves failed saves and requires an explicit retry decision", async ({
  page,
}) => {
  await discussionFixture(page);
  let writes = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "CreateDiscussionComment")
      return route.continue();
    writes++;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: null,
        errors: [
          { message: "Vikunja is unavailable.", extensions: { code: "UPSTREAM_UNAVAILABLE" } },
        ],
      }),
    });
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Keep my work");
  const post = page.getByRole("button", { name: "Post comment", exact: true });
  await post.click();
  await expect(page.getByRole("alert")).toHaveText("Vikunja is unavailable.");
  await expect(editor).toHaveText("Keep my work");
  await expect(post).toBeDisabled();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(editor).toHaveText("Keep my work");
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "I checked; allow retry", exact: true }).click();
  await page.unroute("**/graphql");
  await post.click();
  await expect(page.getByRole("article").filter({ hasText: "Keep my work" })).toHaveCount(1);
});

test("discussion prevents lossy editing of native tables and images", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const bodyHtml =
    '<p>Keep native content</p><table><tbody><tr><td>Table value</td></tr></tbody></table><img src="https://example.com/image.png">';
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml } },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const comment = page.getByRole("article").filter({ hasText: "Keep native content" });
  await expect(comment.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();
  await expect(comment).toContainText("Open native Vikunja");
  const data = await discussionGraphQL<{ taskComments: { items: { bodyHtml: string }[] } }>(
    page,
    "query($taskId: ID!) { taskComments(taskId: $taskId) { items { bodyHtml } } }",
    { taskId },
  );
  expect(data.taskComments.items[0]?.bodyHtml).toContain("<table>");
});
