import { expect, test } from "@playwright/test";
import { callMCP, fixtureEnv, nativeSession, rawMCP } from "./mcp-fixture";

test("MCP preserves bot ownership and limited custom permissions", async ({ request }) => {
  const upstream = fixtureEnv("E2E_VIKUNJA_URL");
  const session = await nativeSession(request);
  const headers = { Authorization: `Bearer ${session}` };
  const botResponse = await request.post(`${upstream}/api/v2/user/bots`, {
    headers,
    data: { username: `bot-mcp-${Date.now()}`, name: "Isolated MCP bot" },
  });
  expect(botResponse.ok()).toBe(true);
  const bot = (await botResponse.json()) as { id: number };
  const tokenResponse = await request.post(`${upstream}/api/v2/tokens`, {
    headers,
    data: {
      title: "Bot readonly",
      owner_id: bot.id,
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
  expect(tokenResponse.ok()).toBe(true);
  const token = (await tokenResponse.json()) as { token: string };
  const context = await callMCP<{ projects: { id: number }[] }>(
    request,
    token.token,
    "get_context",
  );
  expect(
    context.projects.some((project) => project.id === Number(fixtureEnv("E2E_PROJECT_ID"))),
  ).toBe(false);
  const inaccessible = await rawMCP(request, token.token, "list_tasks", {
    scope: "TODAY",
    projectId: Number(fixtureEnv("E2E_PROJECT_ID")),
  });
  expect(inaccessible.isError).toBe(true);
  const limitedResponse = await request.post(`${upstream}/api/v2/tokens`, {
    headers,
    data: {
      title: "Concepts only",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      permissions: { mcp: ["access"] },
    },
  });
  expect(limitedResponse.ok()).toBe(true);
  const limited = (await limitedResponse.json()) as { token: string };
  const concept = await callMCP<{ concept: string }>(request, limited.token, "explain_concept", {
    concept: "planning",
  });
  expect(concept.concept).toBe("planning");
  const denied = await rawMCP(request, limited.token, "list_tasks", { scope: "TODAY" });
  expect(denied.isError).toBe(true);
});

test("MCP rejects expired tokens without app-token fallback", async ({ request }) => {
  const session = await nativeSession(request);
  const response = await request.post(`${fixtureEnv("E2E_VIKUNJA_URL")}/api/v2/tokens`, {
    headers: { Authorization: `Bearer ${session}` },
    data: {
      title: "Expired fixture",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      permissions: { mcp: ["access"] },
    },
  });
  expect(response.ok()).toBe(true);
  const token = (await response.json()) as { token: string };
  const result = await request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token.token}`,
      Accept: "application/json, text/event-stream",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect([401, 403]).toContain(result.status());
});
