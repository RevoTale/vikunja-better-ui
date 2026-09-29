import { expect, type Page } from "@playwright/test";
import { displayDate, localDateTime, selectDate } from "./app-calendar";
import { vikunjaURL } from "./app-fixture";
import { chooseSelectOption } from "./app-layout";

export async function login(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function createTask(
  page: Page,
  type: "one-time task" | "recurring task" | "job",
  title: string,
  fill?: () => Promise<void>,
) {
  await page.goto("/tasks/new?type=one-time&returnTo=%2Ftoday");
  const baseType = type === "job" ? "one-time task" : type;
  const typeButton = page.getByRole("button", { name: baseType, exact: true });
  await typeButton.click();
  await expect(typeButton).toHaveAttribute("aria-pressed", "true");
  const job = page.getByLabel("Job", { exact: true });
  if (type === "job") await job.check();
  else await job.uncheck();
  await page
    .getByRole("textbox", { name: type === "job" ? "Title (optional)" : "Title", exact: true })
    .fill(title);
  if (fill) await fill();
  await page
    .getByRole("button", { name: type === "job" ? "Create job" : `Create ${type}`, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const match = page.url().match(/\/tasks\/(\d+)/);
  if (!match?.[1]) throw new Error("created task ID is missing from the URL");
  return match[1];
}

export async function createRecurringJob(
  page: Page,
  title: string,
  options: {
    startDate: string;
    startTime: string;
    renewal?: "Scheduled cycle";
    keepStartTime?: boolean;
  },
) {
  await page.goto("/tasks/new?type=recurring&returnTo=%2Fjobs");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Job", { exact: true }).check();
  await selectDate(page, "Start date", options.startDate);
  await page.getByLabel("Start time", { exact: true }).fill(options.startTime);
  await page.getByLabel("Every").fill("2");
  if (options.renewal) await chooseSelectOption(page, "Renewal", options.renewal);
  if (options.keepStartTime === false) {
    await page.getByLabel("Keep start time of day").uncheck();
  }
  await page.getByRole("button", { name: "Create recurring Job", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const match = page.url().match(/\/tasks\/(\d+)/);
  if (!match?.[1]) throw new Error("created recurring Job ID is missing from the URL");
  return match[1];
}

export async function blockBrowserVikunjaCalls(page: Page) {
  page.on("pageerror", (error) => console.error(`Browser error: ${error.stack ?? error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      console.error(
        `Browser console: ${message.text()} (${location.url}:${location.lineNumber}:${location.columnNumber})`,
      );
    }
  });
  page.on("request", (request) => {
    if (request.url().startsWith(vikunjaURL)) throw new Error("Browser called Vikunja directly");
  });
}

export async function expectStatusMessage(page: Page, message: string) {
  await expect(page.getByRole("status").filter({ hasText: message })).toHaveText(message);
}

export async function expectRenewedDate(page: Page, id: string, dueDate: string) {
  await page.goto(`/tasks/${id}?returnTo=%2Ftoday`);
  const localDueDate = localDateTime(dueDate).slice(0, 10);
  await expect(page.getByText(displayDate(localDueDate), { exact: true })).toBeVisible();
}
