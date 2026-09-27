import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

for (const softLine of [false, true]) {
  test(`discussion supports immediate code fences${softLine ? " after a soft line" : ""}`, async ({
    page,
  }) => {
    await discussionFixture(page);
    const editor = page.getByRole("textbox", { name: "Comment", exact: true });
    if (softLine) {
      await editor.pressSequentially("Keep this paragraph");
      await editor.press("Shift+Enter");
    }
    await editor.pressSequentially("``");
    await expect(editor.locator("code[data-language]")).toHaveCount(0);
    await editor.pressSequentially("`");
    const code = editor.locator("code[data-language]");
    await expect(code).toHaveCount(1);
    await expect(code).toHaveText("");
    await expect(code).toHaveCSS("display", "block");
    if (softLine) await expect(editor.locator("p").first()).toHaveText("Keep this paragraph");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(editor.locator("code[data-language]")).toHaveCount(0);
    await expect(editor).toContainText("```");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(code).toHaveCount(1);
    await editor.pressSequentially("first line");
    await editor.press("Enter");
    await editor.pressSequentially("  second line");
    await expect(code).toHaveText("first line\n  second line");
    await page.getByRole("button", { name: "Post comment", exact: true }).click();
    await expect(page.getByRole("article").locator("pre code")).toHaveText(
      "first line\n  second line",
    );
  });
}

test("discussion supports proportional code typography without page overflow", async ({ page }) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("Normal paragraph");
  await editor.press("Enter");
  await editor.pressSequentially("```");
  const code = editor.locator("code[data-language]");
  await expect(code).toHaveCount(1);
  await editor.pressSequentially("long_code_".repeat(20));
  await expect(code).toHaveCSS("display", "block");
  await expect(code).toHaveCSS("overflow-x", "auto");
  const dimensions = await code.evaluate((element) => {
    const style = getComputedStyle(element);
    const root = getComputedStyle(document.documentElement);
    return {
      font: parseFloat(style.fontSize),
      root: parseFloat(root.fontSize),
      line: parseFloat(style.lineHeight),
      height: element.getBoundingClientRect().height,
    };
  });
  expect(dimensions.font / dimensions.root).toBeCloseTo(0.875);
  expect(dimensions.line / dimensions.font).toBeCloseTo(1.5);
  expect(dimensions.height).toBeGreaterThan(dimensions.line);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("discussion supports literal pasted fences and inline code", async ({ page }) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("``");
  await editor.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "`");
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
  });
  await expect(editor.locator("code[data-language]")).toHaveCount(0);
  await expect(editor).toHaveText("```");
  await editor.press("Enter");
  // Enter remains an explicit request to convert a literal fence.
  await expect(editor.locator("code[data-language]")).toHaveCount(1);
  await page.getByRole("button", { name: "Continue writing", exact: true }).click();
  await editor.pressSequentially("Use `inline` code");
  await expect(editor.locator("p code")).toHaveText("inline");
  await expect(editor.locator("code[data-language]")).toHaveCount(1);
});

test("discussion supports matching editor and saved text dimensions", async ({
  page,
}, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const bodyHtml =
    "<h1>Large heading</h1><h2>Medium heading</h2><h3>Small heading</h3><p>Paragraph with <code>inline code</code> and <sub>sub</sub> <sup>sup</sup>.</p><ul><li>List item</li></ul><pre><code>first line\n  second line</code></pre>";
  await discussionGraphQL(
    page,
    "mutation($input:CreateTaskCommentInput!){createTaskComment(input:$input){id}}",
    { input: { taskId, csrfToken, bodyHtml } },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const article = page.getByRole("article");
  await expect(article.getByText("Large heading", { exact: true })).toHaveCSS("font-size", "24px");
  await expect(article.getByText("Medium heading", { exact: true })).toHaveCSS("font-size", "20px");
  await expect(article.getByText("Small heading", { exact: true })).toHaveCSS("font-size", "18px");
  await expect(article.locator("p code")).toHaveCSS("font-size", "14px");
  await expect(article.locator("pre code")).toHaveCSS("font-size", "14px");
  await article.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit comment", exact: true });
  await expect(editor.locator("h1")).toHaveCSS("font-size", "24px");
  await expect(editor.locator("h2")).toHaveCSS("font-size", "20px");
  await expect(editor.locator("h3")).toHaveCSS("font-size", "18px");
  await expect(editor.locator("p code")).toHaveCSS("font-size", "14px");
  await expect(editor.locator("code[data-language]")).toHaveCSS("font-size", "14px");
  await expect(editor.locator("sub")).toHaveCSS("font-size", "12px");
  await expect(editor.locator("sup")).toHaveCSS("font-size", "12px");
  await editor.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("editor-typography.png"), fullPage: true });
});
