import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("PWA keeps Today below the sticky header with a top safe-area inset", async ({ page }) => {
  await discussionFixture(page);
  await page.goto("/week");
  const today = page.locator("#week-today");
  await expect(today).toBeVisible();
  // Let the route's initial automatic scroll finish before changing device geometry.
  await expect
    .poll(() => today.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
    .toBe(80);
  // Desktop automation has no physical notch. Supply the same inset used by the layout.
  await page.evaluate(() => document.documentElement.style.setProperty("--app-safe-top", "44px"));
  await expect(page.locator("header.sticky")).toHaveCSS("min-height", "108px");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const scrollOffset = await today.evaluate((element) => {
    const padding =
      Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return Number.parseFloat(getComputedStyle(element).scrollMarginTop) + padding;
  });
  await expect
    .poll(() => today.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
    .toBe(scrollOffset);
  const header = await page.locator("header.sticky").boundingBox();
  const heading = await today.getByRole("heading", { name: "Today", exact: true }).boundingBox();
  if (!header || !heading) throw new Error("Missing Today or header geometry");
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height);
});
