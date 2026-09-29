import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports editing-time links and saved task-title snapshots", async ({ page }) => {
  const { taskId } = await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.pressSequentially("http://localhost:4180/path");
  await expect(editor.getByRole("link")).toHaveCount(0);
  await editor.press("Space");
  await expect(editor.getByRole("link")).toHaveAttribute("href", "http://localhost:4180/path");
  await editor.getByRole("link").click();
  await expect(page.getByRole("link", { name: "Open link", exact: true })).toHaveAttribute(
    "href",
    "http://localhost:4180/path",
  );
  await page.getByRole("button", { name: "Cancel link", exact: true }).click();
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  await editor.pressSequentially("https://example.com/enter");
  await expect(
    editor.getByRole("link", { name: "https://example.com/enter", exact: true }),
  ).toHaveCount(0);
  await editor.press("Enter");
  await expect(
    editor.getByRole("link", { name: "https://example.com/enter", exact: true }),
  ).toBeVisible();
  const taskUrl = `${new URL(page.url()).origin}/tasks/${taskId}`;
  await editor.evaluate((element, url) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", url);
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
    );
  }, taskUrl);
  await expect(
    editor.getByRole("link", { name: "Discussion journal", exact: true }),
  ).toHaveAttribute("href", taskUrl);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const article = page.getByRole("article");
  await expect(
    article.getByRole("link", { name: "Discussion journal", exact: true }),
  ).toHaveAttribute("href", taskUrl);
  let lookups = 0;
  page.on("request", (request) => {
    if (request.postData()?.includes("DiscussionTaskLink")) lookups++;
  });
  await page.reload();
  await expect(
    article.getByRole("link", { name: "Discussion journal", exact: true }),
  ).toBeVisible();
  expect(lookups).toBe(0);
  const footer = article.locator("[data-comment-actions]");
  expect((await footer.boundingBox())?.height).toBeLessThanOrEqual(49);
  expect(
    (await footer.getByRole("button", { name: "Reply" }).boundingBox())?.height,
  ).toBeGreaterThanOrEqual(44);
});

test("discussion supports publishing while an optional title lookup is delayed", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (!route.request().postData()?.includes("DiscussionTaskLink")) return route.continue();
    await gate;
    await route.fulfill({
      json: { data: { task: { id: taskId, title: "Late title", __typename: "Task" } } },
    });
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  const href = `${new URL(page.url()).origin}/tasks/${taskId}`;
  const requested = page.waitForRequest(
    (request) => request.postData()?.includes("DiscussionTaskLink") === true,
  );
  await editor.fill(`${href} `);
  await requested;
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByRole("article").getByRole("link", { name: href, exact: true }),
  ).toBeVisible();
  await editor.fill("New draft must survive");
  const finished = page.waitForResponse(
    (response) => response.request().postData()?.includes("DiscussionTaskLink") === true,
  );
  release();
  await finished;
  await expect(editor).toHaveText("New draft must survive");
  await expect(page.getByRole("article")).not.toContainText("Late title");
});

test("discussion supports keeping edited link text when resolution arrives late", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (!route.request().postData()?.includes("DiscussionTaskLink")) return route.continue();
    await gate;
    await route.fulfill({
      json: { data: { task: { id: taskId, title: "Late title", __typename: "Task" } } },
    });
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  const requested = page.waitForRequest(
    (request) => request.postData()?.includes("DiscussionTaskLink") === true,
  );
  await editor.fill(`${new URL(page.url()).origin}/tasks/${taskId} `);
  await requested;
  await editor.fill("My replacement");
  const finished = page.waitForResponse(
    (response) => response.request().postData()?.includes("DiscussionTaskLink") === true,
  );
  release();
  await finished;
  await expect(editor).toHaveText("My replacement");
});
