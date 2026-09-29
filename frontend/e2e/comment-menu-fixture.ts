import { expect, type Locator, type Page } from "@playwright/test";

export async function commentMenu(page: Page, scope: Page | Locator) {
  await scope.getByRole("button", { name: "Comment actions", exact: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}
