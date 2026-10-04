import { expect, test } from "@playwright/test";
import { createRecurringJob, createTask, login } from "./app-actions";
import { api, searchTasks } from "./app-api";
import { localDate } from "./app-calendar";
import { discussionGraphQL } from "./discussion-fixture";

test("recurring history copies related tasks but never comments or subtasks", async ({ page }) => {
  await page.goto("/today");
  await login(page);
  const title = `Recurring isolation ${Date.now()}`;
  const related = await createTask(page, "one-time task", `${title} related`);
  const child = await createTask(page, "one-time task", `${title} child`);
  const live = await createRecurringJob(page, title, {
    startDate: localDate(),
    startTime: "10:00",
  });
  const {
    session: { csrfToken },
  } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{ session { csrfToken } }",
  );
  for (const [otherTaskId, kind] of [
    [related, "RELATED"],
    [child, "SUBTASK"],
  ]) {
    await discussionGraphQL(
      page,
      `mutation($input: SetTaskRelationInput!) {
      setTaskRelation(input: $input) { taskId }
    }`,
      { input: { taskId: live, otherTaskId, kind, csrfToken } },
      csrfToken,
    );
  }
  await discussionGraphQL(
    page,
    `mutation($input: CreateTaskCommentInput!) {
    createTaskComment(input: $input) { id }
  }`,
    { input: { taskId: live, csrfToken, bodyHtml: "<p>Keep only on live series</p>" } },
    csrfToken,
  );
  await page.goto("/jobs");
  await page.getByRole("button", { name: `Complete ${title}`, exact: true }).click();
  await expect
    .poll(
      async () =>
        (await searchTasks(title)).filter((task) => task.title === title && task.done).length,
    )
    .toBe(1);
  const snapshot = (await searchTasks(title)).find((task) => task.title === title && task.done);
  if (!snapshot) throw new Error("snapshot missing");
  const relationQuery = `query($taskId: ID!) { taskRelationships(taskId: $taskId) {
    related { id } children { id } parents { id }
  } }`;
  const result = await discussionGraphQL<{
    taskRelationships: {
      related: { id: string }[];
      children: { id: string }[];
      parents: { id: string }[];
    };
  }>(page, relationQuery, { taskId: String(snapshot.id) });
  expect(result.taskRelationships.related.map((task) => task.id)).toEqual([related]);
  expect(result.taskRelationships.children).toEqual([]);
  expect(result.taskRelationships.parents).toEqual([]);
  expect((await api<{ items: unknown[] }>(`/tasks/${snapshot.id}/comments`)).items).toEqual([]);
  expect((await api<{ items: unknown[] }>(`/tasks/${live}/comments`)).items).toHaveLength(1);
});
