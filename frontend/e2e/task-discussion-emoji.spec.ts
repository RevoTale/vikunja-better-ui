import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports emoji picker, shortcode selection and Unicode round trips", async ({
  page,
}) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await expect(page.getByRole("listbox", { name: "Typeahead menu" })).toHaveCount(0);
  await editor.fill("Keep ");
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Insert emoji" });
  await picker.getByLabel("Find emoji").fill("thumbs up medium skin tone");
  await picker.getByRole("button", { name: "thumbs up: medium skin tone", exact: true }).click();
  await expect(editor).toContainText("Keep 👍🏽");
  await editor.press("End");
  await editor.pressSequentially(" :woman_technologist");
  const suggestions = page.getByRole("listbox", { name: "Emoji suggestions" });
  await expect(suggestions).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toContainText("👩‍💻");
  await expect(editor).not.toContainText(":woman_technologist");
  await expect(page.getByRole("listbox", { name: "Typeahead menu" })).toHaveCount(0);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article").filter({ hasText: "Keep 👍🏽" })).toContainText("👩‍💻");
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "Keep 👍🏽" })).toContainText("👩‍💻");
});
