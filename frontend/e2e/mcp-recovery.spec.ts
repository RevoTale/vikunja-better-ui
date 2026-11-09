import { expect, test } from "@playwright/test";
import { callMCP, fixtureEnv, type MCPMutation, rawMCP, writeToken } from "./mcp-fixture";

test("MCP reports marker repair without duplicating a created task or crossing tokens", async ({
  request,
}) => {
  const full = await writeToken(request);
  const projectId = Number(fixtureEnv("E2E_PROJECT_ID"));
  // Ensure the native marker exists before intentionally denying association rights.
  await callMCP(request, full, "create_one_time_task", {
    title: "Marker seed",
    projectId,
    dueDate: "2027-06-14",
  });
  const limited = await writeToken(request, { tasks_labels: ["read_all"] });
  const partial = await callMCP<MCPMutation & { repairKind: string; repairCapability: string }>(
    request,
    limited,
    "create_one_time_task",
    { title: "Recoverable marker fixture", projectId, dueDate: "2027-06-14" },
  );
  expect(partial.status).toBe("REPAIR_REQUIRED");
  expect(partial.repairKind).toBe("markers");
  expect(Boolean(partial.repairCapability)).toBe(true);
  const denied = await rawMCP(request, full, "repair_task", {
    kind: partial.repairKind,
    capability: partial.repairCapability,
  });
  expect(denied.isError).toBe(true);
  const retry = await callMCP<{ mutation: MCPMutation }>(request, limited, "repair_task", {
    kind: partial.repairKind,
    capability: partial.repairCapability,
  });
  expect(retry.mutation.status).toBe("REPAIR_REQUIRED");
  expect(retry.mutation.task.task.id).toBe(partial.task.task.id);
  const tasks = await callMCP<{ items: { id: number; title: string }[] }>(
    request,
    full,
    "list_tasks",
    { scope: "LONG_TERM", projectId, pageSize: 100 },
  );
  expect(tasks.items.filter((item) => item.title === "Recoverable marker fixture")).toHaveLength(1);
});
