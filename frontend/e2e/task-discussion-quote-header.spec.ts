import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports stable comment dimensions when focused", async ({ page }, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml: `<p>${"A long comment should keep the same text wrapping and width when focused. ".repeat(8)}</p>`,
      },
    },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const comment = page.getByRole("article");
  await expect(comment).toBeVisible();
  const dimensions = () =>
    comment.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const text = element.querySelector(".discussion-rich-text")?.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        textWidth: text?.width,
        textHeight: text?.height,
        padding: getComputedStyle(element).padding,
      };
    });
  const before = await dimensions();
  for (const colorScheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(comment).toHaveCSS("border-top-width", "1px");
    const colors = await comment.evaluate((element) => ({
      card: getComputedStyle(element).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    }));
    expect(colors.card).not.toBe("rgba(0, 0, 0, 0)");
    expect(colors.card).not.toBe(colors.page);
    await expect(comment.locator("[data-comment-actions]")).toHaveCSS("border-top-width", "1px");
    await comment.screenshot({ path: testInfo.outputPath(`comment-${colorScheme}.png`) });
  }
  await comment.focus();
  await expect(comment).toBeFocused();
  expect(await dimensions()).toEqual(before);
  expect(await comment.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
});

test("discussion supports a compact source author header above the quote text", async ({
  page,
}, testInfo) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const upstream = process.env.E2E_VIKUNJA_URL;
  if (!upstream) throw new Error("Missing isolated Vikunja URL");
  const login = await page.request.post(`${upstream}/api/v2/login`, {
    data: { username: "e2e-user", password: "e2e-password-strong" },
  });
  expect(login.ok()).toBe(true);
  const { token } = await login.json();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Missing canvas context");
    context.fillStyle = "#2874a6";
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  const upload = await page.request.put(`${upstream}/api/v2/user/settings/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      avatar: { name: "avatar.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") },
    },
  });
  expect(upload.ok()).toBe(true);
  const original = await discussionGraphQL<{
    createTaskComment: { id: string; author: { name: string; username: string } };
  }>(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id author { name username } } }",
    { input: { taskId, csrfToken, bodyHtml: "<p>Original text with plenty of context.</p>" } },
    csrfToken,
  );
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml: `<blockquote data-comment-id="${original.createTaskComment.id}">Original text with plenty of context.</blockquote><p>A response</p>`,
      },
    },
    csrfToken,
  );
  let lookups = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/graphql") &&
      request.postDataJSON().operationName === "DiscussionOriginal"
    )
      lookups++;
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const quote = page.locator("article blockquote");
  const primaryHeader = page.locator(`#comment-${original.createTaskComment.id} > header`);
  await expect(primaryHeader.locator("img")).toBeVisible();
  expect(
    await primaryHeader.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  const header = quote.locator("[data-quote-author]");
  await expect(header).toContainText(
    original.createTaskComment.author.name || original.createTaskComment.author.username,
  );
  const typography = await quote.evaluate((element) => {
    const primary = element.closest("article")?.querySelector("[data-comment-author]");
    const quoted = element.querySelector("[data-quote-author] > span:not([aria-hidden])");
    if (!primary || !quoted) throw new Error("Missing author names");
    const mainStyle = getComputedStyle(primary);
    const quoteStyle = getComputedStyle(quoted);
    return {
      primarySize: Number.parseFloat(mainStyle.fontSize),
      quoteSize: Number.parseFloat(quoteStyle.fontSize),
      primaryWeight: Number.parseInt(mainStyle.fontWeight, 10),
      quoteWeight: Number.parseInt(quoteStyle.fontWeight, 10),
      primaryColor: mainStyle.color,
      quoteColor: quoteStyle.color,
    };
  });
  expect(typography.primarySize).toBeGreaterThan(typography.quoteSize);
  expect(typography.primaryWeight).toBeGreaterThan(typography.quoteWeight);
  expect(typography.primaryColor).not.toBe(typography.quoteColor);
  const arrow = header.getByRole("button", { name: "View original", exact: true });
  await expect(arrow).toBeVisible();
  const box = await arrow.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(32);
  expect(box?.height).toBeLessThanOrEqual(32);
  const text = quote.getByText("Original text with plenty of context.", { exact: true });
  const textBox = await text.boundingBox();
  const headerBox = await header.boundingBox();
  expect(textBox && headerBox && textBox.y >= headerBox.y + headerBox.height).toBe(true);
  expect(lookups).toBe(0);
  await expect(header.locator("img")).toBeVisible();
  expect(
    await header.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("quote-header.png"), fullPage: true });
});

test("discussion supports initials when an avatar is unavailable", async ({ page }) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "DiscussionAvatar") {
      await route.fulfill({ json: { data: { discussionAvatar: null } } });
      return;
    }
    await route.continue();
  });
  const original = await discussionGraphQL<{ createTaskComment: { id: string } }>(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    { input: { taskId, csrfToken, bodyHtml: "<p>Original</p>" } },
    csrfToken,
  );
  await discussionGraphQL(
    page,
    "mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id } }",
    {
      input: {
        taskId,
        csrfToken,
        bodyHtml: `<blockquote data-comment-id="${original.createTaskComment.id}">Original</blockquote><p>Reply</p>`,
      },
    },
    csrfToken,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const header = page.locator("[data-quote-author]");
  await expect(header.getByText("EU", { exact: true })).toBeVisible();
  const primaryHeader = page.locator(`#comment-${original.createTaskComment.id} > header`);
  await expect(primaryHeader.getByText("EU", { exact: true })).toBeVisible();
  await expect(primaryHeader.locator("img")).toHaveCount(0);
  await expect(header).toContainText("E2E User");
  await expect(header.locator("img")).toHaveCount(0);
  await header.getByRole("button", { name: "View original" }).click();
  await expect(page.locator(`#comment-${original.createTaskComment.id}`)).toBeFocused();
});
