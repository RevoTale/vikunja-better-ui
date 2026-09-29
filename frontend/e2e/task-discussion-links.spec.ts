import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports visible clickable URLs while preserving code", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input:CreateTaskCommentInput!){createTaskComment(input:$input){id}}",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml:
          '<p>Read https://example.com/guide, or www.example.org.</p><p><a href="https://example.com/named">Named link</a></p><p><code>https://example.com/literal</code></p><pre><code>https://example.com/code</code></pre><p>javascript:alert(1)</p>',
      },
    },
    csrfToken,
  );
  await page.reload();
  const article = page.getByRole("article");
  const link = article.getByRole("link", { name: "https://example.com/guide", exact: true });
  await expect(link).toHaveAttribute("href", "https://example.com/guide");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(article.getByRole("link", { name: "www.example.org", exact: true })).toHaveAttribute(
    "href",
    "https://www.example.org",
  );
  await expect(article.locator("code a, pre a, a a")).toHaveCount(0);
  await expect(article.getByRole("link")).toHaveCount(3);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    expect(await link.evaluate((element) => getComputedStyle(element).color)).not.toBe(
      await article.evaluate((element) => getComputedStyle(element).color),
    );
  }
  await page
    .context()
    .route("https://example.com/guide", (route) => route.fulfill({ body: "Link destination" }));
  await link.focus();
  const opened = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await opened;
  await expect(popup).toHaveURL("https://example.com/guide");
  await popup.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
