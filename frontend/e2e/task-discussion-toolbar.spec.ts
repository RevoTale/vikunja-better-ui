import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports rounded bottom corners while the editor is focused", async ({
  page,
}, testInfo) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("Focused comment");
  await expect(editor).toBeFocused();
  const container = editor.locator("..");
  const radius = await container.evaluate(
    (element) => getComputedStyle(element).borderBottomLeftRadius,
  );
  expect(parseFloat(radius)).toBeGreaterThan(0);
  await expect(editor).toHaveCSS("border-bottom-left-radius", radius);
  await expect(editor).toHaveCSS("border-bottom-right-radius", radius);
  await expect(editor).toHaveCSS("border-top-left-radius", "0px");
  await expect(editor).not.toHaveCSS("box-shadow", "none");
  await editor.screenshot({ path: testInfo.outputPath("editor-focus.png") });
});

test("discussion supports persistent typing formats with visible toggles", async ({ page }) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await form.getByText("More formatting", { exact: true }).click();
  for (const [label, selector] of [
    ["Bold", "strong,b"],
    ["Italic", "em,i"],
    ["Inline code", "code"],
    ["Underline", ".underline"],
    ["Strikethrough", ".line-through"],
    ["Highlight", ".bg-accent"],
    ["Subscript", "sub"],
    ["Superscript", "sup"],
  ]) {
    if (!label || !selector) throw new Error("Missing format case");
    await editor.press("ControlOrMeta+a");
    await editor.press("Backspace");
    await expect(editor).toHaveText("");
    const button = form.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(editor).toBeFocused();
    await page.keyboard.type("Formatted");
    await expect(editor.locator(selector)).toHaveText("Formatted");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.type(" plain");
    await expect(editor.locator(selector)).toHaveText("Formatted");
    await expect(editor).toHaveText("Formatted plain");
  }
});

test("discussion supports starting a format before focusing the empty editor", async ({ page }) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  const code = form.getByRole("button", { name: "Inline code", exact: true });
  await code.focus();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(code).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("const value = 1");
  await expect(editor.locator("p code")).toHaveText("const value = 1");
});

test("discussion supports disabled history actions and icons", async ({ page }) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  const undo = form.getByRole("button", { name: "Undo", exact: true });
  const redo = form.getByRole("button", { name: "Redo", exact: true });
  await expect(redo).toBeDisabled();
  await expect(undo.locator("svg")).toHaveCount(1);
  await expect(redo.locator("svg")).toHaveCount(1);
  await editor.pressSequentially("Keep this");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(editor).toHaveText("Keep this");
  await expect(redo).toBeDisabled();
});

test("discussion supports formatting selected text and editing links without losing selection", async ({
  page,
}) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Selected text");
  await editor.press("ControlOrMeta+a");
  const bold = form.getByRole("button", { name: "Bold", exact: true });
  await bold.focus();
  await page.keyboard.press("Space");
  await expect(editor.locator("strong,b")).toHaveText("Selected text");
  await form.getByRole("button", { name: "Link", exact: true }).click();
  await expect(form.getByRole("textbox", { name: "Link URL" })).toBeFocused();
  await form.getByRole("textbox", { name: "Link URL" }).fill("https://example.com/notes");
  await form.getByRole("button", { name: "Apply link" }).click();
  await expect(editor.locator("a")).toHaveText("Selected text");
  await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com/notes");
  await expect(editor).toBeFocused();
  await editor.press("ArrowRight");
  await form.getByRole("button", { name: "Link", exact: true }).click();
  await expect(form.getByRole("textbox", { name: "Link URL" })).toHaveValue(
    "https://example.com/notes",
  );
  await form.getByRole("button", { name: "Remove link" }).click();
  await expect(editor.locator("a")).toHaveCount(0);
  await expect(editor).toHaveText("Selected text");
  await editor.press("ControlOrMeta+a");
  await form.getByRole("button", { name: "Link", exact: true }).click();
  await form.getByRole("button", { name: "Cancel link" }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.type("Replacement");
  await expect(editor).toHaveText("Replacement");
});

