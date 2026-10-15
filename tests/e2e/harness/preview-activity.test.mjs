import assert from "node:assert/strict";
import test from "node:test";
import { previewActivityTasks } from "./preview-activity.mjs";

test("preview history spans three weeks with varied counts, priorities and timeliness", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const tasks = previewActivityTasks(now, 42);
  const dates = new Set(tasks.map((task) => task.done_at.slice(0, 10)));
  assert.equal(dates.size, 21);
  assert.equal([...dates].sort()[0], "2026-09-25");
  assert.equal(new Set(tasks.map((task) => task.priority)).size, 6);
  assert.ok(tasks.every((task) => new Date(task.done_at) <= now));
  assert.ok(tasks.some((task) => !task.due_date));
  const dated = tasks.filter((task) => task.due_date);
  assert.ok(dated.some((task) => task.done_at < task.due_date));
  assert.ok(dated.some((task) => task.done_at > task.due_date));
  assert.deepEqual(tasks, previewActivityTasks(now, 42));
  assert.notDeepEqual(tasks, previewActivityTasks(now, 43));
});
