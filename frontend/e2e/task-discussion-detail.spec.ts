import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports safe task descriptions and plain text line breaks", async ({ page }) => {
  const { taskId } = await discussionFixture(page);
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://example.com")) externalRequests.push(request.url());
  });
  let description =
    '<p>Readable description</p><script>document.title="unsafe"</script><a href="javascript:alert(1)">Unsafe link</a><iframe src="https://example.com"></iframe>';
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "TaskDetails") return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    json.data.task.description = description;
    await route.fulfill({ response, json });
  });
  await page.goto(`/tasks/${taskId}`);
  const region = page.getByRole("region", { name: "Description", exact: true });
  await expect(region).toContainText("Readable description");
  await expect(region.locator("script, iframe, [href^='javascript:']")).toHaveCount(0);
  await expect(region).toContainText("Some description content cannot be displayed here");
  await expect(page).not.toHaveTitle("unsafe");
  expect(externalRequests).toEqual([]);
  for (const separator of ["\n", "\r\n", "\r"]) {
    description = `Plain text first line${separator}Second line`;
    await page.reload();
    const paragraph = region.getByText(description, { exact: true });
    await expect(paragraph).toBeVisible();
    await expect(paragraph).toHaveCSS("white-space", "pre-wrap");
  }
});

test("discussion supports a description-first task page and shared draft recovery", async ({
  page,
}, testInfo) => {
  const { taskId } = await discussionFixture(page);
  const response = await page.request.patch(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
      data: {
        description:
          '<h2>A clear outcome</h2><p>Make the <strong>important details</strong> easy to read.</p><ul><li>Keep the context</li></ul><p><a href="https://example.com">Reference</a></p>',
      },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto(`/tasks/${taskId}?returnTo=%2Fweek%3Fproject%3Dall`);
  const description = page.getByRole("region", { name: "Description", exact: true });
  await expect(description.getByRole("heading", { name: "A clear outcome" })).toBeVisible();
  await expect(description.locator("strong")).toHaveText("important details");
  await expect(description.getByRole("link", { name: "Reference" })).toHaveAttribute(
    "href",
    "https://example.com",
  );
  const properties = page.getByRole("complementary", { name: "Task properties" });
  await expect(properties).toContainText("Priority");
  await expect(properties).toContainText("Timezone");
  const discussion = page.getByRole("region", { name: "Discussion", exact: true });
  const editor = discussion.getByRole("textbox", { name: "Comment", exact: true });
  await expect(editor).toBeVisible();
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const descriptionBox = await description.boundingBox();
  const propertiesBox = await properties.boundingBox();
  const discussionBox = await discussion.boundingBox();
  expect(
    descriptionBox && discussionBox && discussionBox.y >= descriptionBox.y + descriptionBox.height,
  ).toBe(true);
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    expect(
      descriptionBox && propertiesBox && propertiesBox.x >= descriptionBox.x + descriptionBox.width,
    ).toBe(true);
  }
  await editor.fill("An inline comment");
  await discussion.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(discussion.getByRole("article")).toContainText("An inline comment");
  await editor.fill("Shared draft survives the route change");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some(
          (key) =>
            key.startsWith("vbu:discussion:") &&
            localStorage.getItem(key)?.includes("Shared draft survives the route change"),
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("link", { name: "Discussion", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}/discussion`));
  await expect(page.getByRole("article")).toContainText("An inline comment");
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toContainText(
    "Shared draft survives the route change",
  );
  await page.getByRole("link", { name: "Back to task", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  await expect(
    discussion.getByRole("button", { name: "Restore draft", exact: true }),
  ).toBeVisible();
  await expect(description).toBeVisible();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("task-detail.png"), fullPage: true });
});

test("discussion supports isolated comment errors on task details", async ({ page }) => {
  const { taskId } = await discussionFixture(page);
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "TaskDetails") {
      const response = await route.fetch();
      const json = await response.json();
      json.data.task.isOverdue = true;
      json.data.task.dueAt = "2026-01-01T08:00:00Z";
      await route.fulfill({ response, json });
      return;
    }
    if (route.request().postDataJSON()?.operationName === "DiscussionComments") {
      await route.fulfill({
        json: {
          data: null,
          errors: [
            { message: "Comments are unavailable", extensions: { code: "UPSTREAM_UNAVAILABLE" } },
          ],
        },
      });
    } else await route.continue();
  });
  await page.goto(`/tasks/${taskId}`);
  await expect(
    page.getByRole("heading", { name: "Discussion journal", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Task properties" })).toBeVisible();
  const overdue = page
    .getByRole("complementary", { name: "Task properties" })
    .getByText("Overdue", { exact: true });
  await expect(overdue).toHaveAttribute("data-slot", "badge");
  await expect(overdue).toHaveClass(/text-destructive/);
  expect(
    (await new AxeBuilder({ page }).include('[aria-label="Task properties"]').analyze()).violations,
  ).toEqual([]);
  await expect(page.getByRole("region", { name: "Description", exact: true })).toContainText(
    "No description yet.",
  );
  await expect(
    page.getByRole("region", { name: "Discussion", exact: true }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
});
