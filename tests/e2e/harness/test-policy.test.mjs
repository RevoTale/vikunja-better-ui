import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";
import test from "node:test";

function browserPolicy() {
  const config = new URL("../../../frontend/playwright.config.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--input-type=module", "-e",
    `const {default: config} = await import(${JSON.stringify(config)}); console.log(JSON.stringify(config))`,
  ], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, E2E_BASE_URL: "http://127.0.0.1:12345" },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("browser resource policy retains first-failure diagnostics and focused viewport coverage", () => {
  const config = browserPolicy();
  assert.equal(config.workers, 1);
  assert.equal(config.fullyParallel, false);
  assert.equal(config.use.trace, "retain-on-failure");
  assert.equal(config.use.screenshot, "only-on-failure");
  assert.equal(config.use.video, "retain-on-failure");
  assert.deepEqual(config.projects.map((project) => project.name), [
    "pr-chromium", "pr-webkit", "phone-320", "phone-webkit", "desktop-1440", "timezone-webkit",
  ]);
});

test("PR smoke projects retain representative workflow and browser-risk coverage", async () => {
  process.env["E2E_BASE_URL"] = "http://127.0.0.1:12345";
  const { default: config } = await import("../../../frontend/playwright.config.ts");
  const chromium = config.projects.find((project) => project.name === "pr-chromium");
  const webkit = config.projects.find((project) => project.name === "pr-webkit");

  assert.ok(chromium?.grep instanceof RegExp);
  assert.ok(webkit?.grep instanceof RegExp);
  assert.match("desktop workflows match Vikunja state", chromium.grep);
  assert.match("task editing preserves drafts on conflict", chromium.grep);
  assert.match("PWA keeps authenticated reads", webkit.grep);
  assert.match("discussion supports code and table controls on mobile and desktop", webkit.grep);
});

test("unit workers are bounded without disabling per-file isolation", async () => {
  const { default: config } = await import("../../../frontend/vitest.config.ts");
  assert.equal(config.test.pool, "threads");
  assert.equal(config.test.maxWorkers, Math.min(4, availableParallelism()));
  assert.notEqual(config.test.isolate, false);
});
