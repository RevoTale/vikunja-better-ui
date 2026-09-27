import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion sanitizes upstream and pasted HTML without losing supported formatting", async ({
  page,
}) => {
  await discussionFixture(page);
  const hostile =
    '<p onclick="alert(1)">Safe <strong>bold</strong> <em>italic</em> <code>code</code></p><ul><li>Bullet</li></ul><blockquote data-comment-id="evil">Quote</blockquote><img src="https://example.com/tracker" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a><a href="https://example.com">safe link</a>';
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "DiscussionComments")
      return route.continue();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          taskComments: {
            __typename: "TaskCommentPage",
            items: [
              {
                __typename: "TaskComment",
                id: "987654",
                bodyHtml: hostile,
                author: {
                  __typename: "DiscussionAuthor",
                  id: "999999",
                  name: "Other author",
                  username: "other",
                },
                createdAt: "2026-09-01T09:00:00Z",
                updatedAt: "2026-09-01T09:00:00Z",
              },
            ],
            page: 1,
            pageSize: 50,
            totalPages: 1,
            hasMore: false,
          },
        },
      }),
    });
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const comment = page.getByRole("article");
  await expect(comment.locator("strong")).toHaveText("bold");
  await expect(comment.locator("script, img, [onclick], [onerror], [data-comment-id]")).toHaveCount(
    0,
  );
  await expect(comment.locator("a").filter({ hasText: "unsafe" })).not.toHaveAttribute("href");
  await expect(comment.getByRole("link", { name: "safe link", exact: true })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(comment.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.focus();
  await editor.evaluate((element, html) => {
    const transfer = new DataTransfer();
    transfer.setData("text/html", html);
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
    );
  }, hostile);
  await expect(editor).toContainText("Safe bold italic code");
  await expect(
    editor.locator("script, img, [onclick], [onerror], a[href^='javascript:']"),
  ).toHaveCount(0);
  const save = page.waitForRequest(
    (request) =>
      request.url().endsWith("/graphql") &&
      request.postDataJSON().operationName === "CreateDiscussionComment",
  );
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const sent = (await save).postDataJSON().variables.input.bodyHtml as string;
  expect(sent).toContain("<strong>");
  expect(sent).toContain("<em>");
  expect(sent).toContain("<li>");
  expect(sent).not.toMatch(/onclick|onerror|javascript:|<script|<img/);
});
