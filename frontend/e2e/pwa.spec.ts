import { expect, test } from "@playwright/test";
import { pwaOrigin } from "./pwa-origin";

test.use({ serviceWorkers: "allow" });

test("PWA caches only the build and opens deep links offline", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing fixture URL");
  const origin = await pwaOrigin(baseURL);
  try {
    await page.goto(`${origin.url}/login`);
    const manifest = await (await page.request.get("/site.webmanifest")).json();
    expect(manifest.start_url).toBe("/week");
    expect(manifest.id).toBe("/today");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([expect.objectContaining({ sizes: "512x512", purpose: "maskable" })]),
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png",
    );
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
    origin.setAvailable(false);
    await expect(page.request.get(`${origin.url}/graphql`)).rejects.toThrow();
    const response = await page.goto(`${origin.url}/tasks/137/discussion?returnTo=%2Fweek`);
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    const nonce = await page.locator('meta[name="csp-nonce"]').getAttribute("content");
    expect(response?.headers()["content-security-policy"]).toContain(`'nonce-${nonce}'`);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      return (
        await Promise.all(
          names.map(async (name) =>
            (
              await (await caches.open(name)).keys()
            ).map((request) => new URL(request.url).pathname),
          ),
        )
      ).flat();
    });
    expect(cached).toContain("/index.html");
    expect(cached.some((path) => /^\/(graphql|media|tasks|login)(\/|$)/.test(path))).toBe(false);
    origin.setAvailable(true);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "You're offline" })).toHaveCount(0);
  } finally {
    await origin.close();
  }
});
