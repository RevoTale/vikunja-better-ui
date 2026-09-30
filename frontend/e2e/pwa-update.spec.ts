import { expect, test } from "@playwright/test";
import { pwaOrigin } from "./pwa-origin";

test.use({ serviceWorkers: "allow" });

test("PWA update waits without replacing entered text", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing fixture URL");
  const origin = await pwaOrigin(baseURL);
  try {
    await page.goto(`${origin.url}/login`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.getByRole("textbox", { name: "Username" }).fill("Keep my unfinished input");
    origin.nextBuild();
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect
      .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)))
      .toBe(true);
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue(
      "Keep my unfinished input",
    );
    const names = await page.evaluate(() => caches.keys());
    expect(names.filter((name) => name.startsWith("better-vikunja-shell-")).length).toBe(2);
  } finally {
    await origin.close();
  }
});
