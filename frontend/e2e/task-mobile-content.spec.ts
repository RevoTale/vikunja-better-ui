import { expect, type Locator, type Page, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports visible bullet markers while editing nested formatted lists", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  await setDescription(
    page,
    taskId,
    "<ul><li><p><strong>First bullet</strong></p></li><li><p>Second bullet</p><ul><li>Nested bullet</li></ul></li></ul>",
  );
  await page.goto(`/tasks/${taskId}/edit`);
  const editor = page.getByRole("textbox", { name: "Description", exact: true });
  await expect(editor.locator("ul")).toHaveCount(2);
  const wrapper = editor.locator("li").filter({ has: page.locator("ul") });
  await expect(wrapper).toHaveCount(1);
  await expect(wrapper).toHaveCSS("list-style-type", "none");
  for (const item of await editor
    .locator("li")
    .filter({ hasNot: page.locator("ul") })
    .all()) {
    await expect(item).toHaveCSS("display", "list-item");
    await expect(item).not.toHaveCSS("list-style-type", "none");
  }
  // Click the final glyph; mobile keyboard navigation can lag selection updates.
  const lastBullet = editor.getByText("Nested bullet", { exact: true });
  const bounds = await lastBullet.boundingBox();
  if (!bounds) throw new Error("Nested bullet has no visible bounds");
  await lastBullet.click({ position: { x: bounds.width - 1, y: bounds.height / 2 } });
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection();
        return Boolean(
          selection?.isCollapsed &&
            element.contains(selection.anchorNode) &&
            selection.anchorNode?.textContent === "Nested bullet" &&
            selection.anchorOffset === "Nested bullet".length,
        );
      }),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expect(editor.locator("li").filter({ hasText: /^$/ })).toHaveCount(1);
  await page.keyboard.insertText("Another bullet");
  await expect(editor.locator("li").filter({ hasText: /^Another bullet$/ })).not.toHaveCSS(
    "list-style-type",
    "none",
  );
  await editor.screenshot({ path: test.info().outputPath("nested-bullets-editor.png") });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Description", exact: true })).toContainText(
    "Another bullet",
  );
  const saved = page.getByRole("region", { name: "Description", exact: true });
  await expect(saved.locator("ul ul")).toHaveCount(1);
  await expect(saved.locator("li").filter({ hasText: /^Another bullet$/ })).not.toHaveCSS(
    "list-style-type",
    "none",
  );
});

test("discussion supports long rich task content without horizontal page overflow", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  const token = "unbroken-content-".repeat(20);
  await setDescription(
    page,
    taskId,
    `<p>${token}</p><blockquote><p>${token}</p></blockquote><pre><code>${token}</code></pre><table><tbody><tr><th>Column one</th><th>Column two</th><th>Column three</th></tr><tr><td>${token}</td><td>${token}</td><td>${token}</td></tr></tbody></table>`,
    token,
  );
  await page.goto(`/tasks/${taskId}`);
  const description = page.getByRole("region", { name: "Description", exact: true });
  await expect(description).toContainText(token);
  await expectNoPageOverflow(page);
  // A direct edit load must not depend on styles loaded by the task detail route.
  await page.goto(`/tasks/${taskId}/edit`);
  const editor = page.getByRole("textbox", { name: "Description", exact: true });
  await expect(editor).toContainText(token);
  await expectNoPageOverflow(page);
  await editor.locator("td").first().click();
  await page.keyboard.insertText("Cell editing ");
  await expectNoPageOverflow(page);
  await expectWithinViewport(page.getByRole("button", { name: "Save changes", exact: true }));
});

async function setDescription(page: Page, id: string, description: string, title?: string) {
  const response = await page.request.patch(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${id}`,
    {
      headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
      data: { description, ...(title ? { title } : {}) },
    },
  );
  expect(response.ok()).toBe(true);
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function expectWithinViewport(element: Locator) {
  const bounds = await element.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
}