test("discussion supports block toggles and touch typing", async ({ page }, testInfo) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await form.getByText("More formatting", { exact: true }).click();
  for (const [label, selector] of [
    ["Heading", "h3"],
    ["Quote", "blockquote"],
    ["Bullets", "ul"],
    ["Numbered list", "ol"],
    ["Checklist", "ul.discussion-checklist"],
    ["Code block", "code[data-language]"],
  ] as const) {
    const button = form.getByRole("button", { name: label, exact: true });
    if (testInfo.project.use.hasTouch) await button.tap();
    else await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(editor).toBeFocused();
    await page.keyboard.type("Block");
    await expect(editor.locator(selector)).toHaveText("Block");
    if (label === "Code block") {
      for (const control of [
        "Bold",
        "Italic",
        "Inline code",
        "Underline",
        "Link",
        "Table",
        "Separator",
      ])
        await expect(form.getByRole("button", { name: control, exact: true })).toBeDisabled();
    }
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(editor.locator("p")).toHaveText("Block");
    await editor.press("ControlOrMeta+a");
    await editor.press("Backspace");
    await expect(editor).toHaveText("");
  }
  await page.screenshot({ path: testInfo.outputPath("toolbar.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("discussion supports cancelling link editing without moving a middle selection", async ({
  page,
}) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("Before");
  await editor.press("Enter");
  await editor.pressSequentially("Selected");
  await editor.press("Enter");
  await editor.pressSequentially("After");
  await editor
    .locator("p")
    .nth(1)
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    });
  await form.getByRole("button", { name: "Link", exact: true }).click();
  await form.getByRole("textbox", { name: "Link URL" }).fill("https://example.com");
  await form.getByRole("button", { name: "Cancel link" }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.type("Replaced");
  await expect(editor.locator("p")).toHaveText(["Before", "Replaced", "After"]);
});

test("discussion supports formatting inside table cells without nesting tables", async ({
  page,
}) => {
  await discussionFixture(page);
  const form = page.getByRole("region", { name: "New comment form" });
  const editor = form.getByRole("textbox", { name: "Comment", exact: true });
  await form.getByText("More formatting", { exact: true }).click();
  await form.getByRole("button", { name: "Table", exact: true }).click();
  await editor.locator("th,td").first().click();
  await expect(form.getByRole("button", { name: "Table", exact: true })).toBeDisabled();
  const heading = form.getByRole("button", { name: "Heading", exact: true });
  await heading.click();
  await expect(heading).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Cell heading");
  await expect(editor.locator("th h3")).toHaveText("Cell heading");
  await heading.click();
  await expect(heading).toHaveAttribute("aria-pressed", "false");
  await expect(editor.locator("th p").first()).toHaveText("Cell heading");
});

test("discussion supports explicit errors when a saved draft cannot be discarded", async ({
  page,
}) => {
  await discussionFixture(page);
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep until discarded");
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.removeItem = () => {
      throw new Error("Storage disabled");
    };
  });
  await page.getByRole("button", { name: "Discard saved draft", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard saved draft", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("saved draft could not be removed");
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveText(
    "Keep until discarded",
  );
});

test("discussion supports safe draft dismissal and confirmed discard", async ({ page }) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Saved draft");
  await page.reload();
  await page.getByRole("button", { name: "Discard saved draft", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Posted comments and uploaded task attachments are not deleted",
  );
  await dialog.getByRole("button", { name: "Keep draft" }).click();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toBeVisible();
  await editor.fill("Newer typing");
  await page.getByRole("button", { name: "Dismiss draft notice", exact: true }).click();
  await expect(editor).toHaveText("Newer typing");
  await page.reload();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(editor).toHaveText("Newer typing");
  await page.reload();
  await page.getByRole("button", { name: "Discard saved draft", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard saved draft", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toHaveCount(0);
  await expect(editor).toHaveText("");
});
