import { type APIRequestContext, expect, test } from "@playwright/test";

test("MCP accepts native scoped tokens and rejects revoked access", async ({ request }) => {
  const upstream = requiredEnv("E2E_VIKUNJA_URL");
  const login = await request.post(`${upstream}/api/v2/login`, {
    data: {
      username: requiredEnv("E2E_VIKUNJA_USERNAME"),
      password: requiredEnv("E2E_VIKUNJA_PASSWORD"),
    },
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { token: string };
  const headers = { Authorization: `Bearer ${session.token}` };
  const created = await request.post(`${upstream}/api/v2/tokens`, {
    headers,
    data: {
      title: "MCP isolated readonly fixture",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      permissions: {
        mcp: ["access"],
        other: ["user"],
        projects: ["read_all"],
        tasks: ["read_all", "read_one"],
        labels: ["read_all"],
      },
    },
  });
  expect(created.ok()).toBe(true);
  const token = (await created.json()) as { id: number; token: string };
  try {
    const discovery = await protocol(request, token.token, "tools/list");
    expect(discovery.status()).toBe(200);
    const listed = (await discovery.json()) as { result: { tools: { name: string }[] } };
    expect(listed.result.tools.map((tool) => tool.name)).toContain("list_tasks");
    const tasks = await protocol(request, token.token, "tools/call", {
      name: "list_tasks",
      arguments: { scope: "TODAY" },
    });
    const body = (await tasks.json()) as {
      result: { isError?: boolean; structuredContent?: unknown };
    };
    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent).toBeDefined();
    const denied = await protocol(request, token.token, "tools/call", {
      name: "create_one_time_task",
      arguments: { title: "Must not be created", projectId: Number(requiredEnv("E2E_PROJECT_ID")) },
    });
    const deniedBody = (await denied.json()) as { result: { isError?: boolean } };
    expect(deniedBody.result.isError).toBe(true);
  } finally {
    const removed = await request.delete(`${upstream}/api/v2/tokens/${token.id}`, { headers });
    expect(removed.ok()).toBe(true);
  }
  const revoked = await protocol(request, token.token, "tools/list");
  expect([401, 403]).toContain(revoked.status());
  const jwt = await protocol(request, session.token, "tools/list");
  expect(jwt.status()).toBe(401);
});

function protocol(
  request: APIRequestContext,
  token: string,
  method: string,
  params?: { name: string; arguments: Record<string, unknown> },
) {
  return request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": "2025-11-25",
    },
    data: { jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) },
  });
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing isolated fixture setting: ${key}`);
  return value;
}
