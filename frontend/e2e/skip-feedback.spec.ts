import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";
import { graphQLOperation, vikunjaTask } from "./app-api";

test("Skip sends loaded occurrence, refetches conflict and never retries automatically", async ({
  page,
}) => {
  await page.goto("/today");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const id = await createTask(page, "recurring task", `Skip conflict ${Date.now()}`);
  const before = await vikunjaTask(id);
  let skips = 0;
  let reads = 0;
  await page.route("**/graphql", async (route) => {
    const operation = graphQLOperation(route.request().postData());
    if (operation === "TaskDetails") reads++;
    if (operation !== "SkipRecurringTask") return route.continue();
    skips++;
    const body = route.request().postDataJSON();
    expect(new Date(body.variables.input.expectedDueAt).getTime()).toBe(
      new Date(before.due_date).getTime(),
    );
    return route.fulfill({
      json: {
        errors: [
          {
            message: "The occurrence changed. Refresh before retrying.",
            extensions: { code: "CONFLICT" },
          },
        ],
        data: null,
      },
    });
  });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The occurrence changed");
  await expect.poll(() => reads).toBeGreaterThan(0);
  expect(skips).toBe(1);
  expect(await vikunjaTask(id)).toEqual(before);
});

test("Skip partial archival feedback never claims confirmed History", async ({ page }) => {
  await page.goto("/today");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await createTask(page, "recurring task", `Skip partial ${Date.now()}`);
  await page.route("**/graphql", async (route) => {
    if (graphQLOperation(route.request().postData()) !== "SkipRecurringTask")
      return route.continue();
    return route.fulfill({
      json: {
        data: {
          skipRecurringTask: {
            __typename: "CompletionPayload",
            status: "CONFIRMED_REPAIR_REQUIRED",
            completedTask: null,
            renewedTask: null,
            repairCapability: null,
            missingMarkers: [],
            remainingRepairSteps: ["CREATE_HISTORY_SNAPSHOT"],
          },
        },
      },
    });
  });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "History still needs repair" }),
  ).toBeVisible();
  await expect(
    page.getByText("The renewed task and skipped History entry were repaired."),
  ).toHaveCount(0);
});
