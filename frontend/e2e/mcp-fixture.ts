import { type APIRequestContext, expect } from "@playwright/test";

export interface MCPTask {
  task: {
    id: number;
    title: string;
    deadline?: string;
    plannedFinish?: string;
    recurring: boolean;
    done: boolean;
  };
  version: string;
  reminders: { relative_to: string; relative_period: number }[];
}
export interface MCPMutation {
  task: Pick<MCPTask, "task" | "version">;
  status: string;
}
export interface MCPCompletion {
  mutation: MCPMutation;
  undoCapability?: string;
  historyTaskId?: number;
}

export function fixtureEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing isolated fixture setting ${key}`);
  return value;
}

export async function nativeSession(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${fixtureEnv("E2E_VIKUNJA_URL")}/api/v2/login`, {
    data: {
      username: fixtureEnv("E2E_VIKUNJA_USERNAME"),
      password: fixtureEnv("E2E_VIKUNJA_PASSWORD"),
    },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { token: string }).token;
}

export async function writeToken(
  request: APIRequestContext,
  overrides: Record<string, string[]> = {},
): Promise<string> {
  const session = await nativeSession(request);
  const response = await request.post(`${fixtureEnv("E2E_VIKUNJA_URL")}/api/v2/tokens`, {
    headers: { Authorization: `Bearer ${session}` },
    data: {
      title: "Isolated MCP workflow",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      permissions: {
        mcp: ["access"],
        other: ["user"],
        projects: ["read_all"],
        tasks: ["create", "read_all", "read_one", "update", "delete"],
        labels: ["read_all", "create"],
        tasks_labels: ["create", "read_all", "delete"],
        tasks_relations: ["create", "delete"],
        tasks_comments: ["create", "read_all", "read_one", "update", "delete"],
        tasks_attachments: ["read_all", "read_one"],
        ...overrides,
      },
    },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { token: string }).token;
}

export async function callMCP<T>(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await rawMCP<T>(request, token, name, args);
  expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
  if (result.structuredContent === undefined)
    throw new Error(`Missing structured result for ${name}`);
  return result.structuredContent;
}

export async function rawMCP<T>(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ isError?: boolean; structuredContent?: T; content?: unknown }> {
  const response = await request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": "2025-11-25",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    result: { isError?: boolean; structuredContent?: T; content?: unknown };
  };
  return body.result;
}
