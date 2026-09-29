import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { blockBrowserVikunjaCalls, login } from "./app-actions";
import { datePickerButton } from "./app-calendar";
import { labeledTitle } from "./app-fixture";
import {
  expectBaseUICSP,
  expectBrandTimezone,
  expectTaskRowLayout,
  expectUnclippedLines,
} from "./app-layout";

test("Week is the default landing page and logo destination", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fweek/);
  await login(page);
  await expect(page).toHaveURL(/\/week/);
  await page.goto("/today");
  await page.getByRole("link", { name: /Better Vikunja/ }).click();
  await expect(page).toHaveURL(/\/week/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/week/);
});

test("login restores the requested route and core navigation is accessible", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.goto("/jobs?project=all&page=1");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await login(page);
  await expect(page).toHaveURL(/\/jobs/);
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expect(page.getByText("Prepare weekly status update", { exact: true })).toBeVisible();
  await expectBrandTimezone(page);
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page).toHaveURL(/\/tasks\/new\?type=job/);
  await expect(page.getByRole("heading", { name: "New one-time task" })).toBeVisible();
  await expect(page.getByLabel("Job", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Title (optional)")).toBeFocused();
  await expect(datePickerButton(page, "Start date")).toBeVisible();
  const startTime = page.getByLabel("Start time", { exact: true });
  await expect(startTime).toBeVisible();
  await expect(startTime).toHaveAttribute("type", "time");
  await expect(page.getByLabel("Project", { exact: true }).locator("svg")).toBeVisible();
  await expectCreationControlSizes(page);
  if (test.info().project.name === "phone-320") {
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }).getByText("No date"),
    ).toBeVisible();
  }
  if (test.info().project.name.startsWith("phone-")) {
    await datePickerButton(page, "Start date").click();
    await expect(page.getByRole("heading", { name: "Choose start date" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  }
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/jobs\?project=all&page=1/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/today/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("Take daily vitamins", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Scheduled-cycle task (every 2 days)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("From-completion task (after 2 days)", { exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "phone-320") {
    const longProjectBadge = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Long project badge fixture" })
      .locator('[data-slot="task-project"] [data-slot="badge"]');
    await expectUnclippedLines(longProjectBadge, 3);
  }
  await expectTaskRowLayout(page, labeledTitle, "focus");
  const overdueRow = page.locator('[data-slot="card"]').filter({ hasText: labeledTitle });
  const schedule = overdueRow.locator('[data-slot="task-schedule"]');
  await expect(schedule.getByText("High", { exact: true })).toBeVisible();
  await expect(overdueRow.getByText("High", { exact: true })).toHaveCount(1);
  await expect(schedule).not.toContainText(/\d{2}:\d{2}|\d{2} [A-Z][a-z]{2}/);
  await expect(schedule.getByText("Overdue", { exact: true })).toHaveCSS(
    "text-decoration-line",
    "none",
  );
  await expect(overdueRow.getByRole("link", { name: labeledTitle, exact: true })).toHaveCSS(
    "text-decoration-line",
    "none",
  );
  await expectBaseUICSP(page);
  await page.screenshot({ path: test.info().outputPath("overdue-priority.png"), fullPage: true });
});

test("login displays the GraphQL error returned by the app", async ({ page }) => {
  await blockBrowserVikunjaCalls(page);
  await page.route("**/graphql", async (route) => {
    const operation = route.request().postDataJSON() as { operationName?: string };
    if (operation.operationName !== "Login") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [
          {
            message: "Vikunja is unavailable. Try again shortly.",
            path: ["login"],
            extensions: { code: "UPSTREAM_UNAVAILABLE" },
          },
        ],
        data: null,
      }),
    });
  });

  await page.goto("/login");
  await login(page);

  await expect(page.getByText("Vikunja is unavailable. Try again shortly.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("theme follows system color scheme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page).toHaveTitle("Better Vikunja — Fast recurring task workflows");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A focused, self-hosted interface for fast, predictable recurring-task workflows on Vikunja.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow, noarchive",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  await expect(page.locator('[data-slot="brand-mark"]')).toBeVisible();
  await expect
    .poll(() =>
      page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(233, 228, 216)");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(20, 20, 20)");
});

async function expectCreationControlSizes(page: Page) {
  const startTime = page.getByLabel("Start time", { exact: true });
  const controlHeights = await Promise.all(
    [
      page.getByLabel("Title (optional)"),
      datePickerButton(page, "Start date"),
      startTime,
      page.getByLabel("Project", { exact: true }),
    ].map(async (control) => (await control.boundingBox())?.height),
  );
  expect(controlHeights).toEqual([44, 44, 44, 44]);
  const taskTypeButtons = page.getByRole("group", { name: "Task type" }).getByRole("button");
  await expect(taskTypeButtons).toHaveCount(2);
  for (const button of await taskTypeButtons.all()) {
    expect(
      await button.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true);
  }
}
