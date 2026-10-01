import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports literal shortcodes in code and unknown text with undoable emoji", async ({
  page,
}) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Keep ");
  await editor.pressSequentially(":thumbsup");
  await expect(page.getByRole("listbox", { name: "Emoji suggestions" })).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toContainText("👍");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toContainText(":thumbsup");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor).toContainText("👍");
  await editor.fill("https://example.test/:thumbsup");
  await expect(page.getByRole("listbox", { name: "Emoji suggestions" })).toHaveCount(0);
  await editor.fill(":not_a_real_shortcode_123:");
  await expect(page.getByRole("listbox", { name: "Emoji suggestions" })).toHaveCount(0);
  await page.getByRole("button", { name: "Inline code", exact: true }).click();
  await editor.pressSequentially(" :thumbsup:");
  await expect(page.getByRole("listbox", { name: "Emoji suggestions" })).toHaveCount(0);
  await expect(editor.locator("code")).toContainText(":thumbsup:");
});
