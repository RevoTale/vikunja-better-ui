import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports clear sorting and temporary refresh confirmation", async ({
  page,
}, testInfo) => {
  await discussionFixture(page);
  const order = page.getByRole("combobox", { name: "Sort comments" });
  await expect(order).toContainText("Oldest first");
  await order.click();
  await page.getByRole("option", { name: "Newest first", exact: true }).click();
  await expect(order).toContainText("Newest first");
  const refresh = page.getByRole("button", { name: /^Refresh/ });
  await expect(refresh).toBeEnabled();
  const width = (await refresh.boundingBox())?.width;
  const orderBox = await order.boundingBox();
  const refreshBox = await refresh.boundingBox();
  expect(
    orderBox &&
      refreshBox &&
      Math.abs(orderBox.y + orderBox.height - refreshBox.y - refreshBox.height) < 1,
  ).toBe(true);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.clock.install({ time: new Date("2026-09-28T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-28T12:00:01Z"));
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName === "DiscussionComments") await gate;
    await route.continue();
  });
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh).toHaveText("Refresh");
  await expect(refresh).toHaveCSS("opacity", "1");
  await page.clock.fastForward(900);
  await expect(refresh).toHaveText("Refresh");
  await page.clock.fastForward(100);
  await expect(refresh).toContainText("Refreshing");
  release();
  await expect(refresh).toContainText("Updated");
  await expect(page.getByRole("status").filter({ hasText: "Comments refreshed." })).toBeVisible();
  expect((await refresh.boundingBox())?.width).toBe(width);
  await page.clock.fastForward(2000);
  await expect(refresh).toHaveText("Refresh");
  await expect(refresh).toBeEnabled();
  // A fast subsequent response must cancel the delayed loading transition.
  await refresh.click();
  await expect(refresh).toHaveText("Updated");
  await page.clock.fastForward(1000);
  await expect(refresh).toHaveText("Updated");
  await page.clock.fastForward(1000);
  await expect(refresh).toHaveText("Refresh");
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("discussion-controls.png"), fullPage: true });
});

test("discussion supports failed refresh without a success confirmation", async ({ page }) => {
  await discussionFixture(page);
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "DiscussionComments")
      return route.continue();
    await route.fulfill({
      json: {
        data: null,
        errors: [{ message: "Refresh unavailable", extensions: { code: "UPSTREAM_UNAVAILABLE" } }],
      },
    });
  });
  const refresh = page.getByRole("button", { name: /^Refresh/ });
  await refresh.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(refresh).toHaveText("Refresh");
  await expect(page.getByText("Comments refreshed.", { exact: true })).toHaveCount(0);
  await expect(refresh).toBeEnabled();
});
