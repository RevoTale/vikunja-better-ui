import { expect, test } from "@playwright/test";
import { api, type VikunjaTask } from "./app-api";
import { projectID, vikunjaToken, vikunjaURL } from "./app-fixture";

type RelatedTask = VikunjaTask & { related_tasks: Record<string, VikunjaTask[]> };

async function write(path: string, method: string, body?: object) {
  return fetch(`${vikunjaURL}/api/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${vikunjaToken}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function task(title: string) {
  const response = await write(`/projects/${projectID}/tasks`, "POST", { title });
  expect(response.ok).toBe(true);
  const created: VikunjaTask = await response.json();
  return created.id;
}

async function relate(base: number, other: number, kind: string) {
  return write(`/tasks/${base}/relations`, "POST", { other_task_id: other, relation_kind: kind });
}

test("pinned Vikunja relations are symmetric and leave independent children intact", async () => {
  const parent = await task("Relation contract parent");
  const child = await task("Relation contract child");
  expect((await relate(parent, child, "subtask")).ok).toBe(true);
  const parentTask = await api<RelatedTask>(`/tasks/${parent}`);
  const childTask = await api<RelatedTask>(`/tasks/${child}`);
  expect(parentTask.related_tasks["subtask"]?.map((item) => item.id)).toContain(child);
  expect(childTask.related_tasks["parenttask"]?.map((item) => item.id)).toContain(parent);
  expect((await relate(parent, child, "subtask")).ok).toBe(false);
  expect((await relate(child, parent, "subtask")).ok).toBe(false);
  expect((await relate(parent, parent, "related")).ok).toBe(false);

  expect((await write(`/tasks/${parent}`, "PATCH", { done: true })).ok).toBe(true);
  expect((await api<VikunjaTask>(`/tasks/${child}`)).done).toBe(false);
  expect((await write(`/tasks/${parent}`, "DELETE")).ok).toBe(true);
  expect((await api<VikunjaTask>(`/tasks/${child}`)).done).toBe(false);
});

test("pinned Vikunja related removal clears both sides but allows multiple parents", async () => {
  const first = await task("Relation contract first");
  const second = await task("Relation contract second");
  const child = await task("Relation contract shared child");
  expect((await relate(first, second, "related")).ok).toBe(true);
  expect((await api<RelatedTask>(`/tasks/${second}`)).related_tasks["related"]?.[0]?.id).toBe(
    first,
  );
  expect((await write(`/tasks/${second}/relations/related/${first}`, "DELETE")).ok).toBe(true);
  expect((await api<RelatedTask>(`/tasks/${first}`)).related_tasks["related"] ?? []).toEqual([]);
  expect((await relate(first, child, "subtask")).ok).toBe(true);
  expect((await relate(second, child, "subtask")).ok).toBe(true);
  expect((await api<RelatedTask>(`/tasks/${child}`)).related_tasks["parenttask"]).toHaveLength(2);
});

test("pinned Vikunja recurring renewal preserves independent children", async () => {
  const response = await write(`/projects/${projectID}/tasks`, "POST", {
    title: "Recurring relation parent",
    repeat_after: 86400,
    repeat_mode: 0,
    due_date: new Date(Date.now() - 86400000).toISOString(),
  });
  expect(response.ok).toBe(true);
  const parent: RelatedTask = await response.json();
  const childID = await task("Recurring relation child");
  const before = await api<VikunjaTask>(`/tasks/${childID}`);
  expect((await relate(parent.id, childID, "subtask")).ok).toBe(true);
  expect((await write(`/tasks/${parent.id}`, "PATCH", { done: true })).ok).toBe(true);
  const renewed = await api<RelatedTask>(`/tasks/${parent.id}`);
  expect(renewed.done).toBe(false);
  expect(new Date(renewed.due_date).getTime()).toBeGreaterThan(new Date(parent.due_date).getTime());
  expect(renewed.related_tasks["subtask"]?.map((item) => item.id)).toEqual([childID]);
  const child = await api<VikunjaTask>(`/tasks/${childID}`);
  expect(child.done).toBe(before.done);
  expect(child.due_date).toBe(before.due_date);
  expect(child.repeat_after).toBe(0);
});

test("pinned Vikunja accepts concurrent comment and relation writes", async () => {
  const pairs: Array<{ source: number; target: number }> = [];
  const created: number[] = [];
  try {
    for (let index = 0; index < 20; index++) {
      const source = await task(`Concurrent source ${index}`);
      created.push(source);
      const target = await task(`Concurrent target ${index}`);
      created.push(target);
      pairs.push({ source, target });
    }
    const responses = await Promise.all(
      pairs.flatMap(({ source, target }) => [
        write(`/tasks/${source}/comments`, "POST", { comment: "<p>Concurrent comment</p>" }),
        relate(source, target, "related"),
      ]),
    );
    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: pairs.length * 2 }, () => 201),
    );
    for (const { source, target } of pairs) {
      expect(
        (await api<RelatedTask>(`/tasks/${source}`)).related_tasks["related"]?.map(
          (item) => item.id,
        ),
      ).toEqual([target]);
    }
  } finally {
    for (const id of created) expect((await write(`/tasks/${id}`, "DELETE")).ok).toBe(true);
  }
});
