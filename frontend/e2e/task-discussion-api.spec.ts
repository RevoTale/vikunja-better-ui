import { expect, type Page, test } from "@playwright/test";

test("discussion API creates, paginates, updates and deletes native Vikunja comments", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  const session = await graphql<{ session: { csrfToken: string } }>(
    page,
    "{ session { csrfToken } }",
  );
  const csrfToken = session.session.csrfToken;
  const created = await graphql<{ createOneTimeTask: { task: { id: string } } }>(
    page,
    `mutation($input: CreateOneTimeTaskInput!) { createOneTimeTask(input: $input) { task { id } } }`,
    {
      input: {
        csrfToken,
        title: "Discussion API fixture",
        projectId: process.env["E2E_PROJECT_ID"],
        priority: "UNSET",
      },
    },
    csrfToken,
  );
  const taskId = created.createOneTimeTask.task.id;
  const ids: string[] = [];
  for (const bodyHtml of ["<p>First comment</p>", "<p>Second comment</p>"]) {
    const data = await graphql<{ createTaskComment: { id: string; bodyHtml: string } }>(
      page,
      `mutation($input: CreateTaskCommentInput!) { createTaskComment(input: $input) { id bodyHtml } }`,
      { input: { csrfToken, taskId, bodyHtml } },
      csrfToken,
    );
    expect(data.createTaskComment.bodyHtml).toContain(bodyHtml.slice(3, -4));
    ids.push(data.createTaskComment.id);
  }
  const query = `query($taskId: ID!, $page: Int!) { taskComments(taskId: $taskId, page: $page, pageSize: 1) { items { id bodyHtml author { id } } page pageSize hasMore totalPages } }`;
  type Result = {
    taskComments: {
      items: { id: string; bodyHtml: string }[];
      hasMore: boolean;
      totalPages: number;
    };
  };
  const first = await graphql<Result>(page, query, { taskId, page: 1 });
  expect(first.taskComments.items.map((comment) => comment.id)).toEqual([ids[0]]);
  expect(first.taskComments.hasMore).toBe(true);
  const second = await graphql<Result>(page, query, { taskId, page: 2 });
  expect(second.taskComments.items.map((comment) => comment.id)).toEqual([ids[1]]);
  expect(second.taskComments.hasMore).toBe(false);
  const changed = await graphql<{ updateTaskComment: { bodyHtml: string } }>(
    page,
    `mutation($input: UpdateTaskCommentInput!) { updateTaskComment(input: $input) { bodyHtml } }`,
    { input: { csrfToken, taskId, commentId: ids[0], bodyHtml: "<p>Edited comment</p>" } },
    csrfToken,
  );
  expect(changed.updateTaskComment.bodyHtml).toContain("Edited comment");
  await graphql(
    page,
    `mutation($input: DeleteTaskCommentInput!) { deleteTaskComment(input: $input) { deletedCommentId } }`,
    { input: { csrfToken, taskId, commentId: ids[0] } },
    csrfToken,
  );
  const remaining = await graphql<Result>(page, query, { taskId, page: 1 });
  expect(remaining.taskComments.items.map((comment) => comment.id)).toEqual([ids[1]]);
});

async function graphql<T>(
  page: Page,
  query: string,
  variables: Record<string, unknown> = {},
  csrfToken?: string,
): Promise<T> {
  const response = await page.request.post("/graphql", {
    data: { query, variables },
    headers: {
      Origin: new URL(page.url()).origin,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
  });
  const body = (await response.json()) as { data: T; errors?: unknown };
  expect(body.errors).toBeUndefined();
  return body.data;
}
