import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("task relationships support new comment references, manual unlink and repair without duplicate content", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const created = await discussionGraphQL<{ createOneTimeTask: { task: { id: string } } }>(
    page,
    "mutation($input:CreateOneTimeTaskInput!) { createOneTimeTask(input:$input) { task { id } } }",
    {
      input: {
        csrfToken,
        title: "Reference target",
        projectId: process.env["E2E_PROJECT_ID"],
        priority: "UNSET",
      },
    },
    csrfToken,
  );
  const target = created.createOneTimeTask.task.id;
  await page.goto(`/tasks/${taskId}`);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill(`See ${new URL(page.url()).origin}/tasks/${target}`);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const related = page.getByRole("region", { name: "Related tasks", exact: true });
  await expect(related).toContainText("Reference target");
  const comments = await discussionGraphQL<{
    taskComments: { items: { id: string; bodyHtml: string }[] };
  }>(page, "query($taskId:ID!) { taskComments(taskId:$taskId) { items { id bodyHtml } } }", {
    taskId,
  });
  const comment = comments.taskComments.items[0];
  if (!comment) throw new Error("Missing saved comment");
  await related.getByRole("button", { name: "Unlink Reference target" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Unlink tasks", exact: true }).click();
  await expect(related).toContainText("None linked.");
  await discussionGraphQL(
    page,
    "mutation($input:UpdateTaskCommentInput!) { updateTaskComment(input:$input) { id } }",
    {
      input: {
        csrfToken,
        taskId,
        commentId: comment.id,
        bodyHtml: `${comment.bodyHtml}<p>Unrelated edit</p>`,
      },
    },
    csrfToken,
  );
  await page.reload();
  await expect(related).toContainText("None linked.");
  await discussionGraphQL(
    page,
    "mutation($input:RepairTaskReferencesInput!) { repairTaskReferences(input:$input) { failedTargetIds } }",
    { input: { csrfToken, taskId, commentId: comment.id, targetIds: [target] } },
    csrfToken,
  );
  await page.reload();
  await expect(related).toContainText("Reference target");
  await expect(page.getByRole("article")).toHaveCount(1);
});
