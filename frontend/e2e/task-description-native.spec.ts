import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports editing native relative description links without stripping them", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  const href = `/tasks/${taskId}`;
  const response = await page.request.patch(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
      data: { description: `<p><a href="${href}">Original relative link</a></p>` },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto(`/tasks/${taskId}/edit`);
  const editor = page.getByRole("textbox", { name: "Description", exact: true });
  await expect(editor.getByRole("link")).toHaveAttribute("href", href);
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  await editor.pressSequentially("More context 👍🏽");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discussion journal", exact: true }),
  ).toBeVisible();
  const saved = await discussionGraphQL<{ task: { description: string } }>(
    page,
    "query($id:ID!) { task(id:$id) { description } }",
    { id: taskId },
  );
  expect(saved.task.description).toContain(`href="${href}"`);
  expect(saved.task.description).toContain("More context 👍🏽");
});
