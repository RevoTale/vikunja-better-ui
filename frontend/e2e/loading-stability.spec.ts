import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports stable initial loading and retained comments during sorting", async ({
  page,
}, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml: "<p>Stable discussion content</p>" } },
    csrfToken,
  );
  let release = () => {};
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "DiscussionComments") await gate;
    await route.continue();
  });
  await page.reload();
  await expect(page.getByLabel("Loading comments", { exact: true })).toBeVisible();
  await expect(page.getByText("No comments yet.", { exact: false })).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Draft survives delayed reads");
  release();
  await expect(page.getByRole("article")).toHaveCount(1);
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const before = await page.getByRole("article").boundingBox();
  await page.getByRole("combobox", { name: "Sort comments" }).click();
  await page.getByRole("option", { name: "Newest first", exact: true }).click();
  await expect(page.getByRole("region", { name: "Comments", exact: true })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Updating comments…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Refresh/ })).toHaveCSS("opacity", "1");
  await expect(page.getByRole("combobox", { name: "Sort comments" })).toHaveCSS("opacity", "1");
  expect((await page.getByRole("article").boundingBox())?.height).toBe(before?.height);
  await expect(editor).toHaveText("Draft survives delayed reads");
  await page.screenshot({ path: testInfo.outputPath("discussion-updating.png"), fullPage: true });
  release();
  await expect(page.getByRole("region", { name: "Comments", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(editor).toHaveText("Draft survives delayed reads");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml: "<p>New upstream comment</p>" } },
    csrfToken,
  );
  await page.getByRole("button", { name: /^Refresh/ }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole("link", { name: "Back to task", exact: true }).click();
  await expect(page.getByRole("region", { name: "Comments", exact: true })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  // The detail page starts in ASC order; its last successful ASC read had one
  // comment. The DESC response above must not be reused as an ASC page.
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Updating comments…", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Loading comments", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole("region", { name: "Comments", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expectDiscussionReadRecovery(page);
});

test("discussion supports a timezone skeleton without shifting the brand", async ({ page }) => {
  await discussionFixture(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "Session") await gate;
    await route.continue();
  });
  await page.reload();
  const timezone = page.locator('[data-slot="timezone"]:visible');
  await expect(timezone.getByRole("status", { name: "Loading timezone" })).toBeVisible();
  const before = await timezone.boundingBox();
  release();
  await expect(timezone).toContainText("Timezone Europe/Kyiv");
  const after = await timezone.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(after?.height).toBe(before?.height);
  await expect(timezone.getByRole("status")).toHaveCount(0);
});

async function expectDiscussionReadRecovery(page: Page) {
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "DiscussionComments")
      return route.continue();
    await route.fulfill({ json: { data: null, errors: [{ message: "Fresh read failed" }] } });
  });
  await page.getByRole("button", { name: /^Refresh/ }).click();
  await expect(page.getByRole("alert")).toContainText("previous successful load");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(editor).toHaveText("Draft survives delayed reads");
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("combobox", { name: "Sort comments" }).click();
  await page.getByRole("option", { name: "Newest first", exact: true }).click();
  await expect(page.getByRole("region", { name: "Comments", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(editor).toHaveText("Draft survives delayed reads");
}
