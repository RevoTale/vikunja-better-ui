import { type APIRequestContext, expect } from "@playwright/test";

export const vikunjaURL = requiredEnv("E2E_VIKUNJA_URL");
export const appURL = requiredEnv("E2E_BASE_URL");
export const vikunjaToken = requiredEnv("E2E_VIKUNJA_API_TOKEN");
export const projectID = requiredEnv("E2E_PROJECT_ID");
export const emptyProjectID = requiredEnv("E2E_EMPTY_PROJECT_ID");
export const vikunjaTimezone = requiredEnv("E2E_TIMEZONE");
export const invalidTitle = requiredEnv("E2E_INVALID_TITLE");
export const labeledTitle = requiredEnv("E2E_LABELED_TITLE");

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let ownerSession: { token: string; expires: number } | undefined;

export async function nativeFixtureSession(request: APIRequestContext): Promise<string> {
  if (ownerSession && ownerSession.expires > Date.now() + 15_000) return ownerSession.token;
  const token = await loginFixtureAccount(
    request,
    requiredEnv("E2E_FIXTURE_USERNAME"),
    requiredEnv("E2E_FIXTURE_PASSWORD"),
  );
  // Only the test driver reads exp to schedule the next login. Vikunja validates each request.
  const payload = token.split(".")[1];
  if (!payload) throw new Error("The native fixture login did not return a JWT");
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp: number };
  if (!Number.isFinite(exp)) throw new Error("The native fixture JWT has no expiration");
  ownerSession = { token, expires: exp * 1000 };
  return token;
}

export async function loginFixtureAccount(
  request: APIRequestContext,
  username: string,
  password: string,
) {
  const response = await request.post(`${vikunjaURL}/api/v2/login`, {
    data: { username, password },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { token: string }).token;
}
