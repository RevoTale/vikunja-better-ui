import { expect, type Page } from "@playwright/test";
import { appURL, projectID, vikunjaTimezone, vikunjaToken, vikunjaURL } from "./app-fixture";

export type VikunjaTask = {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  start_date: string;
  end_date: string;
  due_date: string;
  done_at: string;
  repeat_mode: number;
  repeat_after: number;
  labels: Array<{ id: number; title: string }>;
};

export async function vikunjaTask(id: string): Promise<VikunjaTask> {
  return api<VikunjaTask>(`/tasks/${id}`);
}

export async function vikunjaTaskStatus(id: string) {
  const response = await fetch(`${vikunjaURL}/api/v2/tasks/${id}`, {
    headers: { Authorization: `Bearer ${vikunjaToken}` },
  });
  return response.status;
}

export async function searchTasks(search: string) {
  const result = await api<VikunjaTask[] | { items: VikunjaTask[] }>(
    `/tasks?q=${encodeURIComponent(search)}&per_page=100`,
  );
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function expectVikunjaTask(id: string, expected: { title: string; done: boolean }) {
  await expect
    .poll(async () => {
      const task = await vikunjaTask(id);
      return { title: task.title, done: task.done };
    })
    .toEqual(expected);
}

export async function expectDateOnlyTask(id: string) {
  const task = await vikunjaTask(id);
  expect(task.labels.some((label: { title?: string }) => label.title === "vbu:date-only")).toBe(
    true,
  );
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: vikunjaTimezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(task.due_date));
  expect(time).toBe("23:59:59");
}

export function graphQLOperation(body: string | null) {
  if (!body) return undefined;
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || !("operationName" in parsed)) return undefined;
  return typeof parsed.operationName === "string" ? parsed.operationName : undefined;
}

export async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${vikunjaURL}/api/v2${path}`, {
    headers: { Authorization: `Bearer ${vikunjaToken}` },
  });
  if (!response.ok) throw new Error(`Vikunja ${path}: ${response.status}`);
  return response.json();
}

export async function expectGraphQLDeleteRejected(page: Page, taskID: string, code: string) {
  const sessionResponse = await page.request.post("/graphql", {
    headers: { Origin: appURL },
    data: { query: "query E2ESession { session { csrfToken } }" },
  });
  const session = await sessionResponse.json();
  const csrfToken = session.data?.session?.csrfToken;
  if (typeof csrfToken !== "string") throw new Error("E2E CSRF token is missing");
  const deleteResponse = await page.request.post("/graphql", {
    headers: { Origin: appURL, "X-CSRF-Token": csrfToken },
    data: {
      query:
        "mutation E2EDelete($input: DeleteTaskInput!) { deleteTask(input: $input) { deletedTaskId } }",
      variables: { input: { csrfToken, taskId: taskID } },
    },
  });
  const payload = await deleteResponse.json();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

export function hasLabelTitle(task: { labels?: Array<{ title?: string }> }, title: string) {
  return task.labels?.some((label) => label.title === title) ?? false;
}

export function graphQLTask(task: {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string;
  labels?: Array<{ id: number; title: string }>;
}) {
  const priorities = ["UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"] as const;
  return {
    id: String(task.id),
    title: task.title,
    kind: "JOB",
    isDone: task.done,
    project: { id: projectID, title: "E2E Daily Tasks", isDefault: true },
    priority: priorities[task.priority] ?? "UNSET",
    dueAt: task.due_date,
    hasDueTime: true,
    isOverdue: false,
    timezone: vikunjaTimezone,
    labels: (task.labels ?? []).map((label) => ({ id: String(label.id), title: label.title })),
  };
}
