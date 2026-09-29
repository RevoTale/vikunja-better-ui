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
