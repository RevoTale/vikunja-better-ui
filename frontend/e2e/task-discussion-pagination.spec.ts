import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports pagination, lazy reply chains, and recovery of an emptied last page", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  let source = "";
  let parent = "";
  for (let index = 0; index < 51; index++) {
    const bodyHtml =
      index === 50
        ? `<blockquote data-comment-id="${parent}">Journal 1</blockquote><p>Last reply</p>`
        : `${index === 1 ? `<blockquote data-comment-id="${source}">Journal 0</blockquote>` : ""}<p>Journal ${index}</p>`;
    const result = await discussionGraphQL<{ createTaskComment: { id: string } }>(
      page,
      "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
      { input: { taskId, csrfToken, bodyHtml } },
      csrfToken,
    );
    if (index === 0) source = result.createTaskComment.id;
    if (index === 1) parent = result.createTaskComment.id;
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(50);
  await page.getByRole("button", { name: "Next comments", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "View original", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Journal 1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "View original", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Journal 0");
  await expect(page.getByRole("dialog")).toContainText("Reply chain · 2 steps");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Back to reply", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Journal 1");
  await discussionGraphQL(
    page,
    "mutation($input: DeleteTaskCommentInput!) { deleteTaskComment(input: $input) { deletedCommentId } }",
    { input: { taskId, csrfToken, commentId: source } },
    csrfToken,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "View original", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Back to reply", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("blockquote")).toContainText("Journal 0");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("article")).toBeFocused();
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName === "DiscussionOriginal") await pending;
    await route.continue();
  });
  await page.getByRole("button", { name: "View original", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("status").filter({ hasText: "Loading original" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Back to reply", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByRole("article")).toBeFocused();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Keep draft across pagination");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(49);
  const descending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/graphql") &&
      response.request().postDataJSON().operationName === "DiscussionComments" &&
      response.request().postDataJSON().variables.order === "DESC",
  );
  await page.getByRole("button", { name: "Oldest first", exact: true }).click();
  await descending;
  const timestamps = await page
    .getByRole("article")
    .locator("time")
    .evaluateAll((elements) =>
      elements.map((element) => Date.parse(element.getAttribute("datetime") ?? "")),
    );
  expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveText(
    "Keep draft across pagination",
  );
});
