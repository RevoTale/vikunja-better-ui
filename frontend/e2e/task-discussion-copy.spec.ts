import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports temporary copy confirmation and clipboard errors", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml: "<pre><code>const x = 1;</code></pre>" } },
    csrfToken,
  );
  await page.reload();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    }),
  );
  const copy = page.getByRole("button", { name: /^Copy code/ });
  await expect(copy).toBeVisible();
  const width = (await copy.boundingBox())?.width;
  await copy.click();
  await expect(copy).toHaveText("Copied");
  await expect(copy.locator("svg")).toHaveClass(/text-emerald/);
  expect((await copy.boundingBox())?.width).toBe(width);
  await expect(copy).toHaveText("Copy code");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Permission denied");
        },
      },
    }),
  );
  await copy.click();
  await expect(page.getByRole("status").filter({ hasText: "Copy unavailable." })).toBeVisible();
  await expect(copy).toHaveText("Copy code");
  await expect(copy.locator("svg")).not.toHaveClass(/text-emerald/);
});
