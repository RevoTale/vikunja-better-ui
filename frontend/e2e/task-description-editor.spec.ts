import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { createTask } from "./app-actions";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports rich descriptions, emoji and automatic links without rewriting untouched HTML", async ({
  page,
}) => {
  const { taskId: target } = await discussionFixture(page);
  const title = `Rich description ${Date.now()}`;
  const id = await createTask(page, "one-time task", title, async () => {
    const editor = page.getByRole("textbox", { name: "Description", exact: true });
    await editor.fill("Plan 👩‍💻 👍🏽 ");
    await editor.press("End");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await editor.pressSequentially("Important");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await editor.pressSequentially(` ${new URL(page.url()).origin}/tasks/${target} `);
  });
  const description = page.getByRole("region", { name: "Description", exact: true });
  await expect(description).toContainText("Plan 👩‍💻 👍🏽");
  await expect(
    description.locator("strong, b").filter({ hasText: "Important" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Related tasks", exact: true })).toContainText(
    "Discussion journal",
  );
  const original = await readDescription(page, id);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Description", exact: true });
  await expect(editor).toContainText("Important");
  await editor.focus();
  await expect(page.locator('input[name="description"]')).toHaveValue(original);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  expect(await readDescription(page, id)).toBe(original);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(" More context");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(description).toContainText("More context");
  await expect(description).toContainText("👩‍💻 👍🏽");
});

test("discussion supports preserving native description formatting while editing other fields", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  const html = '<p style="color: red">Native alignment 👩‍💻</p>';
  const response = await page.request.patch(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
      data: { description: html },
    },
  );
  expect(response.ok()).toBe(true);
  const original = await readDescription(page, taskId);
  await page.goto(`/tasks/${taskId}/edit`);
  await expect(
    page.getByText("This description contains formatting this editor cannot preserve.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("Preserved description");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preserved description", exact: true }),
  ).toBeVisible();
  expect(await readDescription(page, taskId)).toBe(original);
  await page.goto(`/tasks/${taskId}/edit`);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

async function readDescription(page: Page, id: string) {
  const result = await discussionGraphQL<{ task: { description: string } }>(
    page,
    "query($id:ID!) { task(id:$id) { description } }",
    { id },
  );
  return result.task.description;
}
