import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports a clear task workspace with primary completion and secondary actions", async ({
  page,
}, info) => {
  const { taskId } = await discussionFixture(page);
  await page.goto(`/tasks/${taskId}?returnTo=%2Fweek%3Fproject%3Dall`);
  await expect(page.getByRole("button", { name: "Complete task", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit description", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delete", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "More task actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Delete", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Extended", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "More task actions", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Edit title: Discussion journal" }).click();
  await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Keep my edits");
  await expect(page.getByRole("button", { name: "Complete task", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    const properties = await page
      .getByRole("complementary", { name: "Task properties" })
      .boundingBox();
    const relationships = await page
      .getByRole("region", { name: "Task relationships", exact: true })
      .boundingBox();
    expect(properties && relationships && properties.y + properties.height <= relationships.y).toBe(
      true,
    );
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("task-detail-ux.png"), fullPage: true });
  await page.getByRole("button", { name: "Complete task", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Task properties" })).toContainText(
    "Completed",
  );
  await page
    .getByRole("group", { name: "Task completion", exact: true })
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Complete task", exact: true })).toBeVisible();
});

test("discussion supports readable recurring context and one-click occurrence completion", async ({
  page,
}, info) => {
  const { taskId } = await discussionFixture(page);
  const description =
    "<h2>Reading routine</h2><p>Read a few pages without rushing. Keep useful notes in the discussion.</p><ul><li>Choose a quiet moment</li><li>Stop before the evening deadline</li></ul>";
  const result = await page.request.patch(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` },
      data: {
        description,
        repeat_after: 86400,
        repeat_mode: 0,
        due_date: new Date(Date.now() + 86400000).toISOString(),
      },
    },
  );
  expect(result.ok()).toBe(true);
  await page.goto(`/tasks/${taskId}`);
  await expect(
    page.getByText("This discussion belongs to the whole series.", { exact: false }),
  ).toBeVisible();
  const body = page.getByRole("region", { name: "Description", exact: true });
  await expect(body.getByRole("heading", { name: "Reading routine" })).toBeVisible();
  await expect(body).toHaveCSS("pointer-events", "auto");
  await expect(body.locator("li")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("recurring-task-workspace.png"), fullPage: true });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "SkipRecurringTask")
      return route.continue();
    await held;
    await route.fulfill({
      json: {
        data: null,
        errors: [{ message: "Skip was not saved.", extensions: { code: "VALIDATION_FAILED" } }],
      },
    });
  });
  try {
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Complete occurrence", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Complete occurrence", exact: true }),
  ).toBeEnabled();
  await page.unrouteAll({ behavior: "wait" });
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/graphql") &&
      response.request().postData()?.includes("TaskDetails") === true,
  );
  await page.getByRole("button", { name: "Complete occurrence", exact: true }).click();
  await refreshed;
  await expect(
    page
      .getByRole("group", { name: "Task completion", exact: true })
      .getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  await expect(body).toContainText("Choose a quiet moment");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});
