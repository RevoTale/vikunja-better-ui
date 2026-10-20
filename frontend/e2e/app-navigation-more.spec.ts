import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./app-actions";

test("More keeps secondary task views and activity out of the primary navigation", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);

  const primary = page.locator('nav[aria-label="Main navigation"]:visible');
  await expect(primary.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Week" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "More" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Jobs" })).toHaveCount(0);
  await expect(primary.getByRole("link", { name: "Long term" })).toHaveCount(0);
  await expect(primary.getByRole("link", { name: "History" })).toHaveCount(0);

  await primary.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More", exact: true })).toBeVisible();
  const views = page.getByRole("navigation", { name: "More views" });
  for (const name of ["Jobs", "Long term", "History", "Last 14 days", "All-time activity"]) {
    await expect(views.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

  await views.getByRole("link", { name: /^Jobs/ }).click();
  await expect(page).toHaveURL(/\/jobs/);
  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
  await expect(primary.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
});
