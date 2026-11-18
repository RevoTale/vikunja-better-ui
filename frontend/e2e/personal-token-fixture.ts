import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";
import { nativeFixtureSession, projectID, vikunjaToken, vikunjaURL } from "./app-fixture";

export async function privateTask(request: APIRequestContext, title: string) {
  const response = await request.post(`${vikunjaURL}/api/v2/projects/${projectID}/tasks`, {
    headers: { Authorization: `Bearer ${vikunjaToken}` },
    data: { title },
  });
  expect(response.ok()).toBe(true);
  return String(((await response.json()) as { id: number }).id);
}

export async function secondAccount(request: APIRequestContext) {
  const username = `guest-${randomUUID()}`;
  const password = randomUUID();
  const registration = await request.post(`${vikunjaURL}/api/v2/register`, {
    data: { username, password, email: `${username}@example.invalid` },
  });
  expect(registration.ok()).toBe(true);
  const session = await nativeFixtureSession(request, username, password);
  return { username, ...(await readOnlyToken(request, session)) };
}

export async function readOnlyToken(
  request: APIRequestContext,
  session: string,
  permissions: Record<string, string[]> = {
    other: ["user"],
    projects: ["read_all"],
    tasks: ["read_all", "read_one"],
    labels: ["read_all"],
    tasks_attachments: ["read_all", "read_one"],
    tasks_comments: ["read_all", "read_one"],
  },
) {
  const response = await request.post(`${vikunjaURL}/api/v2/tokens`, {
    headers: { Authorization: `Bearer ${session}` },
    data: {
      title: "Read-only test session",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      permissions,
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: number; token: string };
}
