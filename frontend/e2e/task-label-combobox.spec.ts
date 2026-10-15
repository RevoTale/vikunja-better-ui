import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

test("task labels support searchable filters with many long labels", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/today");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const longTitle = `Unique target ${"long-label-".repeat(20)}`;
  await page.route("**/graphql", async (route) => {
    if (!route.request().postData()?.includes("query TaskLabels")) return route.continue();
    await route.fulfill({
      json: {
        data: {
          taskLabels: [
            ...Array.from({ length: 300 }, (_, index) => ({
              __typename: "TaskLabel",
              id: String(index + 1000),
              title: index < 2 ? "Duplicate" : `Label ${index}`,
            })),
            { __typename: "TaskLabel", id: "2000", title: longTitle },
          ],
        },
      },
    });
  });
  await page.goto("/unscheduled?project=all");
  const trigger = page.getByRole("combobox", { name: "Filter by label" });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "Search labels" });
  await input.fill("Unique target");
  const option = page.getByRole("option", { name: longTitle, exact: true });
  await expect(option).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/label=2000/);
  await expect(trigger).toContainText(longTitle);
  await expect(input).not.toBeVisible();
  await trigger.click();
  await input.fill("does-not-exist");
  await expect(page.getByText("No labels found.", { exact: true })).toBeVisible();
  await input.press("Escape");
  // Escape starts an exit animation. Do not fill the departing input when reopening.
  await expect(input).not.toBeVisible();
  await expect(trigger).toContainText(longTitle);
  await trigger.click();
  await input.fill("All labels");
  await page.getByRole("option", { name: "All labels", exact: true }).click();
  await expect(page).not.toHaveURL(/label=2000/);
  await expect(input).not.toBeVisible();
  await trigger.click();
  await input.fill("Duplicate");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option", { name: "Duplicate (#1001)", exact: true }).click();
  await expect(page).toHaveURL(/label=1001/);
  await expect(trigger).toContainText("Duplicate (#1001)");
  await expect(input).not.toBeVisible();
  await trigger.click();
  await input.fill("All labels");
  await page.getByRole("option", { name: "All labels", exact: true }).click();
  await expect(input).not.toBeVisible();
  await trigger.click();
  await verifyLabelLayout(page, testInfo);
});

async function verifyLabelLayout(page: Page, testInfo: TestInfo) {
  const popup = page.getByRole("listbox");
  await expect(popup).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const box = await popup.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: testInfo.outputPath("label-combobox.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}
