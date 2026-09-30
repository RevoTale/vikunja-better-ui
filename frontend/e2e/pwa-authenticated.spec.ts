import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test.use({ serviceWorkers: "allow" });

test("PWA keeps authenticated reads and mutations live without caching private responses", async ({
  page,
}) => {
  await discussionFixture(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Published with a controlling service worker");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Published with a controlling service worker" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("article").filter({ hasText: "Published with a controlling service worker" }),
  ).toBeVisible();
  const privatePaths = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = (
      await Promise.all(names.map(async (name) => (await caches.open(name)).keys()))
    ).flat();
    return requests
      .map((request) => new URL(request.url).pathname)
      .filter((path) => /^\/(graphql|media|tasks|login)(\/|$)/.test(path));
  });
  expect(privatePaths).toEqual([]);
});
