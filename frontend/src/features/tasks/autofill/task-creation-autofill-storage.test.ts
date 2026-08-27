import { describe, expect, it } from "vitest";

import {
  createTaskCreationMemoryStore,
  type StorageLike,
  taskCreationSnapshot,
} from "./task-creation-autofill-storage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("task creation autofill storage", () => {
  it("round-trips independent versioned scope and variant records", () => {
    const storage = new MemoryStorage();
    const store = createTaskCreationMemoryStore(storage);
    const form = new FormData();
    form.set("job", "on");
    form.set("title", "  Repeated job  ");
    form.set("projectId", "20");
    form.set("priority", "MEDIUM");
    form.set("startDate", "2026-09-01");
    form.set("startTime", "08:30");
    form.set("durationMinutes", "45");
    form.set("completionWindowMinutes", "90");
    form.set("description", "must not persist");

    store.save(taskCreationSnapshot("recurring", form));

    expect(store.load("recurring")).toEqual({
      variant: "job",
      records: {
        "recurring:job": {
          title: "Repeated job",
          projectId: "20",
          priority: "MEDIUM",
          startDate: "2026-09-01",
          startTime: "08:30",
          durationMinutes: "45",
          completionWindowMinutes: "90",
        },
      },
    });
    expect([...storage.values.keys()]).toEqual([
      "vbu:task-create-autofill:v1:recurring:job",
      "vbu:task-create-autofill:v1:recurring:last-variant",
    ]);
  });

  it("ignores corrupt, unknown-version, and invalid records", () => {
    const storage = new MemoryStorage();
    storage.values.set("vbu:task-create-autofill:v1:one-time:task", "not json");
    storage.values.set(
      "vbu:task-create-autofill:v1:one-time:job",
      JSON.stringify({ version: 2, values: { title: "Wrong version" } }),
    );
    storage.values.set("vbu:task-create-autofill:v1:one-time:last-variant", "invalid");

    expect(createTaskCreationMemoryStore(storage).load("one-time")).toEqual({ records: {} });
  });

  it("fails open when storage access throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    const store = createTaskCreationMemoryStore(storage);
    const form = new FormData();
    form.set("title", "Still created");

    expect(store.load("one-time")).toEqual({ records: {} });
    expect(() => store.save(taskCreationSnapshot("one-time", form))).not.toThrow();
  });

  it("keeps only fields belonging to the submitted scope", () => {
    const form = new FormData();
    form.set("title", "Recurring task");
    form.set("projectId", "10");
    form.set("priority", "LOW");
    form.set("firstDueDate", "2026-09-02");
    form.set("dueTime", "19:00");
    form.set("interval", "2");
    form.set("mode", "FROM_COMPLETION");

    expect(taskCreationSnapshot("recurring", form)).toEqual({
      baseType: "recurring",
      variant: "task",
      values: {
        title: "Recurring task",
        projectId: "10",
        priority: "LOW",
        firstDueDate: "2026-09-02",
        dueTime: "19:00",
      },
    });
  });
});
