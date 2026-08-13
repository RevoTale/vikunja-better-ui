import { describe, expect, it } from "vitest";

import type { TaskPriority } from "@/graphql/graphql";
import { taskPriorityLabel, taskPriorityOptions } from "./task-priority";

describe("task priorities", () => {
  it("provides every GraphQL priority in Vikunja order", () => {
    const expected = [
      "UNSET",
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
      "DO_NOW",
    ] satisfies TaskPriority[];
    expect(taskPriorityOptions.map(({ value }) => value)).toEqual(expected);
  });

  it("uses readable Vikunja labels", () => {
    expect(taskPriorityLabel("UNSET")).toBe("No priority");
    expect(taskPriorityLabel("DO_NOW")).toBe("Do now");
  });
});
