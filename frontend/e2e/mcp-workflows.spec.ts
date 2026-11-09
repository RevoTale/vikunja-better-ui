import { expect, test } from "@playwright/test";
import {
  callMCP,
  fixtureEnv,
  type MCPCompletion,
  type MCPMutation,
  type MCPTask,
  rawMCP,
  writeToken,
} from "./mcp-fixture";

test("MCP edits, comments, relations and caller-bound Undo use native state", async ({
  request,
}) => {
  const token = await writeToken(request);
  const projectId = Number(fixtureEnv("E2E_PROJECT_ID"));
  const created = await callMCP<MCPMutation>(request, token, "create_one_time_task", {
    title: "MCP one-time",
    projectId,
    dueDate: "2027-06-14",
    dueTime: "12:00",
    reminders: [{ relativeTo: "due_date", relativePeriod: -7200 }],
  });
  const taskId = created.task.task.id;
  const beforeEdit = await callMCP<MCPTask>(request, token, "get_task", { taskId });
  expect(created.status).toBe("CONFIRMED");
  const edited = await callMCP<MCPMutation>(request, token, "update_task", {
    taskId,
    expectedVersion: created.task.version,
    title: "MCP renamed",
  });
  expect(edited.task.task.deadline).toBe(created.task.task.deadline);
  const afterEdit = await callMCP<MCPTask>(request, token, "get_task", { taskId });
  expect(afterEdit.reminders).toEqual(beforeEdit.reminders);
  const stale = await rawMCP(request, token, "update_task", {
    taskId,
    expectedVersion: created.task.version,
    title: "Stale",
  });
  expect(stale.isError).toBe(true);
  const comment = await callMCP<{ id: number }>(request, token, "create_comment", {
    taskId,
    bodyHtml: "<p>MCP note</p>",
  });
  await callMCP(request, token, "update_comment", {
    taskId,
    commentId: comment.id,
    bodyHtml: "<p>Revised</p>",
  });
  const comments = await callMCP<{ items: { id: number; bodyHtml: string }[] }>(
    request,
    token,
    "list_comments",
    { taskId },
  );
  expect(
    comments.items.some((item) => item.id === comment.id && item.bodyHtml.includes("Revised")),
  ).toBe(true);
  await callMCP(request, token, "delete_comment", { taskId, commentId: comment.id });
  const child = await callMCP<MCPMutation>(request, token, "create_subtask", {
    parentId: taskId,
    title: "MCP child",
  });
  const detail = await callMCP<MCPTask & { relations: { taskId: number }[] }>(
    request,
    token,
    "get_task",
    { taskId, includeRelations: true, attachmentPage: 1 },
  );
  expect(detail.relations.some((item) => item.taskId === child.task.task.id)).toBe(true);
  await callMCP(request, token, "set_task_relation", {
    taskId,
    otherTaskId: child.task.task.id,
    kind: "subtask",
    remove: true,
  });
  const completed = await callMCP<MCPCompletion>(request, token, "complete_task", { taskId });
  expect(completed.mutation.task.task.done).toBe(true);
  const otherToken = await writeToken(request);
  const denied = await rawMCP(request, otherToken, "undo_completion", {
    capability: completed.undoCapability,
  });
  expect(denied.isError).toBe(true);
  await callMCP(request, token, "undo_completion", { capability: completed.undoCapability });
  const fresh = await callMCP<MCPTask>(request, token, "get_task", { taskId });
  expect(fresh.task.done).toBe(false);
  await callMCP(request, token, "delete_task", { taskId, expectedVersion: fresh.version });
});

test("MCP renews and skips recurring occurrences without completing the next one twice", async ({
  request,
}) => {
  const token = await writeToken(request);
  const created = await callMCP<MCPMutation>(request, token, "create_recurring_task", {
    title: "MCP daily rhythm",
    projectId: Number(fixtureEnv("E2E_PROJECT_ID")),
    firstDueDate: "2027-06-15",
    rule: { interval: 1, unit: "DAY", mode: "SCHEDULED_CYCLE" },
  });
  const taskId = created.task.task.id;
  const completed = await callMCP<MCPCompletion>(request, token, "complete_task", {
    taskId,
    expectedDueAt: created.task.task.deadline,
  });
  expect(completed.mutation.status).toBe("CONFIRMED");
  expect(completed.historyTaskId).toBeGreaterThan(0);
  expect(completed.undoCapability).toBeUndefined();
  const stale = await rawMCP(request, token, "skip_occurrence", {
    taskId,
    expectedDueAt: created.task.task.deadline,
  });
  expect(stale.isError).toBe(true);
  const skipped = await callMCP<MCPCompletion>(request, token, "skip_occurrence", {
    taskId,
    expectedDueAt: completed.mutation.task.task.deadline,
  });
  expect(skipped.mutation.status).toBe("CONFIRMED");
  const overview = await callMCP<{ items: { task: { id: number }; frequency: string }[] }>(
    request,
    token,
    "get_recurring_overview",
    { period: "WEEK" },
  );
  expect(overview.items.find((item) => item.task.id === taskId)?.frequency).toBe("7× / week");
  await callMCP(request, token, "get_context");
  await callMCP(request, token, "get_activity");
  await callMCP(request, token, "get_agenda");
});

test("MCP distinguishes flexible windows from overlapping Jobs and lists completed Jobs", async ({
  request,
}) => {
  const token = await writeToken(request);
  const projectId = Number(fixtureEnv("E2E_EMPTY_PROJECT_ID"));
  await callMCP(request, token, "create_one_time_task", {
    title: "Flexible month",
    projectId,
    planningWindow: { startsOn: "2027-06-01", endsOn: "2027-06-30" },
  });
  const first = await callMCP<MCPMutation>(request, token, "create_job", {
    title: "First session",
    projectId,
    startAt: "2027-06-14T12:00",
    durationMinutes: 60,
    completionWindowMinutes: 30,
  });
  const second = await callMCP<MCPMutation>(request, token, "create_job", {
    title: "Contained session",
    projectId,
    startAt: "2027-06-14T12:15",
    durationMinutes: 15,
    completionWindowMinutes: 30,
  });
  const agenda = await callMCP<{
    sessions: { items: { id: number }[] };
    overlaps: { taskId: number; otherTaskId: number }[];
    obligations: { items: { title: string }[] };
  }>(request, token, "get_agenda", { date: "2027-06-14", projectId });
  expect(agenda.sessions.items.map((item) => item.id).sort()).toEqual(
    [first.task.task.id, second.task.task.id].sort(),
  );
  expect(agenda.overlaps).toHaveLength(1);
  expect(agenda.obligations.items.some((item) => item.title === "Flexible month")).toBe(false);
  await callMCP(request, token, "complete_task", { taskId: first.task.task.id });
  for (const scope of ["ALL_JOBS", "COMPLETED_JOBS"]) {
    const jobs = await callMCP<{ items: { id: number }[] }>(request, token, "list_tasks", {
      scope,
      projectId,
      from: "2020-01-01",
      through: "2030-01-01",
    });
    expect(jobs.items.some((item) => item.id === first.task.task.id)).toBe(true);
  }
});
