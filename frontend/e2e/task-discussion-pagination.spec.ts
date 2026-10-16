import { expect, type Page, test } from "@playwright/test";
import { commentMenu } from "./comment-menu-fixture";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";
import { seedDiscussionReplyChain } from "./discussion-seed";

test("discussion supports pagination, lazy reply chains, and recovery of an emptied last page", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const source = seedDiscussionReplyChain(taskId);
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
  await (await commentMenu(page, page))
    .getByRole("menuitem", { name: "Delete", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(49);
  await expectDescendingComments(page);
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveText(
    "Keep draft across pagination",
  );
});

async function expectDescendingComments(page: Page) {
  const descending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/graphql") &&
      response.request().postDataJSON().operationName === "DiscussionComments" &&
      response.request().postDataJSON().variables.order === "DESC",
  );
  await page.getByRole("combobox", { name: "Sort comments", exact: true }).click();
  await page.getByRole("option", { name: "Newest first", exact: true }).click();
  await descending;
  const timestamps = await page
    .getByRole("article")
    .locator("time")
    .evaluateAll((elements) =>
      elements.map((element) => Date.parse(element.getAttribute("datetime") ?? "")),
    );
  expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));
}
