import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports stable Today count dimensions during cached revalidation", async ({
  page,
}) => {
  let count = 7;
  let gate = Promise.resolve();
  let requests = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "ActionableTaskCount") {
      return route.continue();
    }
    requests += 1;
    await gate;
    return route.fulfill({ json: { data: { actionableTaskCount: count } } });
  });
  await discussionFixture(page);
  const badge = page.locator('[data-slot="actionable-count"]:visible');
  await expect(badge).toHaveText("7");
  await expect(badge).toHaveAttribute("aria-busy", "false");
  const box = await badge.boundingBox();
  for (const next of [42, 123, 1234, 0]) {
    let release = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const before = requests;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect(badge).toHaveAttribute("aria-busy", "true");
    await expect(badge).toHaveText(String(count > 999 ? "999+" : count));
    expect(await badge.boundingBox()).toEqual(box);
    count = next;
    release();
    if (next === 0) {
      const hiddenBadge = page.locator('[data-slot="actionable-count"]').first();
      await expect(hiddenBadge).toHaveText("0");
      await expect(hiddenBadge).toHaveClass(/invisible/);
    } else {
      await expect(badge).toHaveText(String(next > 999 ? "999+" : next));
      await expect(badge).toHaveAttribute("aria-busy", "false");
      expect(await badge.boundingBox()).toEqual(box);
    }
  }
});
