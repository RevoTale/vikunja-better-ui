import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

for (const trigger of ["Enter", "Space"]) {
  test(`discussion supports bare code fences with ${trigger}`, async ({ page }) => {
    await discussionFixture(page);
    const editor = page.getByRole("textbox", { name: "Comment", exact: true });
    await editor.press("ControlOrMeta+End");
    await page.keyboard.insertText("```");
    await editor.press(trigger);
    await expect(editor.locator("code[data-language]")).toHaveCount(1);
    await editor.pressSequentially("literal <strong>code</strong>");
    await expect(editor.locator("code[data-language]")).toHaveText("literal <strong>code</strong>");
    await page.getByRole("button", { name: "Continue writing", exact: true }).click();
    await editor.pressSequentially("Normal text");
    await expect(editor.locator("p").last()).toHaveText("Normal text");
  });

  test(`discussion supports code fences after soft line breaks with ${trigger}`, async ({
    page,
  }) => {
    await discussionFixture(page);
    const editor = page.getByRole("textbox", { name: "Comment", exact: true });
    await editor.pressSequentially("Keep this paragraph");
    await editor.press("Shift+Enter");
    await page.keyboard.insertText("```js");
    await editor.press(trigger);
    await expect(editor.locator("code[data-language]")).toHaveCount(1);
    await editor.pressSequentially("const preserved = true;");
    await expect(editor.locator("p").first()).toHaveText("Keep this paragraph");
    await page.getByRole("button", { name: "Post comment", exact: true }).click();
    await expect(page.getByRole("article").locator("pre code")).toHaveText(
      "const preserved = true;",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Edit comment", exact: true })).toContainText(
      "Keep this paragraph",
    );
  });
}

test("discussion preserves code, tables, checklists and text formats through editing", async ({
  page,
  context,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const code = 'const x = "<b>literal</b>";\n\tconsole.log(x);\n\n';
  const bodyHtml =
    '<p><u>underline</u> <s>strike</s> <mark>highlight</mark> <sub>sub</sub> <sup>sup</sup></p><hr><pre><code class="language-javascript">const x = &quot;&lt;b&gt;literal&lt;/b&gt;&quot;;\n\tconsole.log(x);\n\n</code></pre><table><tbody><tr><th>Header</th><th>Second</th></tr><tr><td>Cell one</td><td>Cell two</td></tr></tbody></table><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Checked item</p></div></li></ul>';
  const nativeTableHtml = bodyHtml.replace(
    "<table>",
    '<table style="min-width:50px"><colgroup><col style="min-width:25px"><col style="min-width:25px"></colgroup>',
  );
  await discussionGraphQL(
    page,
    "mutation($input:CreateTaskCommentInput!){createTaskComment(input:$input){id}}",
    { input: { taskId, csrfToken, bodyHtml: nativeTableHtml } },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const article = page.getByRole("article");
  await expect.poll(() => article.locator("pre").textContent()).toBe(code);
  await expect(article.locator("th").first()).toHaveText("Header");
  await expect(article.locator('li[data-checked="true"]')).toContainText("Checked item");
  await article.getByRole("button", { name: "Edit", exact: true }).click();
  const form = page.getByRole("region", { name: "Edit comment form" });
  const editor = form.getByRole("textbox", { name: "Edit comment", exact: true });
  await expect(editor).toContainText("Cell one");
  const save = page.waitForRequest(
    (request) =>
      request.url().endsWith("/graphql") &&
      request.postDataJSON().operationName === "UpdateDiscussionComment",
  );
  await form.getByRole("button", { name: "Save comment", exact: true }).click();
  const sent = (await save).postDataJSON().variables.input.bodyHtml as string;
  expect(sent).toContain("<pre");
  expect(sent).toContain("language-javascript");
  expect(sent).toContain("<table");
  expect(sent).toContain('data-checked="true"');
  for (const tag of ["u", "s", "mark", "sub", "sup", "hr"]) expect(sent).toContain(`<${tag}`);
  await expect.poll(() => article.locator("pre").textContent()).toBe(code);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await article.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(article.getByText("Code copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
});

test("discussion supports code and table controls on mobile and desktop", async ({ page }) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("code draft");
  const toolbar = form.getByRole("group", { name: "Text formatting" });
  await expect
    .poll(async () => (await toolbar.boundingBox())?.height ?? Infinity)
    .toBeLessThanOrEqual(96);
  await form.getByText("More formatting", { exact: true }).click();
  await form.getByRole("button", { name: "Code block", exact: true }).click();
  await form.getByRole("combobox", { name: "Code language" }).click();
  await page.getByRole("option", { name: "JavaScript", exact: true }).click();
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+a");
  const literal = 'const value = "<strong>literal</strong>";\n\t// comment';
  await editor.evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    clipboardData.setData("text/html", "<strong>must not paste HTML</strong>");
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
  }, literal);
  await expect(editor).toContainText(literal);
  await expect(editor.locator(".syntax-keyword").first()).toBeVisible();
  await form.getByRole("button", { name: "Continue writing" }).click();
  await form.getByRole("button", { name: "Table", exact: true }).click();
  await editor.locator("th,td").first().click();
  await page.keyboard.insertText("Table header");
  await form.getByRole("button", { name: "Row below", exact: true }).click();
  await expect(editor.locator("tr")).toHaveCount(3);
  await form.getByRole("button", { name: "Column after", exact: true }).click();
  await expect(editor.locator("tr").first().locator("th,td")).toHaveCount(3);
  await form.getByRole("button", { name: "Remove column", exact: true }).click();
  await expect(editor.locator("tr").first().locator("th,td")).toHaveCount(2);
  await form.getByRole("button", { name: "Post comment", exact: true }).click();
  const article = page.getByRole("article");
  await expect.poll(() => article.locator("pre").textContent()).toBe(literal);
  await expect(article.getByRole("button", { name: "Copy code" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("discussion refuses lossy editing of native styles and disclosure blocks", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  for (const bodyHtml of [
    '<p style="text-align:center">Native centered text</p>',
    '<p><span style="color:red">Native colored text</span></p>',
    "<details><summary>Native disclosure</summary><p>Hidden content</p></details>",
    '<p>Hello <mention-user data-type="mention" data-id="2" data-label="Alice"></mention-user></p>',
    '<p><a href="obsidian://open?vault=notes">Native deep link</a></p>',
    '<p><img src="/api/v1/tasks/1/attachments/1" title="Native image title" alt="Image"></p>',
  ])
    await discussionGraphQL(
      page,
      "mutation($input:CreateTaskCommentInput!){createTaskComment(input:$input){id}}",
      { input: { taskId, csrfToken, bodyHtml } },
      csrfToken,
    );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const articles = page.getByRole("article");
  await expect(articles).toHaveCount(6);
  for (const article of await articles.all()) {
    await expect(article.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();
    await expect(article).toContainText("content not supported here");
  }
});

test("discussion Markdown shortcuts and code copying preserve literal text", async ({
  page,
  context,
}) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("### A heading");
  await expect(editor.locator("h3")).toHaveText("A heading");
  await editor.press("Enter");
  await editor.pressSequentially("[ ] A checklist item");
  await expect(editor.getByRole("checkbox")).toContainText("A checklist item");
  await editor.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await expect(editor.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  await editor.press("Enter");
  await page.keyboard.insertText("```js");
  await editor.press("Space");
  await editor.pressSequentially("const x = 1;");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const article = page.getByRole("article");
  await expect(article.locator("h3")).toHaveText("A heading");
  await expect(article.locator('li[data-checked="true"]')).toContainText("A checklist item");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await article.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(article.getByText("Code copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("const x = 1;");
});
