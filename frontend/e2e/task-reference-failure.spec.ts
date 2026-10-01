import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("task relationships support saved comments with failed references and repair without reposting", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  let creates = 0;
  let repairs = 0;
  page.on("request", (request) => {
    if (!request.url().endsWith("/graphql") || request.method() !== "POST") return;
    const name = request.postDataJSON()?.operationName;
    if (name === "CreateDiscussionComment") creates++;
    if (name === "RepairTaskReferences") repairs++;
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill(`${new URL(page.url()).origin}/tasks/999999999`);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByText("Saved; some task links need attention", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry links", exact: true }).click();
  await expect(page.getByText("Saved; task links need attention", { exact: true })).toBeVisible();
  expect(creates).toBe(1);
  expect(repairs).toBe(1);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("999999999");
  expect(page.url()).toContain(`/tasks/${taskId}`);
});

test("task relationships support confirmed repair when refreshing its display fails", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const created = await discussionGraphQL<{ createOneTimeTask: { task: { id: string } } }>(
    page,
    "mutation($input:CreateOneTimeTaskInput!) { createOneTimeTask(input:$input) { task { id } } }",
    {
      input: {
        csrfToken,
        title: "Repair refresh target",
        projectId: process.env["E2E_PROJECT_ID"],
        priority: "UNSET",
      },
    },
    csrfToken,
  );
  const target = created.createOneTimeTask.task.id;
  let failRefresh = false;
  await page.route("**/graphql", async (route) => {
    const name = route.request().postDataJSON()?.operationName;
    if (name === "TaskRelationships" && failRefresh) {
      await route.fulfill({ json: { data: null, errors: [{ message: "Fixture read failure" }] } });
    } else if (name === "CreateDiscussionComment") {
      const response = await route.fetch();
      const json = await response.json();
      // Inject a partial-success warning on a real saved comment. Repair remains a real idempotent request.
      json.data.createTaskComment.referenceLinking.failedTargetIds = [target];
      json.data.createTaskComment.referenceLinking.linkedCount = 0;
      await route.fulfill({ response, json });
    } else if (name === "RepairTaskReferences") {
      const response = await route.fetch();
      failRefresh = true;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByRole("region", { name: "Related tasks", exact: true })).toContainText(
    "None linked.",
  );
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill(`${new URL(page.url()).origin}/tasks/${target}`);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.getByRole("button", { name: "Retry links", exact: true }).click();
  await expect(page.getByText("Task links added", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved; refresh relationships", { exact: true })).toBeVisible();
  await expect(page.getByText("Links could not be repaired", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(1);
});
