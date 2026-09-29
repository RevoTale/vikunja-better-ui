import { expect, test } from "@playwright/test";
import { commentMenu } from "./comment-menu-fixture";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports comment menus, Markdown copying and direct links", async ({
  page,
}, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const result = await discussionGraphQL<{ createTaskComment: { id: string } }>(
    page,
    "mutation($input: CreateTaskCommentInput!) {createTaskComment(input:$input){id}}",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml:
          "<p><strong>Menu example</strong> with <em>formatting</em>.</p><pre><code>  const x = 1;\n    x++;</code></pre>",
      },
    },
    csrfToken,
  );
  await page.reload();
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.body.dataset["copied"] = text;
        },
      },
    }),
  );
  const menu = await commentMenu(page, article);
  await expect(menu.getByRole("menuitem")).toHaveCount(4);
  await menu.screenshot({ path: testInfo.outputPath("comment-menu.png") });
  await expect(
    menu.getByRole("menuitem", { name: "Edit", exact: true }).locator("svg"),
  ).toBeVisible();
  await menu.getByRole("menuitem", { name: "Copy content as Markdown" }).click();
  const markdown = await page.evaluate(() => document.body.dataset["copied"]);
  expect(markdown).toContain("**Menu example**");
  expect(markdown).toContain("  const x = 1;\n    x++;");
  await expect(
    article.getByRole("status").filter({ hasText: "Comment copied as Markdown." }),
  ).toHaveCount(1);
  await (await commentMenu(page, article))
    .getByRole("menuitem", { name: "Copy link to comment" })
    .click();
  const link = await page.evaluate(() => document.body.dataset["copied"] ?? "");
  expect(link).toContain(`/tasks/${taskId}/discussion?comment=${result.createTaskComment.id}`);
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(article).toBeFocused();
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "DiscussionComments") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    body.data.taskComments.items = [];
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("Menu example");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("discussion copies rich content without dropping tables and reports clipboard errors", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) {createTaskComment(input:$input){id}}",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml:
          "<p><u>Underlined</u></p><table><tbody><tr><th>Header</th><td>Value</td></tr></tbody></table>",
      },
    },
    csrfToken,
  );
  await page.reload();
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.body.dataset["copied"] = text;
        },
      },
    }),
  );
  await (await commentMenu(page, article))
    .getByRole("menuitem", { name: "Copy content as Markdown" })
    .click();
  const value = await page.evaluate(() => document.body.dataset["copied"]);
  expect(value).toContain("<table>");
  expect(value).toContain("<u>Underlined</u>");
  expect(value).toContain("Value");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    }),
  );
  await (await commentMenu(page, article))
    .getByRole("menuitem", { name: "Copy link to comment" })
    .click();
  await expect(article.getByRole("status")).toContainText("Copy unavailable");
  await expect(
    article.getByRole("button", { name: "Comment actions" }).locator("svg"),
  ).not.toHaveClass(/text-emerald/);
});
