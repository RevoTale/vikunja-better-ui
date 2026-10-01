import { expect, test } from "@playwright/test";
import { createTask, expectStatusMessage, login } from "./app-actions";
import { graphQLOperation, searchTasks, vikunjaTask } from "./app-api";
import { appURL } from "./app-fixture";

test("replaying a confirmed Skip cannot renew again or duplicate history", async ({ page }) => {
  await page.goto("/today");
  await login(page);
  const title = `Skip replay ${Date.now()}`;
  const taskID = await createTask(page, "recurring task", title);
  const requestPromise = page.waitForRequest(
    (request) => graphQLOperation(request.postData()) === "SkipRecurringTask",
  );
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const originalRequest = await requestPromise;
  await expectStatusMessage(page, "This occurrence was skipped and the next one is ready.");
  const renewed = await vikunjaTask(taskID);
  const snapshots = (await searchTasks(title)).filter((task) => String(task.id) !== taskID);
  expect(snapshots).toHaveLength(1);

  const body = originalRequest.postData();
  if (!body) throw new Error("Skip request has no payload");
  const csrfToken = await originalRequest.headerValue("x-csrf-token");
  if (!csrfToken) throw new Error("Skip request has no CSRF header");
  const response = await page.request.post("/graphql", {
    headers: { Origin: appURL, "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    data: body,
  });
  const result = await response.json();
  expect(result.errors?.[0]?.extensions?.code).toBe("CONFLICT");
  expect(await vikunjaTask(taskID)).toEqual(renewed);
  expect((await searchTasks(title)).filter((task) => String(task.id) !== taskID)).toEqual(
    snapshots,
  );
});
