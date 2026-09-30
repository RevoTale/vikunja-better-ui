// Reproduce checked-in PNG install icons from the canonical SVG; not required during builds.
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile("public/favicon.svg", "utf8");
const browser = await chromium.launch();
try {
  for (const [name, size, padding] of [
    ["apple-touch-icon", 180, 0],
    ["icon-192", 192, 0],
    ["icon-512", 512, 0],
    ["icon-maskable-512", 512, 0.15],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>body{margin:0;background:#2e2e2e}img{display:block;width:${size * (1 - 2 * padding)}px;height:${size * (1 - 2 * padding)}px;margin:${size * padding}px}</style><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}">`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    await page.screenshot({ path: `public/${name}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
